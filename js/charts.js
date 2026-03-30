import { state, saveSnapshots } from './state.js';
import { fmtDate, arrayAvg, arrayStd, bandColor, MAX_VALUE } from './utils.js';

export function refreshHistoryControls() {
  const select = document.getElementById('baselineSelect'); 
  if (!select) return;
  
  select.innerHTML = '';
  const snaps = state.snapshots.slice().sort((a, b) => a.ts - b.ts);
  
  if (snaps.length === 0) {
    const opt = document.createElement('option'); 
    opt.value = ''; 
    opt.textContent = 'No snapshots'; 
    select.appendChild(opt); 
    select.disabled = true;
  } else {
    select.disabled = false;
    snaps.forEach((s, idx) => { 
      const opt = document.createElement('option'); 
      opt.value = s.ts.toString(); 
      opt.textContent = `${idx + 1}. ${fmtDate(s.ts)}`; 
      select.appendChild(opt); 
    });
    // Don't overwrite the user's selection if they already made one
    if (!select.value) select.value = snaps[0].ts.toString();
  }
}

export function buildHistoryTable(onDeleteCallback) {
  const tbody = document.querySelector('#historyTable tbody'); 
  if (!tbody) return;
  
  tbody.innerHTML = ''; 
  const frag = document.createDocumentFragment();
  
  state.snapshots.slice().sort((a, b) => a.ts - b.ts).forEach(snap => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(snap.ts)}</td>
      <td>${arrayAvg(snap.values).toFixed(1)}</td>
      <td>${arrayStd(snap.values).toFixed(2)}</td>
      <td>${snap.categories.length} categories</td>
    `;
    
    const tdAct = document.createElement('td'); 
    const del = document.createElement('button'); 
    del.className = 'btn danger'; 
    del.textContent = 'Delete';
    
    del.addEventListener('click', () => { 
        const i = state.snapshots.findIndex(s => s.ts === snap.ts); 
        if (i > -1) { 
          state.snapshots.splice(i, 1); 
          saveSnapshots(); 
          if(onDeleteCallback) onDeleteCallback(); 
        } 
    });
    
    tdAct.appendChild(del); 
    tr.appendChild(tdAct); 
    frag.appendChild(tr);
  });
  
  tbody.appendChild(frag);
}

function seriesMA(series, windowSize) {
  const arr = series.map(p => p.y), ma = [];
  for (let i = 0; i < arr.length; i++) {
    let count = 0, sum = 0;
    for (let j = i - windowSize + 1; j <= i; j++) { 
      if (j >= 0 && arr[j] != null) { sum += arr[j]; count++; } 
    }
    ma.push(count > 0 ? sum / count : null);
  }
  return series.map((p, i) => ({ x: p.x, y: ma[i] }));
}

function pathFromSeries(series, xScale, yScale) {
  let d = '', pen = false;
  series.forEach(p => {
    if (p.y == null) { pen = false; return; }
    const x = xScale(p.x), y = yScale(p.y);
    if (!pen) { d += `M ${x} ${y} `; pen = true; } else { d += `L ${x} ${y} `; }
  });
  return d.trim();
}

function drawCombinedTimeChart() {
  const el = document.getElementById('combinedChart');
  if (!el) return;
  el.innerHTML = '';
  
  const snaps = state.snapshots.slice().sort((a, b) => a.ts - b.ts);
  const width = el.clientWidth || 800, height = el.clientHeight || (width * 9 / 16);
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg'); 
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');

  if (snaps.length === 0) {
    const text = document.createElementNS(svgNS, 'text'); 
    text.textContent = 'No snapshots yet.'; 
    text.setAttribute('x', width / 2); text.setAttribute('y', height / 2);
    text.setAttribute('dominant-baseline', 'middle'); text.setAttribute('text-anchor', 'middle'); 
    text.setAttribute('fill', '#b9c2ff'); 
    svg.appendChild(text); el.appendChild(svg); 
    return;
  }

  const margin = { top: 20, right: 50, bottom: 30, left: 40 };
  const xMin = snaps[0].ts, xMax = snaps[snaps.length - 1].ts;
  const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
  
  const xScale = (x) => margin.left + ((x - xMin) / (xMax - xMin || 1)) * plotW;
  const yLeft = (y) => margin.top + (1 - (y / 10)) * plotH;
  const yRight = (s) => margin.top + (1 - (s / 5)) * plotH;

  // Render base grid & axes
  const gGrid = document.createElementNS(svgNS, 'g');
  for (let t = 0; t <= 10; t += 2) { 
    const L = document.createElementNS(svgNS, 'line'); 
    L.setAttribute('x1', margin.left); L.setAttribute('x2', width - margin.right); 
    L.setAttribute('y1', yLeft(t)); L.setAttribute('y2', yLeft(t)); 
    L.setAttribute('class', 'gridline'); gGrid.appendChild(L); 
  }
  svg.appendChild(gGrid);

  const axisX = document.createElementNS(svgNS, 'line'); axisX.setAttribute('x1', margin.left); axisX.setAttribute('x2', width - margin.right); axisX.setAttribute('y1', height - margin.bottom); axisX.setAttribute('y2', height - margin.bottom); axisX.setAttribute('class', 'axis-line'); svg.appendChild(axisX);
  const axisYLeft = document.createElementNS(svgNS, 'line'); axisYLeft.setAttribute('x1', margin.left); axisYLeft.setAttribute('x2', margin.left); axisYLeft.setAttribute('y1', margin.top); axisYLeft.setAttribute('y2', height - margin.bottom); axisYLeft.setAttribute('class', 'axis-line'); svg.appendChild(axisYLeft);
  const axisYRight = document.createElementNS(svgNS, 'line'); axisYRight.setAttribute('x1', width - margin.right); axisYRight.setAttribute('x2', width - margin.right); axisYRight.setAttribute('y1', margin.top); axisYRight.setAttribute('y2', height - margin.bottom); axisYRight.setAttribute('class', 'axis-line'); svg.appendChild(axisYRight);

  // Get UI inputs locally
  const useMA = document.getElementById('maToggle')?.checked || false;
  const win = parseInt(document.getElementById('maWindow')?.value, 10) || 3;
  
  // Render Paths
  state.categories.forEach((cat, idx) => {
    const color = bandColor(state.paletteHues[idx], MAX_VALUE);
    const series = snaps.map(s => { const j = s.categories.indexOf(cat); return { x: s.ts, y: j > -1 ? s.values[j] : null }; });
    const sData = useMA ? seriesMA(series, win) : series;
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', pathFromSeries(sData, xScale, yLeft)); 
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', color); path.setAttribute('stroke-width', '2.0'); 
    svg.appendChild(path);
  });

  const isoColor = getComputedStyle(document.documentElement).getPropertyValue('--ma-line').trim() || '#ffd166';
  const sigmaSeriesRaw = snaps.map(s => ({ x: s.ts, y: arrayStd(s.values) }));
  const sigmaSeries = useMA ? seriesMA(sigmaSeriesRaw, win) : sigmaSeriesRaw;
  const sigmaPath = document.createElementNS(svgNS, 'path'); 
  sigmaPath.setAttribute('d', pathFromSeries(sigmaSeries, xScale, yRight)); 
  sigmaPath.setAttribute('fill', 'none'); sigmaPath.setAttribute('stroke', isoColor); 
  sigmaPath.setAttribute('stroke-width', '2.4'); sigmaPath.setAttribute('stroke-dasharray', '5,3'); 
  svg.appendChild(sigmaPath);

  el.appendChild(svg);
}

function drawAvgSigmaChart() {
  const el = document.getElementById('avgSigmaChart');
  if (!el) return;
  el.innerHTML = '';
  
  const snaps = state.snapshots.slice().sort((a, b) => a.ts - b.ts);
  const width = el.clientWidth || 800, height = el.clientHeight || (width * 9 / 16);
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg'); 
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');

  if (snaps.length === 0) { 
    const text = document.createElementNS(svgNS, 'text'); 
    text.textContent = 'No snapshots yet.'; 
    text.setAttribute('x', width / 2); text.setAttribute('y', height / 2); 
    text.setAttribute('dominant-baseline', 'middle'); text.setAttribute('text-anchor', 'middle'); 
    text.setAttribute('fill', '#b9c2ff'); 
    svg.appendChild(text); el.appendChild(svg); 
    return; 
  }

  const margin = { top: 20, right: 20, bottom: 30, left: 40 };
  const xScale = (A) => margin.left + (A / 10) * (width - margin.left - margin.right);
  const yScale = (S) => margin.top + (1 - (S / 5)) * (height - margin.top - margin.bottom);

  // Grid
  const gGrid = document.createElementNS(svgNS, 'g');
  for (let A = 0; A <= 10; A += 2) { 
    const x = xScale(A); 
    const L = document.createElementNS(svgNS, 'line'); 
    L.setAttribute('x1', x); L.setAttribute('x2', x); L.setAttribute('y1', margin.top); L.setAttribute('y2', height - margin.bottom); 
    L.setAttribute('class', 'gridline'); gGrid.appendChild(L); 
  }
  for (let S = 0; S <= 5; S += 1) { 
    const y = yScale(S); 
    const L = document.createElementNS(svgNS, 'line'); 
    L.setAttribute('x1', margin.left); L.setAttribute('x2', width - margin.right); L.setAttribute('y1', y); L.setAttribute('y2', y); 
    L.setAttribute('class', 'gridline'); gGrid.appendChild(L); 
  }
  svg.appendChild(gGrid);

  // Axes
  const axisX = document.createElementNS(svgNS, 'line'); axisX.setAttribute('x1', margin.left); axisX.setAttribute('x2', width - margin.right); axisX.setAttribute('y1', height - margin.bottom); axisX.setAttribute('y2', height - margin.bottom); axisX.setAttribute('class', 'axis-line'); svg.appendChild(axisX);
  const axisY = document.createElementNS(svgNS, 'line'); axisY.setAttribute('x1', margin.left); axisY.setAttribute('x2', margin.left); axisY.setAttribute('y1', margin.top); axisY.setAttribute('y2', height - margin.bottom); axisY.setAttribute('class', 'axis-line'); svg.appendChild(axisY);
  
  const xLab = document.createElementNS(svgNS, 'text'); xLab.textContent = 'Average (0–10)'; xLab.setAttribute('x', width / 2); xLab.setAttribute('y', height - 6); xLab.setAttribute('fill', '#b9c2ff'); xLab.setAttribute('font-size', '12'); xLab.setAttribute('text-anchor', 'middle'); svg.appendChild(xLab);
  const yLab = document.createElementNS(svgNS, 'text'); yLab.textContent = 'Balance (σ, 0–5)'; yLab.setAttribute('x', 12); yLab.setAttribute('y', margin.top + 12); yLab.setAttribute('fill', '#b9c2ff'); yLab.setAttribute('font-size', '12'); svg.appendChild(yLab);

  // Retrieve DOM elements locally to prevent scope errors
  const targetAvg = parseFloat(document.getElementById('targetAvg')?.value) || 7;
  const targetSigma = parseFloat(document.getElementById('targetSigma')?.value) || 1.5;
  const showIso = document.getElementById('isoToggle')?.checked || false;

  const zoneX = xScale(targetAvg), zoneY = yScale(targetSigma);
  const zoneRect = document.createElementNS(svgNS, 'rect');
  zoneRect.setAttribute('x', zoneX); zoneRect.setAttribute('y', margin.top);
  zoneRect.setAttribute('width', (width - margin.right) - zoneX);
  zoneRect.setAttribute('height', (height - margin.bottom) - margin.top);
  zoneRect.setAttribute('fill', 'rgba(76,175,80,0.12)'); zoneRect.setAttribute('stroke', '#4caf50'); zoneRect.setAttribute('stroke-width', '1');
  svg.appendChild(zoneRect);
  
  const boundLine = document.createElementNS(svgNS, 'line'); 
  boundLine.setAttribute('x1', margin.left); boundLine.setAttribute('x2', width - margin.right); 
  boundLine.setAttribute('y1', zoneY); boundLine.setAttribute('y2', zoneY); 
  boundLine.setAttribute('stroke', '#4caf50'); boundLine.setAttribute('stroke-dasharray', '4,3'); 
  svg.appendChild(boundLine);

  const isoColor = getComputedStyle(document.documentElement).getPropertyValue('--isolines').trim() || '#d1b3ff';
  
  if (showIso) {
    const isoQs = [3, 5, 7];
    isoQs.forEach(q => {
      let d = ''; let pen = false;
      for (let A = 0.5; A <= 10; A += 0.1) {
        const S = 5 * (1 - (q / A)); if (S < 0 || S > 5) continue;
        const x = xScale(A), y = yScale(S);
        if (!pen) { d += `M ${x} ${y} `; pen = true; } else { d += `L ${x} ${y} `; }
      }
      const path = document.createElementNS(svgNS, 'path'); 
      path.setAttribute('d', d.trim()); path.setAttribute('fill', 'none'); 
      path.setAttribute('stroke', isoColor); path.setAttribute('stroke-width', '1.2'); path.setAttribute('stroke-dasharray', '5,3'); 
      svg.appendChild(path);
      
      const lx = xScale(9.8), ly = yScale(5 * (1 - (q / 9.8)));
      const lbl = document.createElementNS(svgNS, 'text'); 
      lbl.textContent = `BAA=${q}`; lbl.setAttribute('x', lx); lbl.setAttribute('y', ly - 4); 
      lbl.setAttribute('fill', isoColor); lbl.setAttribute('font-size', '11'); lbl.setAttribute('text-anchor', 'end'); 
      svg.appendChild(lbl);
    });
  }

  const points = snaps.map(s => ({ A: arrayAvg(s.values), S: arrayStd(s.values), ts: s.ts }));
  points.forEach(p => {
    const dot = document.createElementNS(svgNS, 'circle'); 
    dot.setAttribute('cx', xScale(p.A)); dot.setAttribute('cy', yScale(p.S)); dot.setAttribute('r', '3'); 
    dot.setAttribute('fill', '#8fd3ff'); dot.setAttribute('stroke', '#202642'); dot.setAttribute('stroke-width', '0.8');
    
    const title = document.createElementNS(svgNS, 'title'); 
    title.textContent = `${fmtDate(p.ts)}  A=${p.A.toFixed(1)}  σ=${p.S.toFixed(2)}`; 
    dot.appendChild(title);
    svg.appendChild(dot);
  });

  el.appendChild(svg);
}

// Main export to draw both charts safely
export function drawHistoryCharts() {
  drawCombinedTimeChart();
  drawAvgSigmaChart();
}

export function updateDeltaTable() { 
  const tbody=document.querySelector('#deltaTable tbody'); if(!tbody) return;
    tbody.innerHTML='';
    const snaps=state.snapshots.slice().sort((a,b)=>a.ts-b.ts);
    if(snaps.length<1){ const tr=document.createElement('tr'); const td=document.createElement('td'); td.textContent='No snapshots yet.'; td.colSpan=4; tr.appendChild(td); tbody.appendChild(tr); setOverallDeltas(null,null); return; }

    const latest=snaps[snaps.length-1];
    const baselineSelectEl = document.getElementById('baselineSelect');
    const baseTs=baselineSelectEl.value ? parseInt(baselineSelectEl.value,10) : snaps[0].ts;
    const baseline=snaps.find(s=>s.ts===baseTs) || snaps[0];

    state.categories.forEach(cat=>{
      const baseIdx=baseline.categories.indexOf(cat), latestIdx=latest.categories.indexOf(cat);
      const baseVal=baseIdx>-1 ? baseline.values[baseIdx] : null;
      const latestVal=latestIdx>-1 ? latest.values[latestIdx] : null;
      const diff=(baseVal!=null && latestVal!=null) ? (latestVal - baseVal) : null;

      const tr=document.createElement('tr');
      const tdCat=document.createElement('td'); tdCat.textContent=cat;
      const tdBase=document.createElement('td'); tdBase.textContent=baseVal!=null ? baseVal.toFixed(1) : '–';
      const tdLatest=document.createElement('td'); tdLatest.textContent=latestVal!=null ? latestVal.toFixed(1) : '–';
      const tdDiff=document.createElement('td'); tdDiff.textContent=diff!=null ? (diff>=0?`+${diff.toFixed(1)}`:diff.toFixed(1)) : '–';
      tr.appendChild(tdCat); tr.appendChild(tdBase); tr.appendChild(tdLatest); tr.appendChild(tdDiff);
      tbody.appendChild(tr);
    });

    setOverallDeltas(baseline, latest);
}

function BAA(A,S){ return A * (1 - (S/5)); }          // Balance-Adjusted Average
function RII(A,S){ return (A>0) ? (2*S/A) : Infinity; } // Relative Imbalance Index

function setOverallDeltas(baseline, latest){
  const avgBaseEl=document.getElementById('deltaAvgBase'), avgLatestEl=document.getElementById('deltaAvgLatest'), avgDiffEl=document.getElementById('deltaAvgDiff');
  const sigmaBaseEl=document.getElementById('deltaSigmaBase'), sigmaLatestEl=document.getElementById('deltaSigmaLatest'), sigmaDiffEl=document.getElementById('deltaSigmaDiff');
  const baaBaseEl=document.getElementById('deltaBAABase'), baaLatestEl=document.getElementById('deltaBAALatest'), baaDiffEl=document.getElementById('deltaBAADiff');
  const riiBaseEl=document.getElementById('deltaRIIBase'), riiLatestEl=document.getElementById('deltaRIILatest'), riiDiffEl=document.getElementById('deltaRIIDiff');

  if(!baseline || !latest){
    avgBaseEl.textContent=avgLatestEl.textContent=avgDiffEl.textContent='–';
    sigmaBaseEl.textContent=sigmaLatestEl.textContent=sigmaDiffEl.textContent='–';
    baaBaseEl.textContent=baaLatestEl.textContent=baaDiffEl.textContent='–';
    riiBaseEl.textContent=riiLatestEl.textContent=riiDiffEl.textContent='–';
    return;
  }

  const A_base=arrayAvg(baseline.values), S_base=arrayStd(baseline.values);
  const A_latest=arrayAvg(latest.values), S_latest=arrayStd(latest.values);
  const BAA_base=BAA(A_base,S_base), BAA_latest=BAA(A_latest,S_latest);
  const RII_base=RII(A_base,S_base), RII_latest=RII(A_latest,S_latest);

  avgBaseEl.textContent=A_base.toFixed(1);
  avgLatestEl.textContent=A_latest.toFixed(1);
  const dA=A_latest - A_base; avgDiffEl.textContent=(dA>=0?`+${dA.toFixed(1)}`:dA.toFixed(1));

  sigmaBaseEl.textContent=S_base.toFixed(2);
  sigmaLatestEl.textContent=S_latest.toFixed(2);
  const dS=S_latest - S_base; sigmaDiffEl.textContent=(dS>=0?`+${dS.toFixed(2)}`:dS.toFixed(2));

  baaBaseEl.textContent=BAA_base.toFixed(2);
  baaLatestEl.textContent=BAA_latest.toFixed(2);
  const dBAA=BAA_latest - BAA_base; baaDiffEl.textContent=(dBAA>=0?`+${dBAA.toFixed(2)}`:dBAA.toFixed(2));

  riiBaseEl.textContent=(Number.isFinite(RII_base)?RII_base.toFixed(2):'∞');
  riiLatestEl.textContent=(Number.isFinite(RII_latest)?RII_latest.toFixed(2):'∞');
  const dRII=RII_latest - RII_base; riiDiffEl.textContent=(Number.isFinite(dRII)? (dRII>=0?`+${dRII.toFixed(2)}`:dRII.toFixed(2)) : '–');
}
