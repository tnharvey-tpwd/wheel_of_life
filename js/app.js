import { state, loadLocal, saveLocal, loadSnapshots, saveSnapshots, ensureArrayLengths, STATE_KEY } from './state.js';
import { MAX_VALUE, disabledCountForValue, roundTo, STEP_FINE, DEFAULT_CATEGORIES } from './utils.js';
import { initWheel, drawBase } from './wheel.js';
import { buildHistoryTable, refreshHistoryControls, drawHistoryCharts, updateDeltaTable } from './charts.js';

/* ---------- UX ---------- */
function showToast(msg) {
  const toast = document.getElementById('toast'); toast.textContent = msg;
  toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ---------- ORCHESTRATION ---------- */
function onWheelDataCommitted() {
  buildPlansPanel();
  try { drawHistoryCharts(); } catch(e){}
  updateDeltaTable();
}

function refreshAllHistoryViews() {
  buildHistoryTable(refreshAllHistoryViews); 
  refreshHistoryControls(); 
  try { drawHistoryCharts(); } catch(e){} 
  updateDeltaTable();
}

/* ---------- ACTION PLANS ---------- */
function buildPlansPanel() {
  const panel = document.getElementById('plansPanel'); if (!panel) return;
  panel.innerHTML = ''; const frag = document.createDocumentFragment();
  for (let i = 0; i < state.categories.length; i++) {
    const row = document.createElement('div'); row.className = 'plan-row';
    const disabledCount = disabledCountForValue(state.values[i]);
    row.innerHTML = `<div class="plan-head"><div class="plan-title">${state.categories[i]}</div><div class="plan-score">${state.values[i].toFixed(1)}</div></div>
                     <div class="steps-header">Steps to write: ${MAX_VALUE - disabledCount}</div>`;
    const grid = document.createElement('div'); grid.className = 'steps-grid';
    for (let j = 0; j < MAX_VALUE; j++) {
      const wrap = document.createElement('div'); wrap.className = 'step-wrap';
      wrap.innerHTML = `<div class="step-label">Step ${j + 1}</div>
                        <input type="text" class="step" placeholder="Plan for level ${j + 1}" value="${state.steps[i][j] || ''}" data-cat="${i}" data-step="${j}" ${j < disabledCount ? 'disabled' : ''}>`;
      grid.appendChild(wrap);
    }
    row.appendChild(grid); frag.appendChild(row);
  }
  panel.appendChild(frag);
}

document.getElementById('plansPanel').addEventListener('change', (e) => {
  if (e.target.classList.contains('step')) {
    state.steps[parseInt(e.target.dataset.cat)][parseInt(e.target.dataset.step)] = e.target.value; saveLocal();
  }
});

/* ---------- MODAL ---------- */
const modalOverlay = document.getElementById('modalOverlay');
function trapFocus(e) { /* Paste trapFocus logic here */ }
function openModal() { modalOverlay.style.display = 'grid'; buildEditList(); document.addEventListener('keydown', trapFocus); }
function closeModal() { modalOverlay.style.display = 'none'; document.removeEventListener('keydown', trapFocus); }
document.getElementById('btnEditCats').addEventListener('click', openModal);
document.getElementById('btnCloseModal').addEventListener('click', closeModal);

function buildEditList() {
    /* Paste buildEditList, renameCategory, moveCategory, deleteCategory logic here, ensuring you call `ensureArrayLengths(); saveLocal(); drawBase(); onWheelDataCommitted();` after changes */
}

/* ---------- TOOLBAR ---------- */
document.getElementById('btnSave').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ ...state, savedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'wheel-of-life.json'; document.body.appendChild(a); a.click(); a.remove(); showToast('State saved to file.');
});
// (Wire up btnLoad, btnNew, btnSnapshot, btnExportSnaps, btnImportSnaps here the same way as your monolith, calling `refreshAllHistoryViews()` when snapshots change)

document.getElementById('btnSnapshot').addEventListener('click', () => {
    state.snapshots.push({ ts: Date.now(), categories: [...state.categories], values: state.values.map(v => roundTo(v, STEP_FINE)) });
    saveSnapshots(); refreshAllHistoryViews(); showToast('Snapshot saved locally.');
});

/* ---------- TABS ---------- */
const tabs = document.querySelectorAll('.tab');
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === t.dataset.tab));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + t.dataset.tab));
  if (t.dataset.tab === 'history') refreshAllHistoryViews();
  if (t.dataset.tab === 'actions') buildPlansPanel();
}));

/* ---------- INIT ---------- */
function init() {
  if (!loadLocal()) { ensureArrayLengths(); }
  loadSnapshots();
  initWheel(onWheelDataCommitted); // Pass the callback to the wheel
  onWheelDataCommitted(); // Initial render of side-effects
}
init();
