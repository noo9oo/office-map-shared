'use strict';
// Ground coordinates follow the supplied 322 × 776 plan. 82 units = 190 cm.
const STORAGE_KEY='office-atlas-v1', PREVIOUS_KEY='office-atlas-before-import-v1';
const LEVELS={top:'상단',middle:'중단',bottom:'하단',all:'전체칸'};
const CABINETS=[
 {id:1,x:33,y:543,w:32,d:14,location:'중앙 왼쪽 · 탕비공간 옆'},
 {id:2,x:14,y:497,w:22,d:14,location:'이정우 좌석 아래 · 왼쪽'},
 {id:3,x:37,y:497,w:22,d:14,location:'이정우 좌석 아래 · 가운데'},
 {id:4,x:60,y:497,w:22,d:14,location:'이정우 좌석 아래 · 오른쪽'},
 {id:5,x:158,y:541,w:33,d:16,location:'공석 위 · 회의공간 아래'},
 {id:6,x:193,y:523,w:14,d:16,location:'박승재 앞 · 공기청정기 옆 위쪽'},
 {id:7,x:193,y:540,w:14,d:16,location:'박승재 앞 · 공기청정기 옆 아래쪽'},
 {id:8,x:140,y:638,w:23,d:16,location:'실장실 앞 · 왼쪽'},
 {id:9,x:165,y:638,w:23,d:16,location:'실장실 앞 · 가운데'},
 {id:10,x:190,y:638,w:23,d:16,location:'실장실 앞 · 오른쪽'}
];
const SEATS=[
 {name:'이동현',x:52,y:300,w:25,d:48,cx:43,cy:328},
 {name:'홍명은',x:52,y:378,w:25,d:48,cx:43,cy:404},
 {name:'이정우',x:52,y:444,w:25,d:48,cx:43,cy:470},
 {name:'장선아',x:52,y:567,w:25,d:48,cx:43,cy:593},
 {name:'김필서',x:52,y:647,w:25,d:47,cx:43,cy:673},
 {name:'김정우',x:52,y:701,w:25,d:47,cx:43,cy:727},
 {name:'최진욱',x:145,y:397,w:48,d:25,cx:169,cy:385},
 {name:'함주영',x:213,y:369,w:25,d:48,cx:245,cy:395},
 {name:'권혁연',x:213,y:439,w:25,d:48,cx:245,cy:465},
 {name:'박승재',x:213,y:508,w:25,d:48,cx:245,cy:534},
 {name:'공석',x:156,y:563,w:48,d:25,cx:180,cy:597},
 {name:'오정수',x:213,y:563,w:48,d:25,cx:237,cy:597},
 {name:'김종주',x:250,y:659,w:46,d:25,cx:273,cy:694}
];
const ASSETS=[
 {key:'asset-meeting',name:'회의테이블',x:137,y:440,w:26,d:82},
 {key:'asset-manager-table',name:'실장실 테이블',x:170,y:704,w:61,d:33},
 {key:'asset-printer1',name:'복합기',x:118,y:597,w:19,d:23},
 {key:'asset-printer2',name:'프린터',x:118,y:373,w:19,d:23},
 {key:'asset-purifier',name:'공기청정기',x:195,y:508,w:10,d:10},
 {key:'asset-pantry',name:'탕비공간',x:15,y:532,w:66,d:25},
 {key:'asset-coffee',name:'커피머신',x:15,y:541,w:15,d:15},
 {key:'asset-water',name:'정수기',x:15,y:532,w:7,d:7},
 {key:'asset-fridge',name:'냉장고',x:67,y:543,w:14,d:14},
 {key:'asset-shredder',name:'파쇄함',x:120,y:580,w:18,d:13},
 {key:'room-team',name:'연구·기획분석팀',x:150,y:285,w:120,d:50},
 {key:'room-director',name:'실장실',x:145,y:663,w:150,d:85}
];
const LABEL_DEFINITIONS=[...SEATS.map((s,i)=>({key:`seat-${i}`,name:s.name,group:'좌석 이름',hint:`지정석 ${i+1}`})),...ASSETS.map(a=>({...a,group:a.key.startsWith('room-')?'공간 이름':'고정 자산 이름',hint:a.name})),...CABINETS.map(c=>({key:`cabinet-${c.id}`,name:`캐비닛 ${String(c.id).padStart(2,'0')}`,group:'캐비닛 이름',hint:`도면 번호 ${c.id}`}))];
const DEFAULT_LABELS=Object.fromEntries(LABEL_DEFINITIONS.map(d=>[d.key,d.name]));
let assetState={custom:[],deleted:[]};
let pendingAsset=null;
const activeAssets=()=>[...ASSETS,...assetState.custom].filter(a=>!assetState.deleted.includes(a.key));
const labelDefinitions=()=>[...LABEL_DEFINITIONS.filter(d=>!assetState.deleted.includes(d.key)),...assetState.custom.map(a=>({...a,group:'추가한 고정 자산',hint:a.name}))];
let labels={...DEFAULT_LABELS};
const labelName=key=>labels[key]||DEFAULT_LABELS[key]||assetState.custom.find(a=>a.key===key)?.name||key;
const seatName=index=>labelName(`seat-${index}`);
function cabinetLocation(c){const n=i=>seatName(i);return ({1:`중앙 왼쪽 · ${labelName('asset-pantry')} 옆`,2:`${n(2)} 좌석 아래 · 왼쪽`,3:`${n(2)} 좌석 아래 · 가운데`,4:`${n(2)} 좌석 아래 · 오른쪽`,5:`${n(10)} 위 · 회의공간 아래`,6:`${n(9)} 좌석 왼쪽 · 위쪽`,7:`${n(9)} 좌석 왼쪽 · 아래쪽`,8:`${labelName('room-director')} 벽 앞 · ${n(10)} 방향`,9:`${labelName('room-director')} 벽 앞 · ${n(10)} 방향`,10:`${labelName('room-director')} 벽 앞 · ${n(10)} 방향`})[c.id];}
const seedRows=[
 [1,'all',['생일용품','주방용품','등등']],
 [2,'top',['종이가방']],[2,'middle',['서류철','파일','봉투','방명록']],[2,'bottom',['리갈패드','명패','펜트레이']],
 [3,'top',['부조봉투','보안수첩','물티슈']],[3,'middle',['이젤','화구통']],[3,'bottom',['토너']],
 [4,'top',['문구용품 서랍']],[4,'middle',['문구용품 서랍']],[4,'bottom',['문구용품 서랍']],
 [5,'top',['생일용품']],[5,'middle',['라벨지','멀티탭']],[5,'bottom',['A4용지']],
 [6,'top',['빔프로젝터']],[6,'middle',['케이블']],[6,'bottom',['CD']],
 [7,'top',['연구사업 계획서']],[7,'middle',['기관평가 보고서']],[7,'bottom',['연구사업 계획서']],
 [8,'top',['KIST']],[8,'middle',['내부']],[8,'bottom',['간행물']],
 [9,'middle',['기관평가','TEPRI']],[9,'bottom',['원유형 소장님 자료들']],
 [10,'top',['단행본 (미세먼지 / 추월의 방정식)']],[10,'middle',['탄소중립']],[10,'bottom',['KIST 성과보고서']]
];
const seedItems=seedRows.flatMap(([cabinet,level,names])=>names.map((name,index)=>({id:`source-${cabinet}-${level}-${index}`,name,cabinet,level,note:cabinet===1?'원본 표에서 상·중·하단 병합':name==='등등'?'원본 표에 기재된 기타 물품':name==='빔프로젝터'?'원본 표 표기: 빔플젝터':''})));
const $=id=>document.getElementById(id), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s).normalize('NFKC').toLowerCase().replace(/\s+/g,'');
let items=structuredClone(seedItems), selected=5, query='', storageProblem='', mode='iso', rotation=0, camera, zoom=1, full=false, toastTimer, confirmAction;
function validateData(value){
 if(!value||![1,2,3].includes(value.schemaVersion)||!Array.isArray(value.items)||value.items.length>10000)throw Error('이 앱의 JSON 백업 형식이 아닙니다.');
 const ids=new Set();
 return value.items.map(i=>{
  if(!i||typeof i.id!=='string'||!i.id||i.id.length>150||ids.has(i.id)||typeof i.name!=='string'||!i.name.trim()||i.name.length>120||!Number.isInteger(i.cabinet)||i.cabinet<1||i.cabinet>10||!Object.hasOwn(LEVELS,i.level)||typeof i.note!=='string'||i.note.length>500)throw Error('비품 데이터에 잘못된 이름, 번호, 칸 또는 중복 ID가 있습니다.');
  ids.add(i.id);return {id:i.id,name:i.name.trim(),cabinet:i.cabinet,level:i.level,note:i.note};
 });
}
function validateAssets(value){
 if(!value||!Array.isArray(value.custom)||!Array.isArray(value.deleted)||value.custom.length>200)throw Error('고정 자산 데이터가 올바르지 않습니다.');
 const ids=new Set();const custom=value.custom.map(a=>{
 if(!a||typeof a.key!=='string'||!/^custom-[a-z0-9-]{1,80}$/.test(a.key)||ids.has(a.key)||typeof a.name!=='string'||!a.name.trim()||a.name.length>60||!['storage','table','printer','purifier','box'].includes(a.type)||!Number.isFinite(a.x)||!Number.isFinite(a.y)||a.x<14||a.x>289||a.y<18||a.y>747)throw Error('추가한 자산의 이름·종류·위치가 올바르지 않습니다.');
 if(!Number.isFinite(a.w)||!Number.isFinite(a.d)||a.w<8||a.w>120||a.d<8||a.d>120||a.x+a.w>297||a.y+a.d>755)throw Error('자산 크기 또는 위치를 확인해 주세요.');
 ids.add(a.key);return {key:a.key,name:a.name.trim(),type:a.type,x:a.x,y:a.y,w:a.w,d:a.d};});
 const deleted=[...new Set(value.deleted)];if(deleted.some(k=>!ASSETS.some(a=>a.key===k&&k.startsWith('asset-'))))throw Error('삭제한 자산 목록이 올바르지 않습니다.');
 return {custom,deleted};
}
function validateLabels(value,state=assetState){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('이름 데이터가 올바르지 않습니다.');
 const result={...DEFAULT_LABELS,...Object.fromEntries(state.custom.map(a=>[a.key,a.name]))};
 for(const [key,name]of Object.entries(value)){if(key==='asset-safe')continue;if(!Object.hasOwn(result,key)||typeof name!=='string'||!name.trim()||name.length>60)throw Error('이름은 1~60자로 입력해야 합니다.');result[key]=name.trim();}
 return result;
}
function readState(value){const state=value.schemaVersion===3?validateAssets(value.assets):structuredClone(assetState);return {items:validateData(value),labels:value.schemaVersion>=2?validateLabels({...Object.fromEntries(state.custom.map(a=>[a.key,labelName(a.key)])),...value.labels},state):{...labels},assets:state};}
function loadState(value){const state=readState(value);items=state.items;labels=state.labels;assetState=state.assets;}
function packet(list=items){return {schemaVersion:3,app:'Office Atlas',exportedAt:new Date().toISOString(),items:list,labels:{...labels},assets:structuredClone(assetState)};}
function showToast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function persist(){window.officeCloud?.save();}
function updateSaveStatus(){$('saveStatus').textContent=storageProblem||'● 공용 시트 연결';$('saveStatus').classList.toggle('error',!!storageProblem);if(storageProblem)showToast(storageProblem);}
function ask(title,text,action){$('confirmTitle').textContent=title;$('confirmText').textContent=text;confirmAction=action;$('confirmDialog').showModal();}
function itemMatches(i){const q=norm(query);return !q||norm(i.name+' '+i.note+' '+labelName('cabinet-'+i.cabinet)).includes(q)||norm(`캐비닛${i.cabinet}`).includes(q)||q===String(i.cabinet)||q===String(i.cabinet).padStart(2,'0');}
function cabinetMatches(id){const q=norm(query);return !q||norm(labelName('cabinet-'+id)).includes(q)||q===String(id)||q===String(id).padStart(2,'0')||norm(`캐비닛${id}`).includes(q)||items.some(i=>i.cabinet===id&&itemMatches(i));}
function seatMatches(name){return !!norm(query)&&norm(name).includes(norm(query));}
function renderList(){
 const cabs=CABINETS.filter(c=>cabinetMatches(c.id)),seats=SEATS.map((s,index)=>({...s,index})).filter(s=>seatMatches(seatName(s.index))),assets=query?activeAssets().filter(a=>norm(labelName(a.key)).includes(norm(query))):[];
 $('listTitle').textContent=query?'검색 결과':'전체 캐비닛';$('resultCount').textContent=query?`${cabs.length+seats.length+assets.length}곳`:'10';
 $('cabinetList').innerHTML=cabs.map(c=>{const arr=items.filter(i=>i.cabinet===c.id&&(!query||itemMatches(i)));return `<button class="cabinet-link ${selected===c.id?'active':''}" data-select="${c.id}" aria-pressed="${selected===c.id}"><span class="number-chip">${String(c.id).padStart(2,'0')}</span><span class="cabinet-text"><strong>${esc(labelName('cabinet-'+c.id))}</strong><small>${esc(arr.length?arr.map(i=>i.name).join(' · '):'등록된 비품 없음')}</small></span></button>`;}).join('')+seats.map(s=>`<button class="cabinet-link" data-find-seat="${s.index}"><span class="number-chip">◇</span><span class="cabinet-text"><strong>${esc(seatName(s.index))}</strong><small>좌석 위치 보기</small></span></button>`).join('')+assets.map(a=>`<button class="cabinet-link" data-find-asset="${a.key}"><span class="number-chip">▱</span><span class="cabinet-text"><strong>${esc(labelName(a.key))}</strong><small>자산 위치 보기</small></span></button>`).join('')+(!cabs.length&&!seats.length&&!assets.length?'<p class="empty">검색 결과가 없어요.<br>다른 비품명이나 이름으로 찾아보세요.</p>':'');
}
function renderDetail(){
 const c=CABINETS.find(c=>c.id===selected),arr=items.filter(i=>i.cabinet===selected);
 $('detail').innerHTML=`<p class="eyebrow">CABINET DETAILS</p><div class="detail-top"><div class="detail-heading"><span class="detail-number">${String(c.id).padStart(2,'0')}</span><div><h2>${esc(labelName('cabinet-'+c.id))}</h2><p class="detail-location">${esc(cabinetLocation(c))}</p><button class="text-btn" data-rename="cabinet-${c.id}">이름 수정</button></div></div></div><button class="primary add-btn" data-add="top">＋ 비품 추가</button><div class="inventory-heading"><b>보관 비품</b><span>총 ${arr.length}개 항목</span></div>${(arr.some(i=>i.level==='all')?['all','top','middle','bottom']:['top','middle','bottom']).map(level=>{const list=arr.filter(i=>i.level===level);return `<section class="shelf" data-level="${level}"><div class="shelf-heading"><h3><i class="shelf-icon" aria-hidden="true"></i>${LEVELS[level]}${level==='all'?' · 단 미지정':''}</h3><span>${list.length}개 항목</span></div>${list.map(i=>`<div class="item ${query&&itemMatches(i)?'match':''}"><p class="item-name">${esc(i.name)}</p>${i.note?`<p class="item-note">${esc(i.note)}</p>`:''}<div class="item-actions"><button data-edit="${esc(i.id)}" aria-label="${esc(i.name)} 수정">수정 · 이동</button><button data-delete="${esc(i.id)}" class="delete" aria-label="${esc(i.name)} 삭제">삭제</button></div></div>`).join('')||`<p class="empty">${c.id===1?'해당 단에 따로 등록된 비품 없음':'등록된 비품 없음'}</p>`}<button class="text-btn" data-add="${level}">＋ ${LEVELS[level]}에 추가</button></section>`;}).join('')}${c.id===1?'<p class="detail-note">원본 표는 1번의 세 단을 합쳐 표시합니다. 확인된 단이 있으면 ‘수정 · 이동’에서 지정해 주세요.</p>':''}`;
}
function openLabels(key){
 let previous='';$('labelsFields').innerHTML=labelDefinitions().map(d=>{const heading=d.group!==previous?`<h3>${d.group}</h3>`:'';previous=d.group;return `${heading}<label>${esc(d.hint)}<input data-label-input="${d.key}" value="${esc(labelName(d.key))}" required maxlength="60" aria-label="${esc(d.hint)} 이름"></label>`;}).join('');
 $('labelsDialog').showModal();const input=key?document.querySelector(`[data-label-input="${key}"]`):$('labelsFields').querySelector('input');if(input){input.focus();input.select();input.scrollIntoView({block:'center'});}$('tooltip').hidden=true;
}
function selectCabinet(id,focusMap=false){selected=id;if(matchMedia('(max-width:760px)').matches)setMobilePanel('detail');renderList();renderDetail();updateHighlights();if(focusMap)focusPoint(CABINETS.find(c=>c.id===id));}
function openEditor(id=null,level='top'){
 const i=items.find(i=>i.id===id);$('editForm').reset();$('itemId').value=i?.id||'';$('editTitle').textContent=i?'비품 수정 · 이동':'비품 추가';$('itemName').value=i?.name||'';$('itemCabinet').value=i?.cabinet||selected;$('itemLevel').value=i?.level||level;$('itemNote').value=i?.note||'';$('editDialog').showModal();$('itemName').focus();
}
// The camera turns in 90 degree steps; geometry stays in original plan coordinates.
function ground(x,y){x-=155;y-=520;return [[x,y],[-y,x],[-x,-y],[y,-x]][rotation];}
function p(x,y,z=0){if(mode==='plan')return [x,y];const [u,v]=ground(x,y);return [.8660254*(u-v),.5*(u+v)-z*.86];}
function depth(x,y){const [u,v]=ground(x,y);return mode==='plan'?0:u+v;}
function points(coords){return coords.map(v=>p(...v).map(n=>n.toFixed(2)).join(',')).join(' ');}
function poly(coords,fill,cls='',stroke='#647b7020'){return `<polygon points="${points(coords)}" fill="${fill}" stroke="${stroke}" stroke-width=".5" stroke-linejoin="round"${cls?` class="${cls}"`:''}/>`;}
function box(x,y,w,d,h,top='#e8e5d9',front='#d5d4c9',side='#bbbeb4',cls='',z=0){
 const lid=poly([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],top,cls);
 if(mode==='plan')return lid;
 const xx=[0,1].includes(rotation)?x+w:x, yy=[0,3].includes(rotation)?y+d:y;
 return poly([[x,yy,z],[x+w,yy,z],[x+w,yy,z+h],[x,yy,z+h]],rotation%2?side:front)+poly([[xx,y,z],[xx,y+d,z],[xx,y+d,z+h],[xx,y,z+h]],rotation%2?front:side)+lid;
}
function line(a,b,color='#7f938b',width=.8,dash=''){const q=p(...a),r=p(...b);return `<line x1="${q[0]}" y1="${q[1]}" x2="${r[0]}" y2="${r[1]}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${dash?`stroke-dasharray="${dash}"`:''}/>`;}
function label(text,x,y,z=0,cls='feature-label'){const q=p(x,y,z);return `<text x="${q[0]}" y="${q[1]}" text-anchor="middle" class="${cls}">${esc(text)}</text>`;}
function nameTag(key,x,y,z,cls='asset-label',attrs=''){
 const text=labelName(key),q=p(x,y,mode==='plan'?0:z),width=Math.min(126,Math.max(34,Array.from(text).length*7+12));
 return `<g class="${cls}" data-label-key="${key}" ${attrs} role="button" tabindex="0" aria-label="${esc(text)} 이름 수정"><title>${esc(text)} · 클릭하여 이름 수정</title><rect x="${q[0]-width/2}" y="${q[1]-6.5}" width="${width}" height="13" rx="3.5"/><text x="${q[0]}" y="${q[1]+2.5}" text-anchor="middle">${esc(text)}</text></g>`;
}
function shadow(x,y,w,d){return poly([[x+2,y+2,.05],[x+w+3,y+2,.05],[x+w+3,y+d+3,.05],[x+2,y+d+3,.05]],'#647b6410','', 'none');}
function desk(x,y,w,d){
 let out='';const alongY=d>w;
 if(mode==='iso')for(const[a,b]of[[x+2,y+2],[x+w-4,y+2],[x+2,y+d-4],[x+w-4,y+d-4]])out+=box(a,b,1.8,1.8,28,'#bbc0b3','#acb2a6','#8f9c8c');
 out+=box(x+3,y+d-14,Math.min(w-6,12),11,25,'#e0e2d5','#d9ddcf','#bcc9b7');
 out+=box(x,y,w,d,2.4,'#e2caa6','#cbb38f','#baa78a','desk-top',28.5);
 const mx=alongY?x+w-8:x+w/2-9,my=alongY?y+d/2-10:y+6,mw=alongY?2.4:18,md=alongY?20:2.4;
 out+=box(mx-1,my+1,mw+2,md+2,.9,'#92a59a','#778e80','#6d8474','',31);
 out+=box(mx+mw/2-1,my+md/2-1,2,2,3,'#7d9487','#678172','#526c5d','',32);
 out+=box(mx,my,mw,md,11,'#4f6862','#3d5450','#334b48','',35);
 // Screen inset and monitor rim stay attached to the desktop at every angle.
 if(mode==='plan')out+=poly([[mx,my],[mx+mw,my],[mx+mw,my+md],[mx,my+md]],'#334f49');
 else if(alongY){const xx=mx+mw;out+=poly([[xx,my+1,36],[xx,my+md-1,36],[xx,my+md-1,45],[xx,my+1,45]],'#69897e');}
 else if([0,3].includes(rotation))out+=poly([[mx+1,my+md,36],[mx+mw-1,my+md,36],[mx+mw-1,my+md,45],[mx+1,my+md,45]],'#69897e');
 const kx=alongY?x+5:x+w/2-7,ky=alongY?y+d/2-7:y+14,kw=alongY?4:14,kd=alongY?14:4;
 out+=box(kx,ky,kw,kd,.6,'#c5d0bc','#b7c4ad','#aab99f','',31);
 out+=box(x+4,y+d-9,7,5,.6,'#f5f2e4','#e5dfcd','#d3d1bb','',31)+box(x+4.5,y+d-8.5,6,4,.4,'#faf7ed','#ece8d8','#dbdac9','',31.7);
 return out;
}
function table(x,y,w,d){
 let out='';if(mode==='iso')for(const[a,b]of[[x+4,y+4],[x+w-6,y+4],[x+4,y+d-6],[x+w-6,y+d-6]])out+=box(a,b,2,2,29,'#b6bfae','#a5b19d','#8a9a84');
 out+=box(x+.5,y+.5,w-1,d-1,2,'#e3cba6','#c6af8a','#b49d79','',29);
 out+=poly([[x+2,y,31.5],[x+w-2,y,31.5],[x+w,y+2,31.5],[x+w,y+d-2,31.5],[x+w-2,y+d,31.5],[x+2,y+d,31.5],[x,y+d-2,31.5],[x,y+2,31.5]],'#e9d2ae','asset-top','#c2aa8360');
 out+=box(x+w/2-2,y+d/2-7,4,14,.5,'#e4e6d7','#cad2be','#b5c2ab','',31.5)+line([x+w/2,y+d/2-6,32.1],[x+w/2,y+d/2+6,32.1],'#82957e',.5);
 return out;
}
function purifier(x,y){
 const q=p(x,y,0),t=p(x,y,33);if(mode==='plan')return `<circle cx="${q[0]}" cy="${q[1]}" r="6" fill="#dce4d7" stroke="#a6b8a1"/>`;
 return `<path d="M${q[0]-6} ${q[1]} V${t[1]} A6 3 0 0 1 ${t[0]+6} ${t[1]} V${q[1]} A6 3 0 0 1 ${q[0]-6} ${q[1]}" fill="url(#purifierTone)" stroke="#b9c6b0" stroke-width=".4"/><ellipse cx="${t[0]}" cy="${t[1]}" rx="6" ry="3" fill="#4d6557"/><ellipse cx="${t[0]}" cy="${t[1]}" rx="3.8" ry="1.9" fill="#94aa8b"/><path d="M${q[0]-5.5} ${q[1]-14} Q${q[0]} ${q[1]-11} ${q[0]+5.5} ${q[1]-14}" fill="none" stroke="#526c52" stroke-width="1.3"/>`;
}
function printer(x,y){
 let out=box(x+1,y+1,17,21,2,'#6b8072','#4e6357','#3d5448');
 out+=box(x,y,19,23,25,'#677e71','#e9ece0','#c7d2c0','',2);
 out+=box(x,y,19,23,4,'#38554d','#334c46','#2b423b','asset-top',27);
 out+=box(x+3,y+3,13,11,2,'#f2f1e4','#d5ddcc','#b7c6af','',31);
 out+=box(x+2,y+17,7,4,2,'#446358','#577567','#314a40','',31)+box(x+3,y+17.5,5,3,.3,'#86b7ae','#608f80','#4c7c69','',33);
 if(mode==='iso'&&[0,3].includes(rotation))for(const z of[7,16]){out+=line([x+2,y+23,z],[x+17,y+23,z],'#a4b99d',.65);out+=line([x+7,y+23,z+3],[x+12,y+23,z+3],'#6d8566',1.1);}
 return out;
}
function cabinetGeometry(c){
 const {x,y,w,d}=c,face=c.id>=8?'north':(c.id===6||c.id===7)?'west':'south';
 let html=box(x+.7,y+.5,w-1.4,d-1,2,'#8b9d84','#93a189','#7b9075');
 html+=box(x,y,w,d,32,'#d1dfce','#ebeddf','#b9cbb0','',2);
 html+=box(x-.3,y-.3,w+.6,d+.6,1.5,'#c6d7c3','#91aa8a','#7e9878','cab-top',34);
 const visible=mode==='iso'&&(face==='north'?[1,2].includes(rotation):face==='west'?[2,3].includes(rotation):[0,3].includes(rotation));
 if(visible){const a=face==='west'?[x,y]:[x,face==='north'?y:y+d],b=face==='west'?[x,y+d]:[x+w,face==='north'?y:y+d];
  html+=poly([[...a,3],[...b,3],[...b,33],[...a,33]],'#edf0e3','cab-front','#a7bda050');
  const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];html+=line([...mid,4],[...mid,32],'#a4b79b',.55);
  for(const offset of[-1.6,1.6]){const hx=mid[0]+(face==='west'?0:offset),hy=mid[1]+(face==='west'?offset:0);html+=line([hx,hy,18],[hx,hy,23],'#82977b',1.1);}
 }
 // A discreet front-edge strip also makes orientation legible in plan view.
 const north=face==='north',west=face==='west';
 html+=west?poly([[x,y+1,35.6],[x+1.3,y+1,35.6],[x+1.3,y+d-1,35.6],[x,y+d-1,35.6]],'#6b9374'):poly([[x+1,north?y:y+d-1.3,35.6],[x+w-1,north?y:y+d-1.3,35.6],[x+w-1,north?y+1.3:y+d,35.6],[x+1,north?y+1.3:y+d,35.6]],'#6b9374');
 return html;
}
function renderMap(){
 const objs=[],labels=[];let floor='';
 const add=(x,y,w,d,html,attrs='')=>{floor+=shadow(x,y,w,d);objs.push({depth:depth(x+w/2,y+d/2),html:attrs?`<g ${attrs}>${html}</g>`:html});};
 // Cut away the unused portion of the separate team space in the main view.
 const start=full?18:278;
 floor+=poly([[14,start,-4],[297,start,-4],[297,755,-4],[14,755,-4]],'#d6dfd1','', '#c1cdbb');
 floor+=box(14,start,283,755-start,3,'#eff0e6','#d6dfce','#bfceb6','',-3);
 for(let x=14;x<297;x+=23)floor+=line([x,start,0],[x,755,0],'#dde2d2',.4);
 for(let y=start;y<755;y+=23)floor+=line([14,y,0],[297,y,0],'#dde2d2',.4);
 floor+=poly([[14,start],[297,start],[297,355],[82,355],[82,293],[14,293]],'#dde6da');
 floor+=poly([[143,660],[297,660],[297,752],[143,752]],'#e4e9dc');
 labels.push(nameTag('room-team',206,317,0),nameTag('room-director',231,736,0));
 const parts=[[14,293,68,2],[80,293,2,62],[43,355,39,2],[80,369,2,60],[43,367,39,2],[14,427,68,2],[80,444,2,51],[14,493,68,2],[141,356,135,2],[141,356,2,67],[141,423,57,2],[196,386,2,38],[207,356,2,67],[208,423,36,2],[208,432,67,2],[208,432,2,61],[208,491,37,2],[208,500,38,2],[208,500,2,57],[15,559,68,2],[81,559,2,65],[43,624,40,2],[43,635,40,2],[81,635,2,119],[14,693,69,2],[142,559,134,2],[142,559,2,69],[276,559,2,68]];
 // Short segments sort correctly when seen from opposite directions.
 function wall(x,y,w,d,h,kind){const segments=Math.ceil(Math.max(w,d)/18);for(let i=0;i<segments;i++){const xx=x+(w>d?w*i/segments:0),yy=y+(d>=w?d*i/segments:0),ww=w>d?w/segments:w,dd=d>=w?d/segments:d;
  const html=kind==='partition'?box(xx,yy,ww,dd,21,'#c3c8b7','#9fa698','#879780')+box(xx,yy,ww,dd,h-21,'#e2ded0','#d8d4c4','#c2c6b5','',21)+box(xx-.2,yy-.2,ww+.4,dd+.4,.8,'#e4e7dc','#cad2c0','#b6c6ae','',h):box(xx,yy,ww,dd,h,'#dbe7df','#c4d7cb','#aabfaf');
  add(xx,yy,ww,dd,html,`class="${kind}"`);
 }}
 parts.forEach(v=>wall(...v,40,'partition'));
 wall(11,start,3,513-start,9,'outer-wall');
 wall(11,533,3,755-533,9,'outer-wall');
 wall(296,start,3,755-start,9,'outer-wall');
 floor+=line([14,513],[14,533],'#8aa393',.8,'3 2');
 floor+=line([14,533],[34,533],'#7e9886',1.8);
 for(let i=0;i<16;i++){
  const a=-Math.PI/2+i*Math.PI/32,b=a+Math.PI/32;
  floor+=line([14+20*Math.cos(a),533+20*Math.sin(a)],[14+20*Math.cos(b),533+20*Math.sin(b)],'#8aa393',.6);
 }
 labels.push(label('문',29,522,0));
 for(let yy=start+8;yy<744;yy+=31)add(297,yy,1,23,box(297,yy,1,23,11,'#d7e9de','#bcd8c4','#accbb4','',9));
 if(full)wall(14,15,283,3,12,'outer-wall');
 // Cabinets 8–10 are outside the north-facing room wall; the manager sits south of it.
 wall(139,656,158,4,43,'manager-wall');wall(140,699,3,56,29,'manager-wall');wall(143,752,154,3,13,'manager-wall');
 floor+=line([140,660],[140,697],'#8aa393',.8,'3 2')+line([140,697],[158,684],'#7e9886',1.8);
 labels.push(label('문',132,682,0));
 SEATS.forEach((s,index)=>{add(s.x,s.y,s.w,s.d,desk(s.x,s.y,s.w,s.d),`class="seat" data-seat-index="${index}" data-label-key="seat-${index}" role="button" tabindex="0" aria-label="${esc(seatName(index))} 이름 수정"`);labels.push(nameTag(`seat-${index}`,s.x+s.w/2,s.y+s.d/2,49,'seat-label',`data-seat-index="${index}"`));});
 function asset(key,x,y,w,d,html,lx=x+w/2,ly=y+d/2,lz=43,tag=true){if(assetState.deleted.includes(key))return;add(x,y,w,d,html,`class="asset-object" data-label-key="${key}" role="button" tabindex="0" aria-label="${esc(labelName(key))} 이름 수정"`);if(tag)labels.push(nameTag(key,lx,ly,lz));}
 asset('asset-meeting',137,440,60/190*82,82,table(137,440,60/190*82,82),150,481,37);
 asset('asset-manager-table',170,704,61,33,table(170,704,61,33),199,720,37,false);
 asset('asset-coffee',15,541,15,15,box(15,541,15,15,33,'#b6c2b8','#9aa99e','#899c8d')+box(17,543,10,7,12,'#455f51','#3d5647','#324b3c','',33),22,548,53,false);
 asset('asset-fridge',67,543,14,14,box(67,543,14,14,53,'#c6d0c3','#b7c4b2','#97ac90')+box(67,543,14,14,1,'#e0e5d8','#aabca2','#8ca181','',27),74,550,61,false);
 if(!assetState.deleted.includes('asset-pantry'))labels.push(nameTag('asset-pantry',40,542,62));
 asset('asset-purifier',195,508,10,10,purifier(200,513),200,513,46,false);
 asset('asset-printer1',118,597,19,23,printer(118,597),125,612,39);
 asset('asset-printer2',118,373,19,23,printer(118,373),125,385,39,false);
 asset('asset-shredder',120,580,18,13,box(120,580,18,13,24,'#d6d4c7','#bebdab','#a9ae9b')+box(122,584,14,2,.4,'#788974','#788974','#788974','',24),128,587,34,false);
 for(const a of assetState.custom){const html=a.type==='table'?table(a.x,a.y,a.w,a.d):a.type==='printer'?printer(a.x,a.y):a.type==='purifier'?purifier(a.x+10,a.y+12):box(a.x,a.y,a.w,a.d,30,'#c6d7c3','#ebeddf','#b9cbb0','asset-top');asset(a.key,a.x,a.y,a.w,a.d,html,a.x+a.w/2,a.y+a.d/2,44);}
 CABINETS.forEach(c=>{add(c.x,c.y,c.w,c.d,cabinetGeometry(c),`class="cabinet-object" data-cabinet="${c.id}" data-facing="${c.id>=8?'north':c.id===6||c.id===7?'west':'south'}" role="button" tabindex="0" aria-label="${esc(labelName('cabinet-'+c.id))} 상세 보기"`);const q=p(c.x+c.w/2,c.y+c.d/2,48);labels.push(`<g class="cab-label" data-cabinet="${c.id}" role="button" tabindex="0" aria-label="캐비닛 ${c.id} 상세 보기"><rect x="${q[0]-9}" y="${q[1]-8}" width="18" height="16" rx="5"/><text x="${q[0]}" y="${q[1]+3.5}" text-anchor="middle">${c.id}</text></g>`);});
 $('scene').innerHTML=`<defs><linearGradient id="purifierTone"><stop stop-color="#e8eddf"/><stop offset=".6" stop-color="#f6f6e9"/><stop offset="1" stop-color="#bdcbb2"/></linearGradient></defs><g>${floor}</g>${objs.sort((a,b)=>a.depth-b.depth).map(o=>o.html).join('')}<g class="map-labels">${labels.join('')}</g>`;
 $('scene').classList.toggle('hide-names',!$('namesToggle').checked);updateHighlights();
}
function updateHighlights(){
 document.querySelectorAll('[data-cabinet]').forEach(el=>{const id=Number(el.dataset.cabinet);el.classList.toggle('active',id===selected);el.classList.toggle('match',!!query&&cabinetMatches(id));el.classList.toggle('dim',!!query&&!cabinetMatches(id));});
 document.querySelectorAll('[data-seat-index]').forEach(el=>el.classList.toggle('seat-match',seatMatches(seatName(Number(el.dataset.seatIndex)))));
 document.querySelectorAll('[data-label-key]').forEach(el=>el.classList.toggle('asset-match',!!norm(query)&&norm(labelName(el.dataset.labelKey)).includes(norm(query))));
}
function baseCamera(){
 if(mode==='plan')return full?[-5,-15,335,850]:[-5,252,325,565];
 const start=full?18:278,pts=[[11,start,65],[301,start,65],[301,755,0],[11,755,0]].map(v=>p(...v));
 const xs=pts.map(v=>v[0]),ys=pts.map(v=>v[1]),left=Math.min(...xs)-38,top=Math.min(...ys)-35;
 return [left,top,Math.max(...xs)-left+38,Math.max(...ys)-top+84];
}
function applyCamera(){$('map').setAttribute('viewBox',camera.join(' '));$('zoomValue').textContent=Math.round(zoom*100)+'%';}
function resetCamera(all=false){const changed=full!==all;full=all;zoom=1;if(changed)renderMap();camera=baseCamera();applyCamera();}
function zoomBy(factor){const next=Math.min(3.5,Math.max(.65,zoom*factor)),r=zoom/next;camera=[camera[0]+camera[2]*(1-r)/2,camera[1]+camera[3]*(1-r)/2,camera[2]*r,camera[3]*r];zoom=next;applyCamera();}
function focusPoint(c){const q=p(c.x+(c.w||0)/2,c.y+(c.d||0)/2,20);camera[0]=q[0]-camera[2]/2;camera[1]=q[1]-camera[3]/2;applyCamera();}
function rotateView(step){if(mode!=='iso')return;rotation=(rotation+step+4)%4;$('rotationValue').textContent=`시점 ${rotation+1} / 4`;renderMap();zoom=1;camera=baseCamera();applyCamera();$('tooltip').hidden=true;}

