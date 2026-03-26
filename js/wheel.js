// js/wheel.js
import {
  MAX_VALUE, BAND_THICKNESS, RADIUS, CX, CY,
  STEP_FINE, STEP_COARSE, state, saveLocal
} from './state.js';
import {
  angleForIndex, stepAngle, pointOnCircle, roundTo, clamp, valueToRadius,
  buildPalette, bandColor, annularSectorPath, fullRingPath
} from './utils.js';

export function initWheel(dom, onValueChanged) {
  // Attach events early (defensive)
  
dom.overlay.addEventListener('pointerdown', e => onOverlayPointerDown(e, dom, onValueChanged));
  dom.overlay.addEventListener('pointermove', e => onOverlayPointerMove(e, dom, onValueChanged));
  dom.overlay.addEventListener('pointerup',   e => onOverlayPointerUp(e, dom));
  dom.overlay.addEventListener('pointerleave',e => onOverlayPointerUp(e, dom));
  dom.handlesG.addEventListener('pointerdown', e => { if(e.target.classList.contains('handle')) onHandlePointerDown(e, dom); });
  dom.handlesG.addEventListener('pointermove', e => onHandlePointerMove(e, dom, onValueChanged));
  dom.handlesG.addEventListener('pointerup',   e => onHandlePointerUp(e, dom));
  dom.handlesG.addEventListener('pointerleave',e => onHandlePointerUp(e, dom));

  // Touch events (iOS/WebKit compatibility & better control)
  dom.overlay.addEventListener('touchstart', e => { e.preventDefault(); onTouchOverlayStart(e, dom, onValueChanged); }, { passive: false });
  dom.overlay.addEventListener('touchmove',  e => { e.preventDefault(); onTouchOverlayMove(e, dom, onValueChanged); }, { passive: false });
  dom.overlay.addEventListener('touchend',   e => { e.preventDefault(); onOverlayPointerUp({pointerId}); }, { passive: false });

  dom.handlesG.addEventListener('touchstart', e => {
    const t = e.touches?.[0]; if (!t) return;
    const tgt = e.target;
    if (tgt.classList && tgt.classList.contains('handle')) { e.preventDefault(); onHandlePointerDown({ pointerId: 999, target: tgt }, dom); }
  }, { passive: false });
  dom.handlesG.addEventListener('touchmove',  e => { e.preventDefault();
    const t=e.touches?.[0]; if(!t) return;
    // synthesize pointer-like object for reuse
    onHandlePointerMove({ pointerId, clientX: t.clientX, clientY: t.clientY }, dom, onValueChanged);
  }, { passive: false });
  dom.handlesG.addEventListener('touchend',   e => { e.preventDefault(); onHandlePointerUp({ pointerId }); }, { passive: false });
  
// Helpers for touch overlay
function onTouchOverlayStart(e, dom, onValueChanged){
  const t=e.touches?.[0]; if(!t) return;
  const pt=clientToSvg(dom.svg, t.clientX,t.clientY), dx=pt.x-CX, dy=pt.y-CY, theta=Math.atan2(dy,dx), r=Math.sqrt(dx*dx+dy*dy);
  const index=nearestAxisIndex(theta), newVal=radiusToValue(clamp(r,0,RADIUS));
  // use a synthetic pointerId for touch series
  pointerId = 888;
  setValue(index, newVal, {announce:true, dom, onValueChanged}); draggingIndex=index;
}
function onTouchOverlayMove(e, dom, onValueChanged){
  const t=e.touches?.[0]; if(draggingIndex===null || !t) return;
  const pt=clientToSvg(dom.svg, t.clientX,t.clientY), dx=pt.x-CX, dy=pt.y-CY, r=Math.sqrt(dx*dx+dy*dy);
  setValue(draggingIndex, radiusToValue(clamp(r,0,RADIUS)), {dom, onValueChanged});
}

}

let draggingIndex = null, pointerId = null;

