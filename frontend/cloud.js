'use strict';
// Streamlit Components v1's public postMessage transport. No Google credentials reach JS.
const cloud={snapshot:null,deferred:null,pending:null,rejected:null,origin:'*',ready:false};
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
 const request={id:crypto.randomUUID(),changes};
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
 const snapshot=args.snapshot,ack=args.ack;
 if(args.error){$('saveStatus').textContent=args.error;$('saveStatus').classList.add('error');if(!cloud.ready)block('공용 자료 연결을 기다리고 있습니다…');return;}
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
