'use strict';
// Streamlit Components v1's public postMessage transport. No Google credentials reach JS.
const cloud={snapshot:null,deferred:null,pending:null,rejected:null,origin:'*',ready:false,actor:''};
function send(type,extra={}){window.parent.postMessage({isStreamlitMessage:true,type,...extra},cloud.origin);}
function records(data){const r={};data.items.forEach(i=>r['item/'+i.id]=i);Object.entries(data.labels).forEach(([k,v])=>r['label/'+k]=v);data.assets.custom.forEach(a=>r['asset/'+a.key]=a);data.assets.deleted.forEach(k=>r['removed/'+k]=true);return r;}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
function equal(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
function block(message){const busy=!!message;$('cloudBlock').hidden=!busy;$('cloudMessage').textContent=message||'';document.querySelectorAll('.workspace,.app-header,dialog').forEach(el=>el.inert=busy);$('draftDownload').hidden=!cloud.pending;}
function saveShared(){
 if(!cloud.snapshot||cloud.pending){storageProblem='공용 연결을 기다리고 있습니다.';return;}
 const next=packet(),before=records(cloud.snapshot.payload),after=records(next),changes=[];
 for(const key of new Set([...Object.keys(before),...Object.keys(after)])){if(!equal(before[key],after[key]))changes.push({key,expected:cloud.snapshot.revisions[key]||null,value:after[key]??null});}
 if(!changes.length){storageProblem='';return;}
 if(!cloud.actor){
  storageProblem='수정 기록에 표시할 이름을 입력해 주세요.';
  requestEditorName(()=>saveShared(),()=>applySnapshot(cloud.deferred||cloud.snapshot,true));
  return;
 }
 const request={id:crypto.randomUUID(),changes,actor:cloud.actor};
 cloud.pending={request,draft:structuredClone(next)};
 storageProblem='공용 저장 확인 중…';updateSaveStatus();block('공용 저장 확인 중…');
 send('streamlit:setComponentValue',{value:request,dataType:'json'});
}
window.officeCloud={save:saveShared};
function applySnapshot(snapshot,force=false){
 const changed=force||cloud.snapshot?.revision!==snapshot.revision;
 cloud.snapshot=structuredClone(snapshot);cloud.deferred=null;
 if(changed){loadState(snapshot.payload);renderMap();refresh();if($('assetsDialog').open)renderAssets();}
 storageProblem='';$('saveStatus').textContent='● 공용 시트 저장 · 연결됨';$('saveStatus').classList.remove('error');
}
function editing(){return !!document.querySelector('dialog[open]')||!!pendingAsset||!!drag;}
function receive(args){
 if(typeof args.actor==='string'&&args.actor.trim())cloud.actor=args.actor.trim();
 const snapshot=args.snapshot,ack=args.ack;
 if(args.error){$('saveStatus').textContent=args.error;$('saveStatus').classList.add('error');block(args.error+' · 약 8초마다 다시 확인합니다.');return;}
 if(!snapshot)return;
 if(cloud.pending&&ack?.id===cloud.pending.request.id){
  const draft=cloud.pending.draft;cloud.pending=null;
  applySnapshot(snapshot,true);block('');cloud.ready=true;
  if(ack.status==='saved'){showToast('공용 저장 완료 · 다른 접속자에게도 반영됩니다.');}
  else{cloud.rejected=draft;$('cloudConflict').hidden=false;$('cloudConflictText').textContent=ack.status==='conflict'?'다른 사람이 먼저 수정했습니다. 이번 수정은 적용하지 않고 최신 내용을 불러왔습니다.':(ack.message||'이번 수정은 저장하지 못했습니다.');showToast('저장되지 않은 수정안은 JSON으로 내려받을 수 있습니다.');}
  return;
 }
 if(cloud.pending)return;
 if(editing()){cloud.deferred=snapshot;return;}
 applySnapshot(snapshot);cloud.ready=true;block('');
}
window.addEventListener('message',event=>{if(event.source!==window.parent||event.data?.type!=='streamlit:render')return;cloud.origin=event.origin;receive(event.data.args||{});});
setInterval(()=>{if(cloud.deferred&&!cloud.pending&&!editing())applySnapshot(cloud.deferred);},400);
function downloadDraft(draft){const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='office-map-unsaved-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('draftDownload').onclick=()=>downloadDraft(cloud.pending.draft);
$('rejectedDownload').onclick=()=>downloadDraft(cloud.rejected);
$('dismissConflict').onclick=()=>$('cloudConflict').hidden=true;
function resizeFrame(){send('streamlit:setFrameHeight',{height:Math.max(880,Math.min(1250,window.innerHeight||1000))});}
block('공용 자료를 불러오고 있습니다…');
send('streamlit:componentReady',{apiVersion:1});resizeFrame();window.addEventListener('resize',resizeFrame);

let mobileResizeTimer;
new ResizeObserver(()=>{
 if(!matchMedia('(max-width:760px)').matches)return;
 clearTimeout(mobileResizeTimer);mobileResizeTimer=setTimeout(()=>{
 const height=Math.ceil(document.querySelector('.app-header').getBoundingClientRect().height+document.querySelector('.mobile-tabs').getBoundingClientRect().height+document.querySelector('.workspace').getBoundingClientRect().height+24);
 send('streamlit:setFrameHeight',{height});
 },100);
}).observe(document.querySelector('.workspace'));

// Ask once on the first editing action; viewing never asks for a name.
const editorDialog=document.createElement('dialog');
editorDialog.id='editorNameDialog';
editorDialog.innerHTML=`<form id="editorNameForm"><div class="dialog-heading"><h2>수정 기록에 표시할 이름</h2></div><p class="muted">누가 수정했는지 기록할 이름을 입력해 주세요. 로그아웃 전까지 다시 묻지 않습니다.</p><label>이름<input id="editorNameInput" maxlength="40" required autocomplete="name" style="font-size:16px"></label><div class="dialog-actions"><button type="button" id="editorNameCancel">취소</button><button type="submit" class="primary">편집 시작</button></div></form>`;
document.body.append(editorDialog);
let editorContinue=null,editorCancel=null,editorClosing=false;
function requestEditorName(proceed,cancel=()=>{}){
 if(cloud.actor){proceed();return;}
 if(editorDialog.open)return;
 editorContinue=proceed;editorCancel=cancel;
 $('editorNameInput').value='';editorDialog.showModal();$('editorNameInput').focus();
}
function cancelEditorName(){
 const cancel=editorCancel;editorContinue=editorCancel=null;editorClosing=true;editorDialog.close();cancel?.();
 if(document.activeElement?.matches('#storageInventoryName,#storageInventoryNote'))document.activeElement.blur();
 queueMicrotask(()=>editorClosing=false);
}
$('editorNameCancel').onclick=cancelEditorName;
editorDialog.addEventListener('cancel',event=>{event.preventDefault();cancelEditorName();});
$('editorNameForm').onsubmit=event=>{
 event.preventDefault();const name=$('editorNameInput').value.trim();
 if(!name){$('editorNameInput').setCustomValidity('이름을 입력해 주세요.');$('editorNameInput').reportValidity();return;}
 cloud.actor=name;const proceed=editorContinue;editorContinue=editorCancel=null;editorDialog.close();proceed?.();
};
$('editorNameInput').oninput=()=>$('editorNameInput').setCustomValidity('');
const editTriggers='[data-add],[data-edit],[data-delete],[data-rename],#labelsBtn,#assetsBtn,#importBtn,#restoreBtn,[data-storage-edit],[data-storage-delete],#storageInventoryRename,#storageInventoryName,#storageInventoryNote';
document.addEventListener('click',event=>{
 if(cloud.actor||!cloud.ready)return;
 const control=event.target.closest(editTriggers);if(!control)return;
 event.preventDefault();event.stopImmediatePropagation();
 requestEditorName(()=>{if(control.matches('input,textarea'))control.focus();else control.click();});
},true);

document.addEventListener('focusin',event=>{
 if(cloud.actor||!cloud.ready||editorClosing||editorDialog.open)return;
 if(event.target.matches('#storageInventoryName,#storageInventoryNote')){
  const input=event.target;requestEditorName(()=>input.focus());
 }
},true);
