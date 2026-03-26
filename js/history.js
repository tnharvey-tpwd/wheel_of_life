// js/history.js
import { state, saveSnapshots } from './state.js';
import { arrayAvg, arrayStd, fmtDate, pathFromSeries, seriesMA, cssVar } from './utils.js';

function measureContainer(el) {
  // prefer clientWidth; fallback to bounding box; last resort, viewport width
  let w = el.clientWidth;
  if (!w || w < 20) { const r = el.getBoundingClientRect(); w = r.width; }
  if (!w || w < 20) { w = Math.min(800, document.documentElement.clientWidth - 24); } // margin fallback
  return w;
}

// drawCombinedTimeChart
const width = measureContainer(containerEl);
const height = Math.round(width * 9 / 16);
const svg = document.createElementNS(svgNS,'svg'); svg.setAttribute('viewBox',`0 0 ${width} ${height}`);

// drawAvgSigmaChart
const width = measureContainer(containerEl);
const height = Math.round(width * 9 / 16);
const svg = document.createElementNS(svgNS,'svg'); svg.setAttribute('viewBox',`0 0 ${width} ${height}`);

// Controls
export function refreshHistoryControls(baselineSelectEl){
  baselineSelectEl.innerHTML='';
  const snaps=state.snapshots.slice().sort((a,b)=>a.ts-b.ts);
  if(snaps.length===0){
    const opt=document.createElement('option'); opt.value=''; opt.textContent='No snapshots'; baselineSelectEl.appendChild(opt); baselineSelectEl.disabled=true;
  } else {
    baselineSelectEl.disabled=false;
    snaps.forEach((s,idx)=>{ const opt=document.createElement('option'); opt.value=s.ts.toString(); opt.textContent=`${idx+1}. ${fmtDate(s.ts)}`; baselineSelectEl.appendChild(opt); });
    baselineSelectEl.value=snaps[0].ts.toString();
  }
}

// Snapshot table
export function buildHistoryTable(tbody){
  tbody.innerHTML='';
  state.snapshots.slice().sort((a,b)=>a.ts-b.ts).forEach(snap=>{
    const tr=document.createElement('tr');
    const tdDate=document.createElement('td'); tdDate.textContent=fmtDate(snap.ts);
    const avg=arrayAvg(snap.values), std=arrayStd(snap.values);
    const tdAvg=document.createElement('td'); tdAvg.textContent=avg.toFixed(1);
    const tdStd=document.createElement('td'); tdStd.textContent=std.toFixed(2);
    const tdCats=document.createElement('td'); tdCats.textContent=`${snap.categories.length} categories`;
    const tdAct=document.createElement('td'); const del=document.createElement('button'); del.className='btn danger'; del.textContent='Delete';
    del.addEventListener('click',()=>{ const i=state.snapshots.findIndex(s=>s.ts===snap.ts); if(i>-1){ state.snapshots.splice(i,1); saveSnapshots(); buildHistoryTable(tbody); } });
    tdAct.appendChild(del);
    tr.appendChild(tdDate); tr.appendChild(tdAvg); tr.appendChild(tdStd); tr.appendChild(tdCats); tr.appendChild(tdAct);
    tbody.appendChild(tr);
  });
}

