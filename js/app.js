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
  renderActionPlanHistory(); // Added new history rendering
}

/* ---------- ACTION PLANS ---------- */
function buildPlansPanel() {
  const panel = document.getElementById('plansPanel'); if (!panel) return;
  panel.innerHTML = ''; const frag = document.createDocumentFragment();
  for (let i = 0; i < state.categories.length; i++) {
    const row = document.createElement('div'); row.className = 'plan-row';
    row.innerHTML = `<div class="plan-head"><div class="plan-title">${state.categories[i]}</div><div class="plan-score">${state.values[i].toFixed(1)}</div></div>
                     <div class="plan-fields">
                       <div class="plan-field">
                         <label>Overall Goal</label>
                         <textarea class="step-input" data-cat="${i}" data-field="goal" placeholder="What is your ultimate goal here?">${state.steps[i]?.goal || ''}</textarea>
                       </div>
                       <div class="plan-field">
                         <label>Current Step</label>
                         <input type="text" class="step-input" data-cat="${i}" data-field="current" placeholder="What are you doing right now?" value="${state.steps[i]?.current || ''}">
                       </div>
                       <div class="plan-field">
                         <label>Next Step</label>
                         <input type="text" class="step-input" data-cat="${i}" data-field="next" placeholder="What is the next immediate action?" value="${state.steps[i]?.next || ''}">
                       </div>
                     </div>`;
    frag.appendChild(row);
  }
  panel.appendChild(frag);
}

document.getElementById('plansPanel').addEventListener('change', (e) => {
  if (e.target.classList.contains('step-input')) {
    const cat = parseInt(e.target.dataset.cat);
    const field = e.target.dataset.field;
    state.steps[cat][field] = e.target.value;
    saveLocal();
  }
});

/* ---------- ACTION PLAN HISTORY ---------- */
function renderActionPlanHistory() {
    const container = document.getElementById('actionPlanHistoryList');
    if (!container) return;
    container.innerHTML = '';
    
    if (!state.snapshots || state.snapshots.length === 0) {
        container.innerHTML = '<div class="small">No snapshots taken yet.</div>';
        return;
    }

    // Loop backwards to show the newest snapshots at the top
    for (let i = state.snapshots.length - 1; i >= 0; i--) {
        const snap = state.snapshots[i];
        if (!snap.steps) continue; // Skip legacy snapshots that have no step data

        const dateStr = new Date(snap.ts).toLocaleString();
        const snapDiv = document.createElement('div');
        snapDiv.className = 'action-history-item';
        
        let contentHTML = `<div class="action-history-date">Snapshot: ${dateStr}</div>`;
        let hasData = false;

        for (let c = 0; c < snap.categories.length; c++) {
            const stepData = snap.steps[c];
            // Only render categories where the user actually typed something
            if (stepData && (stepData.goal || stepData.current || stepData.next)) {
                hasData = true;
                contentHTML += `
                    <div class="action-history-cat">
                        <strong>${snap.categories[c]}</strong>
                        ${stepData.goal ? `<div class="action-history-text"><b>Goal:</b> ${stepData.goal}</div>` : ''}
                        ${stepData.current ? `<div class="action-history-text"><b>Current:</b> ${stepData.current}</div>` : ''}
                        ${stepData.next ? `<div class="action-history-text"><b>Next:</b> ${stepData.next}</div>` : ''}
                    </div>
                `;
            }
        }
        
        if (hasData) {
            snapDiv.innerHTML = contentHTML;
            container.appendChild(snapDiv);
        }
    }
    if (container.innerHTML === '') {
        container.innerHTML = '<div class="small">No action plan data saved in snapshots yet.</div>';
    }
}

/* ---------- MODAL ---------- */
const modalOverlay = document.getElementById('modalOverlay');

function openModal() { 
    modalOverlay.style.display = 'grid'; 
    modalOverlay.setAttribute('aria-hidden', 'false'); 
    buildEditList(); 
}

function closeModal() { 
    modalOverlay.style.display = 'none'; 
    modalOverlay.setAttribute('aria-hidden', 'true'); 
}

document.getElementById('btnEditCats').addEventListener('click', openModal);
document.getElementById('btnCloseModal').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

// Centralized modal operations
function deleteCategoryAt(idx) {
    if (idx < 0 || idx >= state.categories.length) return;
    state.categories.splice(idx, 1); 
    state.values.splice(idx, 1); 
    state.notes.splice(idx, 1); 
    state.steps.splice(idx, 1);
    
    ensureArrayLengths(); 
    saveLocal(); 
    drawBase(); 
    onWheelDataCommitted(); 
    buildEditList(); 
    showToast('Category deleted.');
}

function moveCategory(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= state.categories.length) return;
    swapCategory(idx, newIdx); 
    buildEditList();
}

function renameCategoryAt(idx, name) {
    state.categories[idx] = name || `Category ${idx + 1}`;
    saveLocal(); 
    drawBase(); 
    onWheelDataCommitted();
    buildEditList();
}

