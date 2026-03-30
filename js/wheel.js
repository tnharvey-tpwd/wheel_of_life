import { state, saveLocal } from './state.js';
import { MAX_VALUE, CX, CY, RADIUS, BAND_THICKNESS, STEP_FINE, STEP_COARSE, angleForIndex, stepAngle, pointOnCircle, valueToRadius, radiusToValue, clamp, roundTo, bandColor, arrayAvg, arrayStd } from './utils.js';

const svgEl = document.getElementById('wheel');
const ringsG = document.getElementById('rings');
const axesG = document.getElementById('axes');
const ticksG = document.getElementById('ticks');
const bandsG = document.getElementById('bands');
const labelsG = document.getElementById('labels');
const handlesG = document.getElementById('handles');
const overlayEl = document.querySelector('.overlay');
const legendEl = document.getElementById('legend');
const liveRegion = document.getElementById('liveRegion');

let draggingIndex = null;
let pointerId = null;
let onWheelCommitCallback = null;

export function initWheel(onCommit) {
  onWheelCommitCallback = onCommit;
  overlayEl.addEventListener('pointerdown', onOverlayPointerDown);
  overlayEl.addEventListener('pointermove', onOverlayPointerMove);
  overlayEl.addEventListener('pointerup', onOverlayPointerUp);
  overlayEl.addEventListener('pointerleave', onOverlayPointerUp);
  handlesG.addEventListener('pointerdown', (e) => { if (e.target.classList.contains('handle')) onHandlePointerDown(e); });
  handlesG.addEventListener('pointermove', onHandlePointerMove);
  handlesG.addEventListener('pointerup', onHandlePointerUp);
  handlesG.addEventListener('pointerleave', onHandlePointerUp);
  drawBase();
}

export function drawBase() {
  ringsG.innerHTML = ''; axesG.innerHTML = ''; ticksG.innerHTML = ''; labelsG.innerHTML = ''; handlesG.innerHTML = ''; bandsG.innerHTML = '';
  const rFrag = document.createDocumentFragment();
  for (let r = BAND_THICKNESS; r <= RADIUS + 0.001; r += BAND_THICKNESS) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', CX); c.setAttribute('cy', CY); c.setAttribute('r', r.toFixed(2));
    const isMajor = Math.abs((r / BAND_THICKNESS) % 5) < 0.01;
    c.setAttribute('class', 'ring'); c.setAttribute('stroke-width', isMajor ? '1.4' : '1.0');
    rFrag.appendChild(c);
  }
  ringsG.appendChild(rFrag);

  const aFrag = document.createDocumentFragment(), tFrag = document.createDocumentFragment(), lFrag = document.createDocumentFragment(), hFrag = document.createDocumentFragment();
  const count = state.categories.length;

  for (let i = 0; i < count; i++) {
    const theta = angleForIndex(i, count), end = pointOnCircle(theta, RADIUS);
    const axis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axis.setAttribute('x1', CX); axis.setAttribute('y1', CY); axis.setAttribute('x2', end.x.toFixed(2)); axis.setAttribute('y2', end.y.toFixed(2)); axis.setAttribute('class', 'axis'); aFrag.appendChild(axis);
    
    for (let v = 1; v < MAX_VALUE; v++) {
      const tPt = pointOnCircle(theta, v * BAND_THICKNESS);
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      tick.setAttribute('cx', tPt.x.toFixed(2)); tick.setAttribute('cy', tPt.y.toFixed(2)); tick.setAttribute('r', '1.6'); tick.setAttribute('class', 'tick'); tFrag.appendChild(tick);
    }
    
    const labelR = RADIUS + 18, labelPt = pointOnCircle(theta, labelR);
    const lab = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lab.setAttribute('x', labelPt.x.toFixed(2)); lab.setAttribute('y', labelPt.y.toFixed(2)); lab.setAttribute('class', 'cat-label');
    lab.setAttribute('text-anchor', (Math.abs(Math.cos(theta)) < 0.3) ? 'middle' : (Math.cos(theta) > 0 ? 'start' : 'end'));
    lab.setAttribute('dominant-baseline', (Math.sin(theta) > 0.3) ? 'hanging' : (Math.sin(theta) < -0.3 ? 'baseline' : 'middle'));
    lab.textContent = state.categories[i]; lFrag.appendChild(lab);

    const hp = pointOnCircle(theta, valueToRadius(state.values[i]));
    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    handle.setAttribute('cx', hp.x.toFixed(2)); handle.setAttribute('cy', hp.y.toFixed(2)); handle.setAttribute('r', 8);
    handle.setAttribute('data-index', i); handle.setAttribute('class', 'handle'); hFrag.appendChild(handle);
  }
  axesG.appendChild(aFrag); ticksG.appendChild(tFrag); labelsG.appendChild(lFrag); handlesG.appendChild(hFrag);

  buildBands(); updateBands(); updateLegend(); updateStats(); buildA11yControls();
}