// Combined chart (categories + sigma)
export function drawCombinedTimeChart(containerEl, maToggleEl, maWindowEl){
  containerEl.innerHTML='';
  const svgNS='http://www.w3.org/2000/svg';
  const width=containerEl.clientWidth||800, height=(containerEl.clientHeight||(width*9/16));
  const svg=document.createElementNS(svgNS,'svg'); svg.setAttribute('viewBox',`0 0 ${width} ${height}`); svg.setAttribute('width','100%'); svg.setAttribute('height','100%');

  const snaps=state.snapshots.slice().sort((a,b)=>a.ts-b.ts);
  if(snaps.length===0){
    const text=document.createElementNS(svgNS,'text'); text.textContent='No snapshots yet.'; text.setAttribute('x',width/2); text.setAttribute('y',height/2);
    text.setAttribute('dominant-baseline','middle'); text.setAttribute('text-anchor','middle'); text.setAttribute('fill','#b9c2ff'); svg.appendChild(text); containerEl.appendChild(svg); return;
  }

  const margin={top:20,right:50,bottom:30,left:40};
  const xMin=snaps[0].ts, xMax=snaps[snaps.length-1].ts;
  const plotW=width - margin.left - margin.right, plotH=height - margin.top - margin.bottom;
  const xScale=(x)=> margin.left + ((x-xMin)/(xMax-xMin || 1)) * plotW;
  const yLeft=(y)=> margin.top + (1 - (y/10)) * plotH;  // categories: 0..10
  const yRight=(s)=> margin.top + (1 - (s/5)) * plotH;  // sigma: 0..5

  const gGrid=document.createElementNS(svgNS,'g');
  for(let t=0;t<=10;t+=2){ const y=yLeft(t); const L=document.createElementNS(svgNS,'line'); L.setAttribute('x1',margin.left); L.setAttribute('x2',width-margin.right); L.setAttribute('y1',y); L.setAttribute('y2',y); L.setAttribute('class','gridline'); gGrid.appendChild(L); }
  svg.appendChild(gGrid);

  const axisX=document.createElementNS(svgNS,'line'); axisX.setAttribute('x1',margin.left); axisX.setAttribute('x2',width-margin.right); axisX.setAttribute('y1',height-margin.bottom); axisX.setAttribute('y2',height-margin.bottom); axisX.setAttribute('class','axis-line'); svg.appendChild(axisX);
  const axisYLeft=document.createElementNS(svgNS,'line'); axisYLeft.setAttribute('x1',margin.left); axisYLeft.setAttribute('x2',margin.left); axisYLeft.setAttribute('y1',margin.top); axisYLeft.setAttribute('y2',height-margin.bottom); axisYLeft.setAttribute('class','axis-line'); svg.appendChild(axisYLeft);
  const axisYRight=document.createElementNS(svgNS,'line'); axisYRight.setAttribute('x1',width-margin.right); axisYRight.setAttribute('x2',width-margin.right); axisYRight.setAttribute('y1',margin.top); axisYRight.setAttribute('y2',height-margin.bottom); axisYRight.setAttribute('class','axis-line'); svg.appendChild(axisYRight);

  const gYL=document.createElementNS(svgNS,'g');
  for(let t=0;t<=10;t+=2){ const x=margin.left, y=yLeft(t);
    const tk=document.createElementNS(svgNS,'line'); tk.setAttribute('x1',x-6); tk.setAttribute('x2',x); tk.setAttribute('y1',y); tk.setAttribute('y2',y); tk.setAttribute('class','axis-line'); gYL.appendChild(tk);
    const lab=document.createElementNS(svgNS,'text'); lab.textContent=t.toFixed(0); lab.setAttribute('x',x-8); lab.setAttribute('y',y+4); lab.setAttribute('fill','#b9c2ff'); lab.setAttribute('font-size','11'); lab.setAttribute('text-anchor','end'); gYL.appendChild(lab);
  }
  svg.appendChild(gYL);

  const gYR=document.createElementNS(svgNS,'g');
  for(let s=0;s<=5;s+=1){ const x=width-margin.right, y=yRight(s);
    const tk=document.createElementNS(svgNS,'line'); tk.setAttribute('x1',x); tk.setAttribute('x2',x+6); tk.setAttribute('y1',y); tk.setAttribute('y2',y); tk.setAttribute('class','axis-line'); gYR.appendChild(tk);
    const lab=document.createElementNS(svgNS,'text'); lab.textContent=s.toFixed(0); lab.setAttribute('x',x+8); lab.setAttribute('y',y+4); lab.setAttribute('fill','#b9c2ff'); lab.setAttribute('font-size','11'); lab.setAttribute('text-anchor','start'); gYR.appendChild(lab);
  }
  svg.appendChild(gYR);

  const seriesX=snaps.map(s=>({x:s.ts}));
  const gXT=document.createElementNS(svgNS,'g'); const tickCount=Math.min(6,seriesX.length);
  for(let i=0;i<tickCount;i++){ const idx=Math.round((i/(tickCount-1))*(seriesX.length-1)); const x=xScale(seriesX[idx].x), y=height-margin.bottom;
    const t=document.createElementNS(svgNS,'line'); t.setAttribute('x1',x); t.setAttribute('x2',x); t.setAttribute('y1',y); t.setAttribute('y2',y+6); t.setAttribute('class','axis-line'); gXT.appendChild(t);
    const lab=document.createElementNS(svgNS,'text'); lab.textContent=new Date(seriesX[idx].x).toLocaleDateString(); lab.setAttribute('x',x); lab.setAttribute('y',y+18); lab.setAttribute('fill','#b9c2ff'); lab.setAttribute('font-size','12'); lab.setAttribute('text-anchor','middle'); gXT.appendChild(lab);
  }
  svg.appendChild(gXT);

  const useMA=maToggleEl.checked, win=parseInt(maWindowEl.value,10)||3;
  const catPaths=[];
  state.categories.forEach((cat, idx)=>{
    const hue=state.paletteHues[idx]; const color = bandColor(hue, 10);
    const series=snaps.map(s=>{ const j=s.categories.indexOf(cat); const y=(j>-1)? s.values[j] : null; return {x:s.ts, y}; });
    const sData = (useMA? seriesMA(series,win) : series);
    const path=document.createElementNS(svgNS,'path'); path.setAttribute('d', pathFromSeries(sData, xScale, yLeft)); path.setAttribute('fill','none'); path.setAttribute('stroke', color); path.setAttribute('stroke-width','2.0'); svg.appendChild(path);
    catPaths.push({name:cat, color, series:sData, yScale:yLeft});
  });

  const sigmaColor = cssVar('--ma-line', '#ffd166');
  const sigmaSeriesRaw = snaps.map(s=>({x:s.ts, y: arrayStd(s.values)}));
  const sigmaSeries = useMA ? seriesMA(sigmaSeriesRaw, win) : sigmaSeriesRaw;
  const sigmaPath=document.createElementNS(svgNS,'path'); sigmaPath.setAttribute('d', pathFromSeries(sigmaSeries, xScale, yRight)); sigmaPath.setAttribute('fill','none'); sigmaPath.setAttribute('stroke', sigmaColor); sigmaPath.setAttribute('stroke-width','2.4'); sigmaPath.setAttribute('stroke-dasharray','5,3'); svg.appendChild(sigmaPath);
  const allSeries=[...catPaths, {name:'Balance (σ)', color: sigmaColor, series: sigmaSeries, yScale: yRight}];

  // Hover
  const hoverLayer=document.createElementNS(svgNS,'g'); svg.appendChild(hoverLayer);
  const marker=document.createElementNS(svgNS,'circle'); marker.setAttribute('r','3.5'); marker.setAttribute('stroke','#202642'); marker.setAttribute('stroke-width','0.8'); marker.setAttribute('fill','#8fd3ff'); marker.style.display='none'; hoverLayer.appendChild(marker);
  const label=document.createElementNS(svgNS,'text'); label.setAttribute('fill','#e8ecff'); label.setAttribute('font-size','12'); label.setAttribute('font-weight','700'); label.setAttribute('text-anchor','start'); label.style.display='none'; hoverLayer.appendChild(label);
  const overlay=document.createElementNS(svgNS,'rect'); overlay.setAttribute('x',margin.left); overlay.setAttribute('y',margin.top); overlay.setAttribute('width',plotW); overlay.setAttribute('height',plotH); overlay.setAttribute('fill','transparent'); svg.appendChild(overlay);

  function nearestIndexForX(xPx){
    const t = xMin + ((xPx - margin.left)/plotW) * (xMax - xMin);
    let bestIdx=0, bestDiff=Infinity;
    for(let i=0;i<snaps.length;i++){ const d=Math.abs(snaps[i].ts - t); if(d<bestDiff){ bestDiff=d; bestIdx=i; } }
    return bestIdx;
  }
  function onMove(e){
    const rect=svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const idx = nearestIndexForX(px);
    const x = xScale(snaps[idx].ts);
    let best = {dist: Infinity, name:'', color:'#fff', y:0};
    allSeries.forEach(s=>{
      const val = s.series[idx]?.y;
      if(val==null) return;
      const y = s.yScale(val);
      const dist = Math.abs(y - py);
      if(dist < best.dist){ best = {dist, name: s.name, color: s.color, y, val}; }
    });
    if(best.dist !== Infinity){
      marker.style.display='block'; marker.setAttribute('cx', x); marker.setAttribute('cy', best.y); marker.setAttribute('fill', best.color);
      label.style.display='block'; label.textContent = `${best.name}: ${best.name==='Balance (σ)' ? (best.val??0).toFixed(2) : (best.val??0).toFixed(1)}`;
      label.setAttribute('x', x + 8); label.setAttribute('y', best.y - 8);
    } else { marker.style.display='none'; label.style.display='none'; }
  }
  function onLeave(){ marker.style.display='none'; label.style.display='none'; }
  overlay.addEventListener('pointermove', onMove);
  overlay.addEventListener('pointerleave', onLeave);
  
  // Touch hover (show marker on finger move)
  overlay.addEventListener('touchstart', e => { e.preventDefault(); onMove(touchToPointerLike(e, svg)); }, { passive: false });
  overlay.addEventListener('touchmove',  e => { e.preventDefault(); onMove(touchToPointerLike(e, svg)); }, { passive: false });
  overlay.addEventListener('touchend',   e => { e.preventDefault(); onLeave(); }, { passive: false });
  
  // Helper to synthesize pointer-like event (clientX/clientY)
  function touchToPointerLike(e, svg){
    const t=e.touches?.[0] || e.changedTouches?.[0];
    if(!t) return { clientX: 0, clientY: 0 };
    return { clientX: t.clientX, clientY: t.clientY, target: svg };
  }

  containerEl.appendChild(svg);
}

