// js/app.js
import { state, saveLocal, loadLocal, ensureArrayLengths, loadSnapshots, saveSnapshots } from './state.js';
import { drawWheel, updateLegend, updateStats, moveHandlesToValues, buildA11yControls, exportPNG } from './wheel.js';
import { buildPlansPanel } from './actions.js';
import { refreshHistoryControls, buildHistoryTable, drawCombinedTimeChart, drawAvgSigmaChart, updateDeltaTable, setOverallDeltas } from './history.js';
import { openModal, closeModal, buildEditList, addCategory, resetCategories } from './modal.js';

function $(sel){ return document.querySelector(sel); }

const dom = {
  svg: $('#wheel'),
  ringsG: $('#rings'),
  axesG: $('#axes'),
  ticksG: $('#ticks'),
  bandsG: $('#bands'),
  labelsG: $('#labels'),
  handlesG: $('#handles'),
  overlay: $('.overlay'),
  legend: $('#legend'),
  liveRegion: $('#liveRegion'),
  avgVal: $('#avgVal'),
  minVal: $('#minVal'),
  maxVal: $('#maxVal'),
  stdVal: $('#stdVal'),
  plansPanel: $('#plansPanel'),
  historyTableBody: $('#historyTable tbody'),
  baselineSelect: $('#baselineSelect'),
  maToggle: $('#maToggle'),
  maWindow: $('#maWindow'),
  targetAvg: $('#targetAvg'),
  targetSigma: $('#targetSigma'),
  isoToggle: $('#isoToggle'),
  combinedChart: $('#combinedChart'),
  avgSigmaChart: $('#avgSigmaChart'),
  deltaBody: $('#deltaTable tbody'),
  deltaFooter: {
    avgBaseEl: $('#deltaAvgBase'), avgLatestEl: $('#deltaAvgLatest'), avgDiffEl: $('#deltaAvgDiff'),
    sigmaBaseEl: $('#deltaSigmaBase'), sigmaLatestEl: $('#deltaSigmaLatest'), sigmaDiffEl: $('#deltaSigmaDiff'),
    baaBaseEl: $('#deltaBAABase'), baaLatestEl: $('#deltaBAALatest'), baaDiffEl: $('#deltaBAADiff'),
    riiBaseEl: $('#deltaRIIBase'), riiLatestEl: $('#deltaRIILatest'), riiDiffEl: $('#deltaRIIDiff'),
  },
  modalOverlay: $('#modalOverlay'),
  editList: $('#editList'),
};

// Value change orchestrator (keeps other views in sync)
function onValueChanged(){
  // Plans
  if (dom.plansPanel && $('#page-actions').classList.contains('active')) {
    buildPlansPanel(dom.plansPanel);
  }
  // History charts & delta
  try {
    drawCombinedTimeChart(dom.combinedChart, dom.maToggle, dom.maWindow);
    drawAvgSigmaChart(dom.avgSigmaChart, dom.targetAvg, dom.targetSigma, dom.isoToggle);
  } catch (e) { console.warn('History charts failed:', e); }
  updateDeltaTable(dom.deltaBody, dom.baselineSelect, dom.deltaFooter);
}