function buildEditList() {
    const list = document.getElementById('editList'); 
    list.innerHTML = '';
    
    for (let i = 0; i < state.categories.length; i++) {
        const row = document.createElement('div'); 
        row.className = 'edit-row'; 
        row.dataset.index = i.toString();
        
        const drag = document.createElement('span'); 
        drag.textContent = '↕'; 
        drag.title = 'Use ↑ ↓ buttons to reorder'; 
        drag.style.opacity = '0.6';
        
        const input = document.createElement('input'); 
        input.type = 'text'; 
        input.value = state.categories[i];
        input.addEventListener('change', () => { 
            const idx = parseInt(row.dataset.index, 10); 
            renameCategoryAt(idx, input.value); 
        });
        
        const controls = document.createElement('div'); 
        controls.style.display = 'flex'; 
        controls.style.gap = '6px';
        
        const up = document.createElement('button'); 
        up.className = 'btn'; 
        up.textContent = '↑'; 
        up.addEventListener('click', () => { 
            const idx = parseInt(row.dataset.index, 10); 
            moveCategory(idx, -1); 
        });
        
        const down = document.createElement('button'); 
        down.className = 'btn'; 
        down.textContent = '↓'; 
        down.addEventListener('click', () => { 
            const idx = parseInt(row.dataset.index, 10); 
            moveCategory(idx, +1); 
        });
        
        const del = document.createElement('button'); 
        del.className = 'btn danger'; 
        del.textContent = 'Delete'; 
        del.addEventListener('click', () => { 
            const idx = parseInt(row.dataset.index, 10); 
            deleteCategoryAt(idx); 
        });
        
        controls.appendChild(up); controls.appendChild(down); controls.appendChild(del);
        row.appendChild(drag); row.appendChild(input); row.appendChild(controls); 
        list.appendChild(row);
    }
}

function swapCategory(a, b) {
    [state.categories[a], state.categories[b]] = [state.categories[b], state.categories[a]];
    [state.values[a], state.values[b]] = [state.values[b], state.values[a]];
    [state.notes[a], state.notes[b]] = [state.notes[b], state.notes[a]];
    [state.steps[a], state.steps[b]] = [state.steps[b], state.steps[a]];
    saveLocal(); 
    drawBase();
    onWheelDataCommitted();
}

// Modal actions: Add Category & Reset to Defaults
document.getElementById('btnAddCategory').addEventListener('click', () => {
    const nextIndex = state.categories.length;
    state.categories.push(`Category ${nextIndex + 1}`);
    state.values.push(5);
    state.notes.push('');
    // Push the new object format for the Action Plans
    state.steps.push({ goal: '', current: '', next: '' });
    
    saveLocal();
    drawBase();
    onWheelDataCommitted();
    buildEditList();
});

document.getElementById('btnResetCategories').addEventListener('click', () => {
    if (!confirm('Reset categories to defaults? This will overwrite names and reset scores to 5.')) return;
    state.categories = [...DEFAULT_CATEGORIES];
    state.values = new Array(state.categories.length).fill(5);
    state.notes = new Array(state.categories.length).fill('');
    // Reset to the new object format for the Action Plans
    state.steps = new Array(state.categories.length).fill(null).map(() => ({ goal: '', current: '', next: '' }));
    
    saveLocal();
    drawBase();
    onWheelDataCommitted();
    buildEditList();
});

/* ---------- TOOLBAR ---------- */
document.getElementById('btnSave').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ ...state, savedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'wheel-of-life.json'; document.body.appendChild(a); a.click(); a.remove(); showToast('State saved to file.');
});
// (Wire up btnLoad, btnNew, btnExportSnaps, btnImportSnaps here the same way as your monolith, calling `refreshAllHistoryViews()` when snapshots change)

document.getElementById('btnSnapshot').addEventListener('click', () => {
    // Deep clone steps to preserve the text at the time of snapshot
    const stepsCopy = JSON.parse(JSON.stringify(state.steps)); 
    state.snapshots.push({ ts: Date.now(), categories: [...state.categories], values: state.values.map(v => roundTo(v, STEP_FINE)), steps: stepsCopy });
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
  initOnboarding();
}
/* ---------- ONBOARDING / TOUR ---------- */
function initOnboarding() {
  const hasSeenTour = localStorage.getItem('wheelOfLifeTourSeen');
  const overlay = document.getElementById('onboardingOverlay');
  
  // If they haven't seen it, show the overlay
  if (!hasSeenTour && overlay) {
    overlay.style.display = 'grid';
  }

  function closeTour() {
    if (overlay) overlay.style.display = 'none';
    localStorage.setItem('wheelOfLifeTourSeen', 'true'); // Save flag so it doesn't show again
  }

  function showStep(stepIndex) {
    document.querySelectorAll('.tour-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`tourStep${stepIndex}`).classList.add('active');
  }

  // Event Listeners for Tour
  document.getElementById('btnStartTour')?.addEventListener('click', () => showStep(1));
  document.getElementById('btnFinishTour')?.addEventListener('click', closeTour);
  
  // Handle multiple skip buttons
  document.querySelectorAll('.btnSkipTour').forEach(btn => {
    btn.addEventListener('click', closeTour);
  });

  // Handle next buttons
  document.querySelectorAll('.btnNextTour').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const nextStep = e.target.getAttribute('data-next');
      showStep(nextStep);
    });
  });
}
/* ---------- HELP MODAL & RESTART TOUR ---------- */
const helpOverlay = document.getElementById('helpOverlay');
const onboardingOverlay = document.getElementById('onboardingOverlay');

// Open Help Modal
document.getElementById('btnHelp')?.addEventListener('click', () => {
  if (helpOverlay) helpOverlay.style.display = 'grid';
});

// Close Help Modal
document.getElementById('btnCloseHelp')?.addEventListener('click', () => {
  if (helpOverlay) helpOverlay.style.display = 'none';
});

// Restart Tour from Help Modal
document.getElementById('btnRestartTour')?.addEventListener('click', () => {
  // Close the Help modal
  if (helpOverlay) helpOverlay.style.display = 'none';
  
  // Reset the tour to Step 0 and open the Onboarding overlay
  document.querySelectorAll('.tour-step').forEach(el => el.classList.remove('active'));
  const step0 = document.getElementById('tourStep0');
  if (step0) step0.classList.add('active');
  
  if (onboardingOverlay) onboardingOverlay.style.display = 'grid';
});
init();