// Avg vs Sigma chart
export function drawAvgSigmaChart(containerEl, targetAvgEl, targetSigmaEl, isoToggleEl){
  containerEl.innerHTML='';
  const svgNS='http://www.w3.org/2000/svg';
  const width=containerEl.clientWidth||800, height=(containerEl.clientHeight||(width*9/16));
  const svg=document.createElementNS(svgNS,'svg'); svg.setAttribute('viewBox',`0 0 ${width} ${height}`); svg.setAttribute('width','100%'); svg.setAttribute('height','100%');

  const snaps=state.snapshots.slice().sort((a,b)=>a.ts-b.ts);
  if(snaps.length===0){ const text=document.createElementNS(svgNS,'text'); text.textContent='No snapshots yet.'; text.setAttribute('x',width/2); text.setAttribute('y',height/2); text.setAttribute('dominant-baseline','middle'); text.setAttribute('text-anchor','middle'); text.setAttribute('fill','#b9c2ff'); svg.appendChild(text); containerEl.appendChild(svg); return; }

  const margin={top:20,right:20,bottom:30,left:40};
  const xScale=(A)=>{ const w=width-margin.left-margin.right; return margin.left + (A/10)*w; };
  const yScale=(S)=>{ const h=height-margin.top-margin.bottom; return margin.top + (1-(S/5))*h; };

  const gGrid=document.createElementNS(svgNS,'g');
  for(let A=0; A<=10; A+=2){ const x=xScale(A); const L=document.createElementNS(svgNS,'line'); L.setAttribute('x1',x); L.setAttribute('x2',x); L.setAttribute('y1',margin.top); L.setAttribute('y2',height-margin.bottom); L.setAttribute('class','gridline'); gGrid.appendChild(L); }
  for(let S=0; S<=5; S+=1){ const y=yScale(S); const L=document.createElementNS(svgNS,'line'); L.setAttribute('x1',margin.left); L.setAttribute('x2',width-margin.right); L.setAttribute('y1',y); L.setAttribute('y2',y); L.setAttribute('class','gridline'); gGrid.appendChild(L); }
  svg.appendChild(gGrid);

  const axisX=document.createElementNS(svgNS,'line'); axisX.setAttribute('x1',margin.left); axisX.setAttribute('x2',width-margin.right); axisX.setAttribute('y1',height-margin.bottom); axisX.setAttribute('y2',height-margin.bottom); axisX.setAttribute('class','axis-line'); svg.appendChild(axisX);
  const axisY=document.createElementNS(svgNS,'line'); axisY.setAttribute('x1',margin.left); axisY.setAttribute('x2',margin.left); axisY.setAttribute('y1',margin.top); axisY.setAttribute('y2',height-margin.bottom); axisY.setAttribute('class','axis-line'); svg.appendChild(axisY);

  const xLab=document.createElementNS(svgNS,'text'); xLab.textContent='Average (0–10)'; xLab.setAttribute('x',(width)/2); xLab.setAttribute('y',height-6); xLab.setAttribute('fill','#b9c2ff'); xLab.setAttribute('font-size','12'); xLab.setAttribute('text-anchor','middle'); svg.appendChild(xLab);
  const yLab=document.createElementNS(svgNS,'text'); yLab.textContent='Balance (σ, 0–5)'; yLab.setAttribute('x',12); yLab.setAttribute('y',margin.top+12); yLab.setAttribute('fill','#b9c2ff'); yLab.setAttribute('font-size','12'); svg.appendChild(yLab);

  const targetAvg=parseFloat(targetAvgEl.value)||7, targetSigma=parseFloat(targetSigmaEl.value)||1.5;
  const zoneX=xScale(targetAvg), zoneY=yScale(targetSigma);
  const zoneRect=document.createElementNS(svgNS,'rect');
  zoneRect.setAttribute('x',zoneX); zoneRect.setAttribute('y',margin.top);
  zoneRect.setAttribute('width',(width-margin.right)-zoneX);
  zoneRect.setAttribute('height',(height-margin.bottom)-margin.top);
  zoneRect.setAttribute('fill', 'rgba(76,175,80,0.12)');
  zoneRect.setAttribute('stroke', '#4caf50');
  zoneRect.setAttribute('stroke-width', '1');
  svg.appendChild(zoneRect);
  const boundLine=document.createElementNS(svgNS,'line'); boundLine.setAttribute('x1',margin.left); boundLine.setAttribute('x2',width-margin.right); boundLine.setAttribute('y1',zoneY); boundLine.setAttribute('y2',zoneY); boundLine.setAttribute('stroke','#4caf50'); boundLine.setAttribute('stroke-dasharray','4,3'); svg.appendChild(boundLine);

  const isoColor = cssVar('--isolines', '#d1b3ff');
  if(isoToggleEl.checked){
    const isoQs=[3,5,7];
    isoQs.forEach(q=>{
      let d=''; let pen=false;
      for(let A=0.5; A<=10; A+=0.1){
        const S=5*(1 - (q/A)); if(S<0 || S>5) continue;
        const x=xScale(A), y=yScale(S);
        if(!pen){ d+=`M ${x} ${y} `; pen=true; } else { d+=`L ${x} ${y} `; }
      }
      const path=document.createElementNS(svgNS,'path'); path.setAttribute('d',d.trim()); path.setAttribute('fill','none'); path.setAttribute('stroke', isoColor); path.setAttribute('stroke-width','1.2'); path.setAttribute('stroke-dasharray','5,3'); svg.appendChild(path);
      const lx=xScale(9.8), ly=yScale(5*(1-(q/9.8)));
      const lbl=document.createElementNS(svgNS,'text'); lbl.textContent=`BAA=${q}`; lbl.setAttribute('x',lx); lbl.setAttribute('y',ly-4); lbl.setAttribute('fill', isoColor); lbl.setAttribute('font-size','11'); lbl.setAttribute('text-anchor','end'); svg.appendChild(lbl);
    });
  }

  const points=snaps.map(s=>({ A: arrayAvg(s.values), S: arrayStd(s.values), ts:s.ts }));
  points.forEach(p=>{
    const dot=document.createElementNS(svgNS,'circle'); dot.setAttribute('cx', xScale(p.A)); dot.setAttribute('cy', yScale(p.S)); dot.setAttribute('r','3'); dot.setAttribute('fill','#8fd3ff'); dot.setAttribute('stroke','#202642'); dot.setAttribute('stroke-width','0.8');
    const title=document.createElementNS(svgNS,'title'); title.textContent=`${fmtDate(p.ts)}  A=${p.A.toFixed(1)}  σ=${p.S.toFixed(2)}`; dot.appendChild(title);
    svg.appendChild(dot);
  });

  containerEl.appendChild(svg);
}

// Delta table & metrics
export function BAA(A,S){ return A * (1 - (S/5)); }
export function RII(A,S){ return (A>0) ? (2*S/A) : Infinity; }

export function updateDeltaTable(tbody, baselineSelectEl, footerEls){
  tbody.innerHTML='';
  const snaps=state.snapshots.slice().sort((a,b)=>a.ts-b.ts);
  if(snaps.length<1){
    const tr=document.createElement('tr'); const td=document.createElement('td'); td.textContent='No snapshots yet.'; td.colSpan=4; tr.appendChild(td); tbody.appendChild(tr);
    setOverallDeltas(null, null, footerEls);
    return;
  }

  const latest=snaps[snaps.length-1];
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

  setOverallDeltas(baseline, latest, footerEls);
}

export function setOverallDeltas(baseline, latest, footerEls){
  const {avgBaseEl, avgLatestEl, avgDiffEl, sigmaBaseEl, sigmaLatestEl, sigmaDiffEl, baaBaseEl, baaLatestEl, baaDiffEl, riiBaseEl, riiLatestEl, riiDiffEl} = footerEls;
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