export function drawWheel(dom) {
  // Clear groups
  dom.ringsG.innerHTML=''; dom.axesG.innerHTML=''; dom.ticksG.innerHTML='';
  dom.labelsG.innerHTML=''; dom.handlesG.innerHTML=''; dom.bandsG.innerHTML='';

  state.paletteHues = buildPalette(state.categories.length);

  // Rings per unit (robust major line detection)
  for(let r=BAND_THICKNESS; r<=RADIUS+0.001; r+=BAND_THICKNESS){
    const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx',CX); c.setAttribute('cy',CY); c.setAttribute('r',r.toFixed(2));
    const level = r / BAND_THICKNESS;
    const isMajor = Math.abs(level % 5) < 0.01;
    c.setAttribute('class','ring'); c.setAttribute('stroke-width', isMajor ? '1.4' : '1.0');
    dom.ringsG.appendChild(c);
  }

  // Axes, ticks, labels, handles
  const count=state.categories.length, step=stepAngle(count);
  for(let i=0;i<count;i++){
    const theta=angleForIndex(i,count), end=pointOnCircle(theta,RADIUS);
    const axis=document.createElementNS('http://www.w3.org/2000/svg','line');
    axis.setAttribute('x1',CX); axis.setAttribute('y1',CY); axis.setAttribute('x2',end.x.toFixed(2)); axis.setAttribute('y2',end.y.toFixed(2)); axis.setAttribute('class','axis'); dom.axesG.appendChild(axis);

    for(let v=1; v<MAX_VALUE; v++){
      const tPt=pointOnCircle(theta,v*BAND_THICKNESS);
      const tick=document.createElementNS('http://www.w3.org/2000/svg','circle');
      tick.setAttribute('cx',tPt.x.toFixed(2)); tick.setAttribute('cy',tPt.y.toFixed(2)); tick.setAttribute('r','1.6'); tick.setAttribute('class','tick'); dom.ticksG.appendChild(tick);
    }

    const labelR=RADIUS+18, labelPt=pointOnCircle(theta,labelR);
    const lab=document.createElementNS('http://www.w3.org/2000/svg','text');
    lab.setAttribute('x',labelPt.x.toFixed(2)); lab.setAttribute('y',labelPt.y.toFixed(2)); lab.setAttribute('class','cat-label');
    lab.setAttribute('text-anchor',(Math.abs(Math.cos(theta))<0.3)?'middle':(Math.cos(theta)>0?'start':'end'));
    lab.setAttribute('dominant-baseline',(Math.sin(theta)>0.3)?'hanging':(Math.sin(theta)<-0.3?'baseline':'middle'));
    lab.textContent=state.categories[i]; dom.labelsG.appendChild(lab);

    const hv=state.values[i], hp=pointOnCircle(theta,valueToRadius(hv));
    const handle=document.createElementNS('http://www.w3.org/2000/svg','circle');
    handle.setAttribute('cx',hp.x.toFixed(2)); handle.setAttribute('cy',hp.y.toFixed(2)); handle.setAttribute('r',8);
    handle.setAttribute('data-index',i); handle.setAttribute('class','handle'); dom.handlesG.appendChild(handle);
  }

  buildBands(dom);
  updateBands(dom);
}

export function buildBands(dom){
  const count=state.categories.length;
  for(let i=0;i<count;i++){
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('class','category-bands'); g.setAttribute('data-index',i); dom.bandsG.appendChild(g);
  }
}

export function updateBands(dom){
  const count=state.categories.length, step=stepAngle(count);
  for(let i=0;i<count;i++){
    const group=dom.bandsG.querySelector(`.category-bands[data-index="${i}"]`); group.innerHTML='';
    const hue=state.paletteHues[i];
    const v=state.values[i], full=Math.floor(v), frac=v-full;

    if(count===1){
      for(let j=0;j<full;j++){
        const r0=j*BAND_THICKNESS, r1=(j+1)*BAND_THICKNESS;
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('class','band'); path.setAttribute('d', fullRingPath(r0,r1)); path.setAttribute('fill', bandColor(hue, j+1));
        group.appendChild(path);
      }
      if(frac>0){
        const r0=full*BAND_THICKNESS, r1=r0 + frac*BAND_THICKNESS;
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('class','band'); path.setAttribute('d', fullRingPath(r0,r1)); path.setAttribute('fill', bandColor(hue, full+1));
        group.appendChild(path);
      }
      continue;
    }

    const thetaCenter=angleForIndex(i,count), start=thetaCenter - step/2, end=thetaCenter + step/2;
    for(let j=0;j<full;j++){
      const r0=j*BAND_THICKNESS, r1=(j+1)*BAND_THICKNESS;
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('class','band'); path.setAttribute('d', annularSectorPath(r0,r1,start,end)); path.setAttribute('fill', bandColor(hue, j+1));
      group.appendChild(path);
    }
    if(frac>0){
      const r0=full*BAND_THICKNESS, r1=r0 + frac*BAND_THICKNESS;
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('class','band'); path.setAttribute('d', annularSectorPath(r0,r1,start,end)); path.setAttribute('fill', bandColor(hue, full+1));
      group.appendChild(path);
    }
  }
}

export function moveHandlesToValues(dom){
  const count=state.categories.length, handles=dom.handlesG.querySelectorAll('.handle');
  handles.forEach((h,i)=>{ const th=angleForIndex(i,count); const p=pointOnCircle(th, valueToRadius(state.values[i])); h.setAttribute('cx',p.x.toFixed(2)); h.setAttribute('cy',p.y.toFixed(2)); });
}