function buildBands() {
  for (let i = 0; i < state.categories.length; i++) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'category-bands'); g.setAttribute('data-index', i); bandsG.appendChild(g);
  }
}

function fullRingPath(r0, r1) {
  const a0 = -Math.PI / 2, pSo = pointOnCircle(a0, r1), pMidO = pointOnCircle(a0 + Math.PI, r1), pSi = pointOnCircle(a0, r0), pMidI = pointOnCircle(a0 + Math.PI, r0);
  return `M ${pSo.x.toFixed(2)} ${pSo.y.toFixed(2)} A ${r1.toFixed(2)} ${r1.toFixed(2)} 0 1 1 ${pMidO.x.toFixed(2)} ${pMidO.y.toFixed(2)} A ${r1.toFixed(2)} ${r1.toFixed(2)} 0 1 1 ${pSo.x.toFixed(2)} ${pSo.y.toFixed(2)} L ${pSi.x.toFixed(2)} ${pSi.y.toFixed(2)} A ${r0.toFixed(2)} ${r0.toFixed(2)} 0 1 0 ${pMidI.x.toFixed(2)} ${pMidI.y.toFixed(2)} A ${r0.toFixed(2)} ${r0.toFixed(2)} 0 1 0 ${pSi.x.toFixed(2)} ${pSi.y.toFixed(2)} Z`;
}

function annularSectorPath(r0, r1, start, end) {
  const sweep = end - start, LAF = (Math.abs(sweep) > Math.PI) ? 1 : 0;
  const pSi = pointOnCircle(start, r0), pEi = pointOnCircle(end, r0), pEo = pointOnCircle(end, r1), pSo = pointOnCircle(start, r1);
  if (r0 < 0.0001) return `M ${CX} ${CY} L ${pSo.x.toFixed(2)} ${pSo.y.toFixed(2)} A ${r1.toFixed(2)} ${r1.toFixed(2)} 0 ${LAF} 1 ${pEo.x.toFixed(2)} ${pEo.y.toFixed(2)} Z`;
  return `M ${pSo.x.toFixed(2)} ${pSo.y.toFixed(2)} A ${r1.toFixed(2)} ${r1.toFixed(2)} 0 ${LAF} 1 ${pEo.x.toFixed(2)} ${pEo.y.toFixed(2)} L ${pEi.x.toFixed(2)} ${pEi.y.toFixed(2)} A ${r0.toFixed(2)} ${r0.toFixed(2)} 0 ${LAF} 0 ${pSi.x.toFixed(2)} ${pSi.y.toFixed(2)} Z`;
}

function updateBands() {
  const count = state.categories.length, step = stepAngle(count);
  for (let i = 0; i < count; i++) {
    const group = bandsG.querySelector(`.category-bands[data-index="${i}"]`); group.innerHTML = '';
    const hue = state.paletteHues[i], v = state.values[i], full = Math.floor(v), frac = v - full;
    const bFrag = document.createDocumentFragment();

    if (count === 1) {
      for (let j = 0; j < full; j++) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'band'); path.setAttribute('d', fullRingPath(j * BAND_THICKNESS, (j + 1) * BAND_THICKNESS)); path.setAttribute('fill', bandColor(hue, j + 1)); bFrag.appendChild(path);
      }
      if (frac > 0) {
        const r0 = full * BAND_THICKNESS;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'band'); path.setAttribute('d', fullRingPath(r0, r0 + frac * BAND_THICKNESS)); path.setAttribute('fill', bandColor(hue, full + 1)); bFrag.appendChild(path);
      }
      group.appendChild(bFrag); continue;
    }

    const thetaCenter = angleForIndex(i, count), start = thetaCenter - step / 2, end = thetaCenter + step / 2;
    for (let j = 0; j < full; j++) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'band'); path.setAttribute('d', annularSectorPath(j * BAND_THICKNESS, (j + 1) * BAND_THICKNESS, start, end)); path.setAttribute('fill', bandColor(hue, j + 1)); bFrag.appendChild(path);
    }
    if (frac > 0) {
      const r0 = full * BAND_THICKNESS;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'band'); path.setAttribute('d', annularSectorPath(r0, r0 + frac * BAND_THICKNESS, start, end)); path.setAttribute('fill', bandColor(hue, full + 1)); bFrag.appendChild(path);
    }
    group.appendChild(bFrag);
  }
}

function updateLegend() {
  legendEl.innerHTML = ''; const frag = document.createDocumentFragment();
  for (let i = 0; i < state.categories.length; i++) {
    const row = document.createElement('div'); row.className = 'row';
    const sw = document.createElement('div'); sw.className = 'swatch'; sw.style.background = bandColor(state.paletteHues[i], MAX_VALUE);
    const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = state.categories[i];
    const val = document.createElement('div'); val.className = 'val'; val.textContent = state.values[i].toFixed(1);
    row.appendChild(sw); row.appendChild(nm); row.appendChild(val); frag.appendChild(row);
  }
  legendEl.appendChild(frag);
}