function refresh(){renderList();renderDetail();updateHighlights();}
function tooltipFor(el,event){
   if (el.dataset.cabinet) {
    $('tooltip').hidden = true;
    return;
  }
 let html='';if(el.dataset.cabinet){const id=Number(el.dataset.cabinet);html=`<strong>${esc(labelName('cabinet-'+id))} · ${id}번</strong>`+Object.entries(LEVELS).map(([level,title])=>{const arr=items.filter(i=>i.cabinet===id&&i.level===level);return level==='all'&&!arr.length?'':`<p>${title} — ${esc(arr.map(i=>i.name).join(' · ')||(id===1?'단별 미지정':'비어 있음'))}</p>`;}).join('');}else{html=`<strong>${esc(labelName(el.dataset.labelKey))}</strong><p>클릭하여 이름 수정</p>`;}
 const tip=$('tooltip');tip.innerHTML=html;tip.hidden=false;const frame=$('mapFrame').getBoundingClientRect(),rect=el.getBoundingClientRect(),x=(event?.clientX||rect.x+rect.width/2)-frame.x+15,y=(event?.clientY||rect.y)-frame.y+15;tip.style.left=Math.max(5,Math.min(x,frame.width-235))+'px';tip.style.top=Math.max(5,Math.min(y,frame.height-tip.offsetHeight-10))+'px';
}
$('itemCabinet').innerHTML=CABINETS.map(c=>`<option value="${c.id}">캐비닛 ${c.id}</option>`).join('');
$('search').addEventListener('input',e=>{query=e.target.value.trim();renderList();renderDetail();updateHighlights();});
document.querySelectorAll('[data-query]').forEach(btn=>btn.onclick=()=>{$('search').value=btn.dataset.query;$('search').dispatchEvent(new Event('input'));});
$('cabinetList').onclick=e=>{const btn=e.target.closest('[data-select],[data-find-seat],[data-find-asset]');if(!btn)return;if(btn.dataset.select)selectCabinet(Number(btn.dataset.select),true);else if(btn.dataset.findSeat!==undefined)focusPoint(SEATS[Number(btn.dataset.findSeat)]);else focusPoint(activeAssets().find(a=>a.key===btn.dataset.findAsset));};
$('detail').onclick=e=>{const btn=e.target.closest('button');if(!btn)return;if(btn.dataset.rename)openLabels(btn.dataset.rename);if(btn.dataset.add)openEditor(null,btn.dataset.add);if(btn.dataset.edit)openEditor(btn.dataset.edit);if(btn.dataset.delete){const i=items.find(i=>i.id===btn.dataset.delete);ask('비품을 삭제할까요?',`‘${i.name}’을(를) 캐비닛 ${i.cabinet} ${LEVELS[i.level]}에서 삭제합니다.`,()=>{items=items.filter(x=>x.id!==i.id);persist();refresh();showToast(storageProblem||'비품을 삭제했습니다.');});}};
$('editForm').onsubmit=e=>{e.preventDefault();const name=$('itemName').value.trim();if(!name){$('itemName').setCustomValidity('비품명을 입력해 주세요.');$('itemName').reportValidity();return;}const oldId=$('itemId').value,i={id:oldId||`item-${Date.now()}-${Math.random().toString(36).slice(2,10)}`,name,cabinet:Number($('itemCabinet').value),level:$('itemLevel').value,note:$('itemNote').value.trim()};const index=items.findIndex(x=>x.id===oldId);if(index>=0)items[index]=i;else items.push(i);selected=i.cabinet;persist();refresh();$('editDialog').close();showToast(storageProblem||`캐비닛 ${i.cabinet} ${LEVELS[i.level]}에 저장했습니다.`);};
$('itemName').oninput=()=>$('itemName').setCustomValidity('');
document.querySelectorAll('[data-close]').forEach(btn=>btn.onclick=()=>$(btn.dataset.close).close());
$('confirmCancel').onclick=()=>$('confirmDialog').close();$('confirmAccept').onclick=()=>{const fn=confirmAction;$('confirmDialog').close();confirmAction=null;fn?.();};
$('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(packet(),null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`office-atlas-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('JSON 백업을 내려받았습니다.');};
$('importBtn').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>5*1024*1024)throw Error('5MB 이하의 JSON 백업을 선택해 주세요.');const raw=JSON.parse(await file.text()),candidate=readState(raw);ask('백업을 가져올까요?',`현재 ${items.length}개 항목을 백업의 ${candidate.items.length}개 항목으로 교체합니다.\n${raw.schemaVersion>=2?'좌석·자산 이름도 교체합니다. 새 백업은 고정 자산의 추가·삭제도 복원합니다.':'구버전 백업이므로 현재 좌석·자산 이름은 유지합니다.'}`,()=>{try{sessionStorage.setItem(PREVIOUS_KEY,JSON.stringify(packet()));}catch(e){showToast('교체 전 자료를 보관하지 못해 가져오기를 중단했습니다. 먼저 JSON 백업을 내려받아 주세요.');return;}items=candidate.items;labels=candidate.labels;assetState=candidate.assets;persist();renderMap();refresh();showToast(storageProblem||'백업을 가져왔습니다.');});}catch(err){showToast('가져오기 실패: '+(err instanceof SyntaxError?'올바른 JSON 파일이 아닙니다.':err.message));}};
$('restoreBtn').onclick=()=>{try{const raw=sessionStorage.getItem(PREVIOUS_KEY);if(!raw){showToast('복구할 이전 가져오기 자료가 없습니다.');return;}const prev=readState(JSON.parse(raw));ask('이전 자료로 복구할까요?',`현재 자료를 직전 가져오기 전의 ${prev.items.length}개 항목과 이름으로 교체합니다.`,()=>{items=prev.items;labels=prev.labels;assetState=prev.assets;persist();renderMap();refresh();showToast(storageProblem||'이전 자료를 복구했습니다.');});}catch(e){showToast('이전 자료를 읽지 못했습니다. JSON 백업을 이용해 주세요.');}};
$('helpBtn').onclick=()=>$('helpDialog').showModal();
function renderAssets(){
 $('assetsList').innerHTML=activeAssets().filter(a=>a.key.startsWith('asset-')||a.key.startsWith('custom-')).map(a=>`<div class="asset-row"><span>${esc(labelName(a.key))}</span><button type="button" data-remove-asset="${a.key}" aria-label="${esc(labelName(a.key))} 삭제">삭제</button></div>`).join('')||'<p class="muted">등록된 고정 자산이 없습니다.</p>';
}
$('assetsBtn').onclick=()=>{renderAssets();$('assetsDialog').showModal();};
$('assetsList').onclick=e=>{const btn=e.target.closest('[data-remove-asset]');if(!btn)return;const key=btn.dataset.removeAsset;ask('고정 자산을 삭제할까요?',`‘${labelName(key)}’을(를) 지도와 고정 자산 목록에서 삭제합니다.`,()=>{if(key.startsWith('custom-')){assetState.custom=assetState.custom.filter(a=>a.key!==key);delete labels[key];}else assetState.deleted.push(key);persist();renderAssets();renderMap();refresh();showToast(storageProblem||'고정 자산을 삭제했습니다.');});};
$('assetAddForm').onsubmit=e=>{e.preventDefault();const name=$('assetName').value.trim();if(!name){$('assetName').setCustomValidity('자산 이름을 입력해 주세요.');$('assetName').reportValidity();return;}if(assetState.custom.length>=200){showToast('추가 자산은 최대 200개까지 등록할 수 있습니다.');return;}pendingAsset={name,type:$('assetType').value,w:$('assetType').value==='box'?Number($('assetWidth').value):20,d:$('assetType').value==='box'?Number($('assetDepth').value):24};setMobilePanel('map');$('assetsDialog').close();$('placementBar').hidden=false;$('map').classList.add('placing');$('tooltip').hidden=true;};
$('assetName').oninput=()=>$('assetName').setCustomValidity('');
function cancelPlacement(){pendingAsset=null;$('placementBar').hidden=true;$('map').classList.remove('placing');}
$('cancelPlacement').onclick=cancelPlacement;
document.addEventListener('keydown',e=>{if(e.key==='Escape')cancelPlacement();});
function placeAsset(e){const q=svgPoint(e);let x=q.x,y=q.y;if(mode==='iso'){const u=(q.x/.8660254+2*q.y)/2,v=(2*q.y-q.x/.8660254)/2;[x,y]=[[u,v],[v,-u],[-u,-v],[-v,u]][rotation];x+=155;y+=520;}if(x<14||x>297||y<18||y>755){showToast('지도 안의 위치를 선택해 주세요.');return;}const a={...pendingAsset,key:`custom-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,x:Math.min(297-pendingAsset.w,Math.max(14,Math.round(x-pendingAsset.w/2))),y:Math.min(755-pendingAsset.d,Math.max(18,Math.round(y-pendingAsset.d/2))),w:pendingAsset.w,d:pendingAsset.d};assetState.custom.push(a);labels[a.key]=a.name;cancelPlacement();persist();renderMap();refresh();$('assetAddForm').reset();$('assetDimensions').hidden=false;showToast(storageProblem||'고정 자산을 추가했습니다.');}
$('labelsBtn').onclick=()=>openLabels();
$('labelsForm').onsubmit=e=>{e.preventDefault();const candidate={};for(const input of document.querySelectorAll('[data-label-input]')){if(!input.value.trim()){input.setCustomValidity('이름을 입력해 주세요.');input.reportValidity();return;}candidate[input.dataset.labelInput]=input.value.trim();}labels=validateLabels(candidate);persist();renderMap();refresh();$('labelsDialog').close();showToast(storageProblem||'이름을 저장했습니다. 지도와 검색에 반영했습니다.');};
$('labelsFields').oninput=e=>e.target.setCustomValidity?.('');
$('rotateLeft').onclick=()=>rotateView(-1);$('rotateRight').onclick=()=>rotateView(1);
function setMode(value){mode=value;$('isoBtn').setAttribute('aria-pressed',value==='iso');$('planBtn').setAttribute('aria-pressed',value==='plan');$('viewTag').textContent=value==='iso'?'아이소메트릭 · 네 방향 보기':'도면 기준 · 평면 보기';$('rotateLeft').disabled=value==='plan';$('rotateRight').disabled=value==='plan';$('rotationValue').textContent=value==='plan'?'평면 고정':`시점 ${rotation+1} / 4`;full=false;renderMap();resetCamera();}
$('isoBtn').onclick=()=>setMode('iso');$('planBtn').onclick=()=>setMode('plan');$('namesToggle').onchange=e=>$('scene').classList.toggle('hide-names',!e.target.checked);
$('zoomIn').onclick=()=>zoomBy(1.2);$('zoomOut').onclick=()=>zoomBy(1/1.2);$('fitBtn').onclick=()=>resetCamera();$('fullBtn').onclick=()=>resetCamera(true);
let drag=null,suppressClick=false;
function svgPoint(e){const v=$('map').createSVGPoint();v.x=e.clientX;v.y=e.clientY;return v.matrixTransform($('map').getScreenCTM().inverse());}
$('map').addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,original:camera.slice(),point:svgPoint(e),moved:false,id:e.pointerId};});
$('map').addEventListener('pointermove',e=>{if(drag){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5){if(!drag.moved){$('map').setPointerCapture(e.pointerId);drag.moved=true;$('map').classList.add('dragging');}const pt=svgPoint(e);camera[0]+=drag.point.x-pt.x;camera[1]+=drag.point.y-pt.y;applyCamera();$('tooltip').hidden=true;}return;}const el=e.target.closest('[data-cabinet],[data-label-key]');if(el)tooltipFor(el,e);else $('tooltip').hidden=true;});
function endDrag(){if(drag){suppressClick=drag.moved;if($('map').hasPointerCapture(drag.id))$('map').releasePointerCapture(drag.id);}drag=null;$('map').classList.remove('dragging');setTimeout(()=>suppressClick=false,0);}
$('map').addEventListener('pointerup',endDrag);$('map').addEventListener('pointercancel',endDrag);$('map').addEventListener('pointerleave',()=>{$('tooltip').hidden=true;if(drag&&!drag.moved)drag=null;});
$('map').addEventListener('click',e=>{if(suppressClick)return;if(pendingAsset){placeAsset(e);return;}const el=e.target.closest('[data-cabinet],[data-label-key]');if(el?.dataset.cabinet)selectCabinet(Number(el.dataset.cabinet));else if(el?.dataset.labelKey)openLabels(el.dataset.labelKey);});
$('map').addEventListener('wheel',e=>{e.preventDefault();zoomBy(e.deltaY<0?1.08:1/1.08);},{passive:false});
$('map').addEventListener('focusin',e=>{const el=e.target.closest('[data-cabinet],[data-label-key]');if(el)tooltipFor(el);});$('map').addEventListener('focusout',()=>$('tooltip').hidden=true);
$('map').addEventListener('keydown',e=>{const el=e.target.closest('[data-cabinet],[data-label-key]');if(el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(el.dataset.cabinet)selectCabinet(Number(el.dataset.cabinet));else openLabels(el.dataset.labelKey);}if(e.key==='Escape')$('tooltip').hidden=true;});
renderMap();resetCamera();refresh();updateSaveStatus();

function setMobilePanel(panel){document.body.dataset.mobilePanel=panel;document.querySelectorAll('[data-mobile-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mobilePanel===panel)));}
document.querySelectorAll('[data-mobile-panel]').forEach(b=>b.onclick=()=>setMobilePanel(b.dataset.mobilePanel));
setMobilePanel('map');
$('assetType').onchange=()=>{$('assetDimensions').hidden=$('assetType').value!=='box';};

// 모바일 두 손가락 확대·축소
(() => {
  const map = document.getElementById('map');
  let pinching = false;
  let previousDistance = 0;
  let blockClickUntil = 0;

  const distance = touches => Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );

  // 확대 중에는 기존 한 손가락 이동 처리를 중단합니다.
  for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
    map.addEventListener(type, event => {
      if (pinching && event.pointerType === 'touch') {
        event.stopImmediatePropagation();
      }
    }, true);
  }

  map.addEventListener('touchstart', event => {
    if (event.touches.length !== 2) return;

    pinching = true;
    previousDistance = distance(event.touches);
    drag = null;
    map.classList.remove('dragging');
    document.getElementById('tooltip').hidden = true;
    event.preventDefault();
  }, { passive: false });

  map.addEventListener('touchmove', event => {
    if (!pinching) return;
    event.preventDefault();

    if (event.touches.length !== 2) return;
    const nextDistance = distance(event.touches);

    if (previousDistance > 0) {
      zoomBy(nextDistance / previousDistance);
    }
    previousDistance = nextDistance;
  }, { passive: false });

  function finishPinch(event) {
    if (!pinching) return;

    blockClickUntil = Date.now() + 500;
    if (event.touches.length === 0) {
      pinching = false;
      previousDistance = 0;
      drag = null;
    }
  }

  map.addEventListener('touchend', finishPinch);
  map.addEventListener('touchcancel', finishPinch);

  // 확대 직후 캐비닛이 실수로 선택되는 것을 방지합니다.
  map.addEventListener('click', event => {
    if (pinching || Date.now() < blockClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})();