export function updateLegend(dom){
  dom.legend.innerHTML='';
  const frag = document.createDocumentFragment();
  for(let i=0;i<state.categories.length;i++){
    const row=document.createElement('div'); row.className='row';
    const sw=document.createElement('div'); sw.className='swatch'; sw.style.background = bandColor(state.paletteHues[i], MAX_VALUE);
    const nm=document.createElement('div'); nm.className='name'; nm.textContent=state.categories[i];
    const val=document.createElement('div'); val.className='val'; val.textContent=state.values[i].toFixed(1);
    row.appendChild(sw); row.appendChild(nm); row.appendChild(val);
    frag.appendChild(row);
  }
  dom.legend.appendChild(frag);
}

export function updateStats(dom){
  const avg = state.values.reduce((a,b)=>a+b,0)/state.values.length;
  const std = Math.sqrt(state.values.reduce((s,v)=>s+Math.pow(v-avg,2),0)/state.values.length);
  dom.avgVal.textContent = avg.toFixed(1);
  dom.minVal.textContent = Math.min(...state.values).toFixed(1);
  dom.maxVal.textContent = Math.max(...state.values).toFixed(1);
  dom.stdVal.textContent = std.toFixed(2);
}

// Accessibility
export function buildA11yControls(dom, onValueChanged){
  dom.legend.querySelectorAll('.row').forEach((row,i)=>{
    row.setAttribute('tabindex','0'); row.setAttribute('role','slider'); row.setAttribute('aria-valuemin','0'); row.setAttribute('aria-valuemax','10');
    row.setAttribute('aria-valuenow', state.values[i].toFixed(1)); row.setAttribute('aria-label', `${state.categories[i]} score`);
    row.setAttribute('aria-orientation','horizontal');
    row.setAttribute('aria-valuetext', `${state.values[i].toFixed(1)} of 10`);
    row.addEventListener('keydown',(e)=>{
      if(e.key==='ArrowRight'||e.key==='ArrowUp'){
        setValue(i, clamp(roundTo(state.values[i]+STEP_FINE,STEP_FINE),0,MAX_VALUE), {announce:true, dom, onValueChanged});
        row.setAttribute('aria-valuenow', state.values[i].toFixed(1));
        row.setAttribute('aria-valuetext', `${state.values[i].toFixed(1)} of 10`);
        e.preventDefault();
      } else if(e.key==='ArrowLeft'||e.key==='ArrowDown'){
        setValue(i, clamp(roundTo(state.values[i]-STEP_FINE,STEP_FINE),0,MAX_VALUE), {announce:true, dom, onValueChanged});
        row.setAttribute('aria-valuenow', state.values[i].toFixed(1));
        row.setAttribute('aria-valuetext', `${state.values[i].toFixed(1)} of 10`);
        e.preventDefault();
      } else if(e.key==='PageUp'){
        setValue(i, clamp(roundTo(state.values[i]+STEP_COARSE,STEP_FINE),0,MAX_VALUE), {announce:true, dom, onValueChanged});
        row.setAttribute('aria-valuenow', state.values[i].toFixed(1));
        row.setAttribute('aria-valuetext', `${state.values[i].toFixed(1)} of 10`);
        e.preventDefault();
      } else if(e.key==='PageDown'){
        setValue(i, clamp(roundTo(state.values[i]-STEP_COARSE,STEP_FINE),0,MAX_VALUE), {announce:true, dom, onValueChanged});
        row.setAttribute('aria-valuenow', state.values[i].toFixed(1));
        row.setAttribute('aria-valuetext', `${state.values[i].toFixed(1)} of 10`);
        e.preventDefault();
      } else if(e.key==='Home'){
        setValue(i, 0, {announce:true, dom, onValueChanged}); row.setAttribute('aria-valuenow', state.values[i].toFixed(1)); row.setAttribute('aria-valuetext', `${state.values[i].toFixed(1)} of 10`); e.preventDefault();
      } else if(e.key==='End'){
        setValue(i, 10, {announce:true, dom, onValueChanged}); row.setAttribute('aria-valuenow', state.values[i].toFixed(1)); row.setAttribute('aria-valuetext', `${state.values[i].toFixed(1)} of 10`); e.preventDefault();
      }
    });
  });
}

export function setValue(i, v, {announce=false, dom, onValueChanged}={}){
  const snapped = roundTo(v, STEP_FINE); state.values[i] = snapped;
  updateBands(dom); moveHandlesToValues(dom); updateLegend(dom); updateStats(dom);
  saveLocal();
  if (onValueChanged) onValueChanged(i, snapped);
  if (announce && dom.liveRegion) dom.liveRegion.textContent = `${state.categories[i]} set to ${state.values[i].toFixed(1)} of 10.`;
}

