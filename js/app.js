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
function trapFocus(e) { /* Paste trapFocus logic here */ }
function openModal() { modalOverlay.style.display = 'grid'; buildEditList(); document.addEventListener('keydown', trapFocus); }
function closeModal() { modalOverlay.style.display = 'none'; document.removeEventListener('keydown', trapFocus); }
document.getElementById('btnEditCats').addEventListener('click', openModal);
document.getElementById('btnCloseModal').addEventListener('click', closeModal);

    /* ---------- Export current wheel ---------- */
    function svgInlineStyle(){
      return `.ring{stroke:#29305a;fill:none}.axis{stroke:#34406f;stroke-width:1.25}.tick{stroke:#2f3967;stroke-width:.9}.cat-label{font-size:12px;fill:#b9c2ff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}.handle{fill:#ffd166;stroke:#2d244f;stroke-width:2}.center-dot{fill:#8fd3ff;opacity:.7}.overlay{fill:transparent}.band{stroke:#2a325b;stroke-width:.6;stroke-linejoin:round}`;
    }
    function exportPNG(){
      const clone=svgEl.cloneNode(true);
      const style=document.createElementNS('http://www.w3.org/2000/svg','style'); style.setAttribute('type','text/css'); style.textContent=svgInlineStyle();
      const defs=clone.querySelector('defs'); if(defs){ defs.parentNode.insertBefore(style, defs.nextSibling); } else { clone.insertBefore(style, clone.firstChild); }
      const serializer=new XMLSerializer(); let svgStr=serializer.serializeToString(clone);
      if(!svgStr.includes('xmlns="http://www.w3.org/2000/svg"')) svgStr=svgStr.replace('<svg','<svg xmlns="http://www.w3.org/2000/svg"');
      const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgStr);
      const canvas=document.createElement('canvas'); canvas.width=SIZE; canvas.height=SIZE; const ctx=canvas.getContext('2d');
      const img=new Image(); img.onload=()=>{ ctx.clearRect(0,0,SIZE,SIZE); ctx.drawImage(img,0,0,SIZE,SIZE); const png=canvas.toDataURL('image/png'); const a=document.createElement('a'); a.href=png; const d=new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'); a.download=`wheel-of-life-${d}.png`; document.body.appendChild(a); a.click(); a.remove(); };
      img.onerror=()=>alert('Export failed: browser blocked inline SVG rasterization.'); img.src=url;
    }

    /* ---------- Category modal ---------- */
    const modalOverlay=document.getElementById('modalOverlay');
    function openModal(){ modalOverlay.style.display='grid'; modalOverlay.setAttribute('aria-hidden','false'); buildEditList(); }
    function closeModal(){ modalOverlay.style.display='none'; modalOverlay.setAttribute('aria-hidden','true'); }
    document.getElementById('btnEditCats').addEventListener('click', openModal);
    document.getElementById('btnCloseModal').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click',(e)=>{ if(e.target===modalOverlay) closeModal(); });

    // Centralized modal operations (fixes immediate update issues)
    function deleteCategoryAt(idx){
      if(idx<0 || idx>=categories.length) return;
      categories.splice(idx,1); values.splice(idx,1); notes.splice(idx,1); steps.splice(idx,1);
      ensureArrayLengths(); saveLocal(); drawBase(); buildEditList(); announce('Category deleted.');
    }
    function moveCategory(idx, dir){
      const newIdx = idx + dir;
      if(newIdx<0 || newIdx>=categories.length) return;
      swapCategory(idx, newIdx); // includes saveLocal + drawBase
      buildEditList();
    }
    function renameCategoryAt(idx, name){
      categories[idx] = name || `Category ${idx+1}`;
      saveLocal(); drawBase(); buildEditList();
    }

    function buildEditList(){
      const list=document.getElementById('editList'); list.innerHTML='';
      for(let i=0;i<categories.length;i++){
        const row=document.createElement('div'); row.className='edit-row'; row.dataset.index = i.toString();
        const drag=document.createElement('span'); drag.textContent='↕'; drag.title='Use ↑ ↓ buttons to reorder'; drag.style.opacity='0.6';
        const input=document.createElement('input'); input.type='text'; input.value=categories[i];
        input.addEventListener('change',()=>{ const idx = parseInt(row.dataset.index,10); renameCategoryAt(idx, input.value); });
        const controls=document.createElement('div'); controls.style.display='flex'; controls.style.gap='6px';
        const up=document.createElement('button'); up.className='btn'; up.textContent='↑'; up.addEventListener('click',()=>{ const idx = parseInt(row.dataset.index,10); moveCategory(idx, -1); });
        const down=document.createElement('button'); down.className='btn'; down.textContent='↓'; down.addEventListener('click',()=>{ const idx = parseInt(row.dataset.index,10); moveCategory(idx, +1); });
        const del=document.createElement('button'); del.className='btn danger'; del.textContent='Delete'; del.addEventListener('click',()=>{ const idx = parseInt(row.dataset.index,10); deleteCategoryAt(idx); });
        controls.appendChild(up); controls.appendChild(down); controls.appendChild(del);
        row.appendChild(drag); row.appendChild(input); row.appendChild(controls); list.appendChild(row);
      }
    }
    function swapCategory(a,b){
      [categories[a],categories[b]]=[categories[b],categories[a]];
      [values[a],values[b]]=[values[b],values[a]];
      [notes[a],notes[b]]=[notes[b],notes[a]];
      [steps[a],steps[b]]=[steps[b],steps[a]];
      saveLocal(); drawBase();
    }

    // Modal actions: Add Category & Reset to Defaults
    document.getElementById('btnAddCategory').addEventListener('click', () => {
      const nextIndex = categories.length;
      categories.push(`Category ${nextIndex + 1}`);
      values.push(5);
      notes.push('');
      steps.push(new Array(10).fill(''));
      saveLocal();
      drawBase();
      buildEditList();
    });
    document.getElementById('btnResetCategories').addEventListener('click', () => {
      if (!confirm('Reset categories to defaults? This will overwrite names and reset scores to 5.')) return;
      categories = [...DEFAULT_CATEGORIES];
      values = new Array(categories.length).fill(5);
      notes = new Array(categories.length).fill('');
      steps = new Array(categories.length).fill(null).map(() => new Array(10).fill(''));
      saveLocal();
      drawBase();
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