function init() {
  const hadLocal=loadLocal(); loadSnapshots();
  if(!hadLocal){ state.values=new Array(state.categories.length).fill(5); state.notes=new Array(state.categories.length).fill(''); state.steps=new Array(state.categories.length).fill(null).map(()=> new Array(10).fill('')); }
  ensureArrayLengths();

  // Wheel first draw
  drawWheel(dom); updateLegend(dom); updateStats(dom); moveHandlesToValues(dom); buildA11yControls(dom, onValueChanged);

  // History init
  refreshHistoryControls(dom.baselineSelect);
  buildHistoryTable(dom.historyTableBody);
  try {
    drawCombinedTimeChart(dom.combinedChart, dom.maToggle, dom.maWindow);
    drawAvgSigmaChart(dom.avgSigmaChart, dom.targetAvg, dom.targetSigma, dom.isoToggle);
  } catch (e) { console.warn('History charts failed:', e); }
  updateDeltaTable(dom.deltaBody, dom.baselineSelect, dom.deltaFooter);

  // Wire buttons
  $('#btnExport').addEventListener('click', () => exportPNG(dom));
  $('#btnSnapshot').addEventListener('click', () => {
    const snap={ ts:Date.now(), categories:[...state.categories], values: state.values.map(v=> Math.round(v / 0.5) * 0.5) };
    state.snapshots.push(snap); saveSnapshots();
    buildHistoryTable(dom.historyTableBody);
    refreshHistoryControls(dom.baselineSelect);
    try {
      drawCombinedTimeChart(dom.combinedChart, dom.maToggle, dom.maWindow);
      drawAvgSigmaChart(dom.avgSigmaChart, dom.targetAvg, dom.targetSigma, dom.isoToggle);
    } catch (e) { console.warn('History charts failed:', e); }
    updateDeltaTable(dom.deltaBody, dom.baselineSelect, dom.deltaFooter);
    if (dom.liveRegion) dom.liveRegion.textContent = 'Snapshot saved.';
  });
  $('#btnExportSnaps').addEventListener('click', () => {
    const blob=new Blob([JSON.stringify({snapshots: state.snapshots},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='wheel-of-life-snapshots.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  });
  $('#btnImportSnaps').addEventListener('click', () => $('#snapFileInput').click());
  $('#snapFileInput').addEventListener('change',(e)=>{
    const f=e.target.files?.[0];
    if(f) {
      const reader=new FileReader();
      reader.onload=()=>{
        try{
          const obj=JSON.parse(reader.result);
          if(!obj.snapshots||!Array.isArray(obj.snapshots)) throw new Error('Invalid snapshot file');
          state.snapshots=obj.snapshots.map(s=>({ ts:s.ts, categories:s.categories, values:s.values.map(v=> Math.round(v / 0.5) * 0.5) }));
          saveSnapshots(); buildHistoryTable(dom.historyTableBody); refreshHistoryControls(dom.baselineSelect);
          try {
            drawCombinedTimeChart(dom.combinedChart, dom.maToggle, dom.maWindow);
            drawAvgSigmaChart(dom.avgSigmaChart, dom.targetAvg, dom.targetSigma, dom.isoToggle);
          } catch (e) { console.warn('History charts failed:', e); }
          updateDeltaTable(dom.deltaBody, dom.baselineSelect, dom.deltaFooter);
        }catch(e){ alert('Could not import snapshots: '+e.message); }
      };
      reader.readAsText(f);
    }
    e.target.value='';
  });
  $('#btnClearSnaps').addEventListener('click',()=>{
    if(!confirm('Clear all snapshots?')) return;
    state.snapshots=[]; saveSnapshots(); buildHistoryTable(dom.historyTableBody); refreshHistoryControls(dom.baselineSelect);
    try {
      drawHistoryCharts();
    } catch(e){ console.warn('History charts failed to draw:', e); }
    updateDeltaTable(dom.deltaBody, dom.baselineSelect, dom.deltaFooter);
  });

  $('#btnSave').addEventListener('click', ()=>{
    const blob=new Blob([JSON.stringify({categories:state.categories,values:state.values,notes:state.notes,steps:state.steps,savedAt:new Date().toISOString()},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='wheel-of-life.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  });
  $('#btnLoad').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change',(e)=>{
    const f=e.target.files?.[0];
    if(f){
      const reader=new FileReader();
      reader.onload=()=>{
        try{
          const obj=JSON.parse(reader.result);
          if(!obj.categories||!obj.values) throw new Error('Invalid file');
          state.categories=obj.categories; state.values=obj.values.map(v=> Math.round(v / 0.5) * 0.5);
          state.notes=obj.notes || new Array(state.categories.length).fill('');
          state.steps=obj.steps && Array.isArray(obj.steps)
            ? obj.steps.map(arr=> (Array.isArray(arr)? arr.slice(0,10).concat(new Array(Math.max(0,10-(arr.length||0))).fill('')) : new Array(10).fill('')))
            : new Array(state.categories.length).fill(null).map(()=> new Array(10).fill(''));
          ensureArrayLengths(); saveLocal();
          drawWheel(dom); updateLegend(dom); updateStats(dom); moveHandlesToValues(dom); buildA11yControls(dom, onValueChanged);
        }catch(e){ alert('Could not load: '+e.message); }
      };
      reader.readAsText(f);
    }
    e.target.value='';
  });

  $('#btnNew').addEventListener('click', ()=>{
    if(!confirm('Start fresh and reset scores to neutral (5)?')) return;
    state.values=new Array(state.categories.length).fill(5);
    state.notes=new Array(state.categories.length).fill('');
    state.steps=new Array(state.categories.length).fill(null).map(()=> new Array(10).fill(''));
    saveLocal();
    drawWheel(dom); updateLegend(dom); updateStats(dom); moveHandlesToValues(dom); buildA11yControls(dom, onValueChanged);
  });
  $('#btnPrint').addEventListener('click', () => window.print());
  $('#btnFullscreen').addEventListener('click', () =>{ const el=document.documentElement; if(document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.(); });

  // Modal
  $('#btnEditCats').addEventListener('click', () => openModal(dom.modalOverlay, () => buildEditList(dom.editList, dom, onValueChanged)));
  $('#btnCloseModal').addEventListener('click', () => closeModal(dom.modalOverlay));
  dom.modalOverlay.addEventListener('click',(e)=>{ if(e.target===dom.modalOverlay) closeModal(dom.modalOverlay); });
  $('#btnAddCategory').addEventListener('click', () => { addCategory(dom, onValueChanged); buildEditList(dom.editList, dom, onValueChanged); });
  $('#btnResetCategories').addEventListener('click', () => { resetCategories(dom, onValueChanged); buildEditList(dom.editList, dom, onValueChanged); });

  // History control wiring
  dom.baselineSelect.addEventListener('change',()=>{ try {
    drawCombinedTimeChart(dom.combinedChart, dom.maToggle, dom.maWindow);
    drawAvgSigmaChart(dom.avgSigmaChart, dom.targetAvg, dom.targetSigma, dom.isoToggle);
  } catch(e){ console.warn('History charts failed:', e); }
    updateDeltaTable(dom.deltaBody, dom.baselineSelect, dom.deltaFooter);
  });
  dom.maToggle.addEventListener('change', () => { try { drawCombinedTimeChart(dom.combinedChart, dom.maToggle, dom.maWindow); } catch(e){ console.warn('Combined chart failed:', e); } });
  dom.maWindow.addEventListener('input',()=>{ const v=parseInt(dom.maWindow.value,10); if(isNaN(v)||v<2) dom.maWindow.value=2; try { drawCombinedTimeChart(dom.combinedChart, dom.maToggle, dom.maWindow); } catch(e){ console.warn('Combined chart failed:', e); } });
  dom.targetAvg.addEventListener('input', () => { try { drawAvgSigmaChart(dom.avgSigmaChart, dom.targetAvg, dom.targetSigma, dom.isoToggle); } catch(e){ console.warn('AvgSigma failed:', e); } });
  dom.targetSigma.addEventListener('input', () => { try { drawAvgSigmaChart(dom.avgSigmaChart, dom.targetAvg, dom.targetSigma, dom.isoToggle); } catch(e){ console.warn('AvgSigma failed:', e); } });
  dom.isoToggle.addEventListener('change', () => { try { drawAvgSigmaChart(dom.avgSigmaChart, dom.targetAvg, dom.targetSigma, dom.isoToggle); } catch(e){ console.warn('AvgSigma failed:', e); } });

  // Tabs
  const tabs=document.querySelectorAll('.tab');
  function setActiveTab(name){
    tabs.forEach(t=> t.classList.toggle('active', t.dataset.tab===name));
    document.querySelectorAll('.page').forEach(p=> p.classList.toggle('active', p.id==='page-'+name));
    if(name==='history'){
      buildHistoryTable(dom.historyTableBody);
      refreshHistoryControls(dom.baselineSelect);
      try {
        drawCombinedTimeChart(dom.combinedChart, dom.maToggle, dom.maWindow);
        drawAvgSigmaChart(dom.avgSigmaChart, dom.targetAvg, dom.targetSigma, dom.isoToggle);
      } catch(e){ console.warn('History charts failed:', e); }
      updateDeltaTable(dom.deltaBody, dom.baselineSelect, dom.deltaFooter);
    }
    if(name==='actions') buildPlansPanel(dom.plansPanel);
  }
  tabs.forEach(t=> t.addEventListener('click', () => setActiveTab(t.dataset.tab)));
}

init();