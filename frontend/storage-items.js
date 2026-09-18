'use strict';
// Load after app.js and before cloud.js. Inventory is part of the asset record,
// so the existing shared-store conflict checks and JSON backups also protect it.
(() => {
  const storage = key => assetState.custom.find(a => a.key === key && a.type === 'storage');
  const matches = a => !query || norm(labelName(a.key)+' '+(a.inventory || []).map(i => i.name+' '+i.note).join(' ')).includes(norm(query));
  const originalValidate = validateAssets;
  validateAssets = function(value) {
    const result = originalValidate(value);
    for (let index=0; index<result.custom.length; index++) {
      const source = value.custom[index];
      if (!Object.hasOwn(source, 'inventory')) continue;
      const list = source.inventory, ids = new Set();
      if (source.type !== 'storage' || !Array.isArray(list) || list.length > 100) throw Error('수납장 비품 목록이 올바르지 않습니다.');
      for (const i of list) {
        if (!i || typeof i.id !== 'string' || !i.id.trim() || i.id.length>150 || ids.has(i.id) || typeof i.name !== 'string' || !i.name.trim() || i.name.length>120 || typeof i.note !== 'string' || i.note.length>500) throw Error('수납장 비품의 이름과 메모를 확인해 주세요.');
        ids.add(i.id);
      }
      result.custom[index].inventory = structuredClone(list);
      if (new TextEncoder().encode(JSON.stringify(result.custom[index])).length > 30000) throw Error('수납장 비품 메모가 너무 많습니다. 내용을 줄여 주세요.');
    }
    return result;
  };

  const dialog = document.createElement('dialog');
  dialog.id = 'storageInventoryDialog';
  dialog.style.cssText = 'width:min(560px,calc(100vw - 20px));max-height:85dvh;overflow-y:auto;touch-action:pan-y';
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="storageInventoryTitle"></h2><button type="button" id="storageInventoryClose" aria-label="닫기">×</button></div>
    <p class="muted">칸 구분 없이 비품을 보관합니다. 최대 100개까지 등록할 수 있습니다.</p>
    <button type="button" id="storageInventoryRename" class="text-btn">수납장 이름 수정</button>
    <div id="storageInventoryList"></div>
    <form id="storageInventoryForm">
      <h3 id="storageInventoryFormTitle" style="margin-top:20px">비품 추가</h3>
      <input type="hidden" id="storageInventoryId">
      <label>비품명<input id="storageInventoryName" maxlength="120" required></label>
      <label>메모<textarea id="storageInventoryNote" maxlength="500" rows="2"></textarea></label>
      <div class="dialog-actions"><button type="button" id="storageInventoryReset">새 비품 입력</button><button type="submit" class="primary">저장</button></div>
    </form>`;
  document.body.append(dialog);
  let activeKey = null;
  const reset = () => { $('storageInventoryForm').reset(); $('storageInventoryId').value=''; $('storageInventoryFormTitle').textContent='비품 추가'; };
  function open(key) {
    const asset=storage(key); if (!asset) return;
    activeKey=key; reset();
    $('storageInventoryTitle').textContent=labelName(key)+' · 보관 비품';
    $('storageInventoryList').innerHTML=(asset.inventory || []).map(i => `<div class="item"><p class="item-name">${esc(i.name)}</p><p class="item-note">${esc(i.note)}</p><div class="item-actions"><button type="button" data-storage-edit="${esc(i.id)}">수정</button><button type="button" data-storage-delete="${esc(i.id)}">삭제</button></div></div>`).join('') || '<p class="empty">등록된 비품이 없습니다.</p>';
    $('tooltip').hidden=true;
    dialog.showModal();
  }
  function save(list) {
    const asset=storage(activeKey); if(!asset){showToast('수납장이 없어졌습니다. 다시 확인해 주세요.');return;}
    const next=structuredClone(assetState);
    next.custom.find(a=>a.key===activeKey).inventory=list;
    try { assetState=validateAssets(next); }
    catch(error){showToast(error.message);return;}
    // Close the editor so the normal cloud ACK can restore accepted state.
    dialog.close(); persist(); renderMap(); refresh();
  }
  $('storageInventoryClose').onclick=()=>dialog.close();
  $('storageInventoryReset').onclick=reset;
  $('storageInventoryRename').onclick=()=>{dialog.close();openLabels(activeKey);};
  $('storageInventoryForm').onsubmit=e=>{
    e.preventDefault();
    const name=$('storageInventoryName').value.trim(); if(!name)return;
    const asset=storage(activeKey); if(!asset)return;
    const list=structuredClone(asset.inventory || []), id=$('storageInventoryId').value;
    const entry={id:id || crypto.randomUUID(),name,note:$('storageInventoryNote').value.trim()};
    const index=list.findIndex(i=>i.id===id);
    if(id && index<0){showToast('비품을 다시 선택해 주세요.');return;}
    if(index>=0)list[index]=entry;else list.push(entry);
    save(list);
  };
  $('storageInventoryList').onclick=e=>{
    const button=e.target.closest('[data-storage-edit],[data-storage-delete]');if(!button)return;
    const list=storage(activeKey)?.inventory || [];
    const id=button.dataset.storageEdit || button.dataset.storageDelete;
    const item=list.find(i=>i.id===id);if(!item)return;
    if(button.hasAttribute('data-storage-edit')){
      $('storageInventoryId').value=id;$('storageInventoryName').value=item.name;$('storageInventoryNote').value=item.note;
      $('storageInventoryFormTitle').textContent='비품 수정';$('storageInventoryName').focus();
    }else{
      ask('비품을 삭제할까요?',`‘${item.name}’을(를) 수납장에서 삭제합니다.`,()=>save(list.filter(i=>i.id!==id)));
    }
  };

  // Capture before the original map handler opens the asset-name editor.
  function intercept(e) {
    if(pendingAsset || suppressClick)return;
    if(e.type==='keydown' && !['Enter',' '].includes(e.key))return;
    const key=e.target.closest('[data-label-key]')?.dataset.labelKey;
    if(!storage(key))return;
    e.preventDefault();e.stopImmediatePropagation();open(key);
  }
  $('map').addEventListener('click',intercept,true);
  $('map').addEventListener('keydown',intercept,true);
  $('cabinetList').addEventListener('click',e=>{
    const button=e.target.closest('[data-storage-open],[data-find-asset]');
    const key=button?.dataset.storageOpen || button?.dataset.findAsset;
    if(!storage(key))return;
    e.preventDefault();e.stopImmediatePropagation();open(key);
  },true);
  $('assetsList').addEventListener('click',e=>{
    const key=e.target.closest('[data-remove-asset]')?.dataset.removeAsset;
    if(!(storage(key)?.inventory || []).length)return;
    e.preventDefault();e.stopImmediatePropagation();
    showToast('보관 중인 비품을 먼저 삭제한 뒤 수납장을 삭제해 주세요.');
  },true);
  const originalList=renderList;
  renderList=function(){
    originalList();
    for(const a of assetState.custom.filter(a=>a.type==='storage' && matches(a))){
      // Replace an existing asset-name search hit rather than duplicate it.
      $('cabinetList').querySelector(`[data-find-asset="${a.key}"]`)?.remove();
      $('cabinetList').querySelector('.empty')?.remove();
      $('cabinetList').insertAdjacentHTML('beforeend',`<button class="cabinet-link" data-storage-open="${a.key}"><span class="number-chip">▤</span><span class="cabinet-text"><strong>${esc(labelName(a.key))}</strong><small>수납장 · 비품 ${(a.inventory || []).length}개</small></span></button>`);
    }
  };
  const originalHighlights=updateHighlights;
  updateHighlights=function(){
    originalHighlights();
    for(const el of document.querySelectorAll('.asset-object[data-label-key],.asset-label[data-label-key]')){
      const a=storage(el.dataset.labelKey);if(a)el.classList.toggle('asset-match',!!query && matches(a));
    }
  };
  refresh();
})();