function updateStats() {
  document.getElementById('avgVal').textContent = arrayAvg(state.values).toFixed(1);
  document.getElementById('minVal').textContent = Math.min(...state.values).toFixed(1);
  document.getElementById('maxVal').textContent = Math.max(...state.values).toFixed(1);
  document.getElementById('stdVal').textContent = arrayStd(state.values).toFixed(2);
}

function moveHandlesToValues() {
  const handles = handlesG.querySelectorAll('.handle');
  handles.forEach((h, i) => { 
    const p = pointOnCircle(angleForIndex(i, state.categories.length), valueToRadius(state.values[i])); 
    h.setAttribute('cx', p.x.toFixed(2)); h.setAttribute('cy', p.y.toFixed(2)); 
  });
}

function setPreviewValue(i, v, opts = {}) {
  state.values[i] = roundTo(v, STEP_FINE);
  updateBands(); moveHandlesToValues(); updateLegend(); updateStats();
  if (opts.announce) liveRegion.textContent = `${state.categories[i]} set to ${state.values[i].toFixed(1)} of 10.`;
}

function commitValue(i, v, opts = {}) {
  setPreviewValue(i, v, opts);
  saveLocal();
  if(onWheelCommitCallback) onWheelCommitCallback();
}

function nearestAxisIndex(theta) {
  let best = 0, bestDiff = Infinity;
  for (let i = 0; i < state.categories.length; i++) {
    const diff = Math.abs(Math.atan2(Math.sin(theta - angleForIndex(i, state.categories.length)), Math.cos(theta - angleForIndex(i, state.categories.length))));
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return best;
}

function clientToSvg(x, y) { const p = svgEl.createSVGPoint(); p.x = x; p.y = y; return p.matrixTransform(svgEl.getScreenCTM().inverse()); }

function onOverlayPointerDown(e) { overlayEl.setPointerCapture(e.pointerId); pointerId = e.pointerId; const pt = clientToSvg(e.clientX, e.clientY); draggingIndex = nearestAxisIndex(Math.atan2(pt.y - CY, pt.x - CX)); commitValue(draggingIndex, radiusToValue(clamp(Math.sqrt((pt.x - CX) ** 2 + (pt.y - CY) ** 2), 0, RADIUS)), { announce: true }); }
function onOverlayPointerMove(e) { if (draggingIndex !== null && e.pointerId === pointerId) { const pt = clientToSvg(e.clientX, e.clientY); setPreviewValue(draggingIndex, radiusToValue(clamp(Math.sqrt((pt.x - CX) ** 2 + (pt.y - CY) ** 2), 0, RADIUS))); } }
function onOverlayPointerUp(e) { if (e.pointerId === pointerId) { overlayEl.releasePointerCapture(e.pointerId); commitValue(draggingIndex, state.values[draggingIndex]); draggingIndex = null; pointerId = null; } }

function onHandlePointerDown(e) { handlesG.setPointerCapture(e.pointerId); pointerId = e.pointerId; draggingIndex = parseInt(e.target.getAttribute('data-index'), 10); }
function onHandlePointerMove(e) { if (draggingIndex !== null && e.pointerId === pointerId) { const pt = clientToSvg(e.clientX, e.clientY); setPreviewValue(draggingIndex, radiusToValue(clamp(Math.sqrt((pt.x - CX) ** 2 + (pt.y - CY) ** 2), 0, RADIUS))); } }
function onHandlePointerUp(e) { if (e.pointerId === pointerId) { handlesG.releasePointerCapture(e.pointerId); commitValue(draggingIndex, state.values[draggingIndex]); draggingIndex = null; pointerId = null; } }

function buildA11yControls() {
  legendEl.querySelectorAll('.row').forEach((row, i) => {
    row.setAttribute('tabindex', '0'); row.setAttribute('role', 'slider'); row.setAttribute('aria-valuemin', '0'); row.setAttribute('aria-valuemax', '10');
    row.setAttribute('aria-valuenow', state.values[i].toFixed(1)); row.setAttribute('aria-label', `${state.categories[i]} score`);
    row.addEventListener('keydown', (e) => {
      let handled = false, newVal = state.values[i];
      if (['ArrowRight', 'ArrowUp'].includes(e.key)) { newVal += STEP_FINE; handled = true; }
      else if (['ArrowLeft', 'ArrowDown'].includes(e.key)) { newVal -= STEP_FINE; handled = true; }
      else if (e.key === 'PageUp') { newVal += STEP_COARSE; handled = true; }
      else if (e.key === 'PageDown') { newVal -= STEP_COARSE; handled = true; }
      else if (e.key === 'Home') { newVal = 0; handled = true; }
      else if (e.key === 'End') { newVal = 10; handled = true; }
      if (handled) { commitValue(i, clamp(roundTo(newVal), 0, MAX_VALUE), { announce: true }); row.setAttribute('aria-valuenow', state.values[i].toFixed(1)); e.preventDefault(); }
    });
  });
}