// Pointer handlers
function onOverlayPointerDown(e, dom, onValueChanged){
  dom.overlay.setPointerCapture(e.pointerId); pointerId=e.pointerId;
  const pt=clientToSvg(dom.svg, e.clientX,e.clientY), dx=pt.x-CX, dy=pt.y-CY, theta=Math.atan2(dy,dx), r=Math.sqrt(dx*dx+dy*dy);
  const index=nearestAxisIndex(theta), newVal=radiusToValue(clamp(r,0,RADIUS));
  setValue(index, newVal, {announce:true, dom, onValueChanged}); draggingIndex=index;
}
function onOverlayPointerMove(e, dom, onValueChanged){
  if(draggingIndex===null || e.pointerId!==pointerId) return;
  const pt=clientToSvg(dom.svg, e.clientX,e.clientY), dx=pt.x-CX, dy=pt.y-CY, r=Math.sqrt(dx*dx+dy*dy);
  setValue(draggingIndex, radiusToValue(clamp(r,0,RADIUS)), {dom, onValueChanged});
}
function onOverlayPointerUp(e, dom){ if(e.pointerId===pointerId){ dom.overlay.releasePointerCapture(e.pointerId); draggingIndex=null; pointerId=null; saveLocal(); } }
function onHandlePointerDown(e, dom){ const idx=parseInt(e.target.getAttribute('data-index'),10); dom.handlesG.setPointerCapture(e.pointerId); pointerId=e.pointerId; draggingIndex=idx; }
function onHandlePointerMove(e, dom, onValueChanged){
  if(draggingIndex===null || e.pointerId!==pointerId) return;
  const pt=clientToSvg(dom.svg, e.clientX,e.clientY), dx=pt.x-CX, dy=pt.y-CY, r=Math.sqrt(dx*dx+dy*dy);
  setValue(draggingIndex, radiusToValue(clamp(r,0,RADIUS)), {dom, onValueChanged});
}
function onHandlePointerUp(e, dom){ if(e.pointerId===pointerId){ dom.handlesG.releasePointerCapture(e.pointerId); draggingIndex=null; pointerId=null; saveLocal(); } }

function clientToSvg(svg, x,y){ const p=svg.createSVGPoint(); p.x=x; p.y=y; const m=svg.getScreenCTM(); return p.matrixTransform(m.inverse()); }
function nearestAxisIndex(theta){
  const count=state.categories.length; let best=0, bestDiff=Infinity;
  for(let i=0;i<count;i++){
    const a=angleForIndex(i,count); const diff=Math.abs(Math.atan2(Math.sin(theta-a), Math.cos(theta-a)));
    if(diff<bestDiff){ bestDiff=diff; best=i; }
  }
  return best;
}

// PNG export
export function exportPNG(dom){
  const inlineStyle = `.ring{stroke:#29305a;fill:none}.axis{stroke:#34406f;stroke-width:1.25}.tick{stroke:#2f3967;stroke-width:.9}.cat-label{font-size:12px;fill:#b9c2ff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}.handle{fill:#ffd166;stroke:#2d244f;stroke-width:2}.center-dot{fill:#8fd3ff;opacity:.7}.overlay{fill:transparent}.band{stroke:#2a325b;stroke-width:.6;stroke-linejoin:round}`;
  const clone=dom.svg.cloneNode(true);
  const style=document.createElementNS('http://www.w3.org/2000/svg','style'); style.setAttribute('type','text/css'); style.textContent=inlineStyle;
  const defs=clone.querySelector('defs'); if(defs){ defs.parentNode.insertBefore(style, defs.nextSibling); } else { clone.insertBefore(style, clone.firstChild); }
  const serializer=new XMLSerializer(); let svgStr=serializer.serializeToString(clone);
  if(!svgStr.includes('xmlns="http://www.w3.org/2000/svg"')) svgStr=svgStr.replace('<svg','<svg xmlns="http://www.w3.org/2000/svg"');
  const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgStr);
  const canvas=document.createElement('canvas'); canvas.width=SIZE; canvas.height=SIZE; const ctx=canvas.getContext('2d');
  const img=new Image(); img.onload=()=>{ ctx.clearRect(0,0,SIZE,SIZE); ctx.drawImage(img,0,0,SIZE,SIZE); const png=canvas.toDataURL('image/png'); const a=document.createElement('a'); a.href=png; const d=new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'); a.download=`wheel-of-life-${d}.png`; document.body.appendChild(a); a.click(); a.remove(); };
  img.onerror=()=>alert('Export failed: browser blocked inline SVG rasterization.'); img.src=url;
}
