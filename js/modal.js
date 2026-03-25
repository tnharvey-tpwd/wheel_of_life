// js/modal.js
import { state, DEFAULT_CATEGORIES, ensureArrayLengths, saveLocal } from './state.js';
import { drawWheel, updateLegend, updateStats, moveHandlesToValues, buildA11yControls, updateBands } from './wheel.js';

export function openModal(modalOverlay, buildEditList){
  modalOverlay.style.display='grid'; modalOverlay.setAttribute('aria-hidden','false'); buildEditList();
}
export function closeModal(modalOverlay){
  modalOverlay.style.display='none'; modalOverlay.setAttribute('aria-hidden','true');
}

export function buildEditList(editListEl, dom, onValueChanged){
  editListEl.innerHTML='';
  for(let i=0;i<state.categories.length;i++){
    const row=document.createElement('div'); row.className='edit-row'; row.dataset.index = i.toString();
    const drag=document.createElement('span'); drag.textContent='↕'; drag.title='Use ↑ ↓ buttons to reorder'; drag.style.opacity='0.6';
    const input=document.createElement('input'); input.type='text'; input.value=state.categories[i];
    input.addEventListener('change',()=>{ const idx = parseInt(row.dataset.index,10); renameCategoryAt(idx, input.value, dom, onValueChanged); });
    const controls=document.createElement('div'); controls.style.display='flex'; controls.style.gap='6px';
    const up=document.createElement('button'); up.className='btn'; up.textContent='↑'; up.addEventListener('click',()=>{ const idx = parseInt(row.dataset.index,10); moveCategory(idx, -1, dom, onValueChanged); });
    const down=document.createElement('button'); down.className='btn'; down.textContent='↓'; down.addEventListener('click',()=>{ const idx = parseInt(row.dataset.index,10); moveCategory(idx, +1, dom, onValueChanged); });
    const del=document.createElement('button'); del.className='btn danger'; del.textContent='Delete'; del.addEventListener('click',()=>{ const idx = parseInt(row.dataset.index,10); deleteCategoryAt(idx, editListEl, dom, onValueChanged); });
    controls.appendChild(up); controls.appendChild(down); controls.appendChild(del);
    row.appendChild(drag); row.appendChild(input); row.appendChild(controls); editListEl.appendChild(row);
  }
}

export function deleteCategoryAt(idx, editListEl, dom, onValueChanged){
  if(idx<0 || idx>=state.categories.length) return;
  state.categories.splice(idx,1); state.values.splice(idx,1); state.notes.splice(idx,1); state.steps.splice(idx,1);
  ensureArrayLengths(); saveLocal();
  drawWheel(dom); updateLegend(dom); updateStats(dom); moveHandlesToValues(dom); updateBands(dom);
  buildA11yControls(dom, onValueChanged);
  buildEditList(editListEl, dom, onValueChanged);
}
export function moveCategory(idx, dir, dom, onValueChanged){
  const newIdx = idx + dir;
  if(newIdx<0 || newIdx>=state.categories.length) return;
  swapCategory(idx, newIdx);
  drawWheel(dom); updateLegend(dom); updateStats(dom); moveHandlesToValues(dom); updateBands(dom);
  buildA11yControls(dom, onValueChanged);
  buildEditList(document.getElementById('editList'), dom, onValueChanged);
}
export function renameCategoryAt(idx, name, dom, onValueChanged){
  state.categories[idx] = name || `Category ${idx+1}`;
  saveLocal();
  drawWheel(dom); updateLegend(dom); updateStats(dom); moveHandlesToValues(dom); updateBands(dom);
  buildA11yControls(dom, onValueChanged);
  buildEditList(document.getElementById('editList'), dom, onValueChanged);
}
export function swapCategory(a,b){
  [state.categories[a],state.categories[b]]=[state.categories[b],state.categories[a]];
  [state.values[a],state.values[b]]=[state.values[b],state.values[a]];
  [state.notes[a],state.notes[b]]=[state.notes[b],state.notes[a]];
  [state.steps[a],state.steps[b]]=[state.steps[b],state.steps[a]];
  saveLocal();
}
export function addCategory(dom, onValueChanged){
  const nextIndex = state.categories.length;
  state.categories.push(`Category ${nextIndex + 1}`);
  state.values.push(5);
  state.notes.push('');
  state.steps.push(new Array(10).fill(''));
  saveLocal();
  drawWheel(dom); updateLegend(dom); updateStats(dom); moveHandlesToValues(dom); updateBands(dom);
  buildA11yControls(dom, onValueChanged);
}
export function resetCategories(dom, onValueChanged){
  if (!confirm('Reset categories to defaults? This will overwrite names and reset scores to 5.')) return;
  state.categories = [...DEFAULT_CATEGORIES];
  state.values = new Array(state.categories.length).fill(5);
  state.notes = new Array(state.categories.length).fill('');
  state.steps = new Array(state.categories.length).fill(null).map(() => new Array(10).fill(''));
  saveLocal();
  drawWheel(dom); updateLegend(dom); updateStats(dom); moveHandlesToValues(dom); updateBands(dom);
  buildA11yControls(dom, onValueChanged);
}