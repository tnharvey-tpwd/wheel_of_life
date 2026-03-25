// js/utils.js
import { MAX_VALUE, RADIUS, CX, CY, STEP_FINE, SAT_MIN, SAT_MAX, LIGHTNESS } from './state.js';

export function angleForIndex(i, count){ const step=(2*Math.PI)/count; return -Math.PI/2 + (i*step); }
export function stepAngle(count){ return (2*Math.PI)/count; }
export function pointOnCircle(theta, r){ return { x: CX + r*Math.cos(theta), y: CY + r*Math.sin(theta) }; }
export function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
export function roundTo(v, step=STEP_FINE){ return Math.round(v/step)*step; }
export function valueToRadius(v){ return (v / MAX_VALUE) * RADIUS; }
export function radiusToValue(r){ return clamp(roundTo((r / RADIUS) * MAX_VALUE, STEP_FINE), 0, MAX_VALUE); }
export function fmtDate(ts){ return new Date(ts).toLocaleString(); }
export function arrayAvg(arr){ return arr.reduce((a,b)=>a+b,0)/arr.length; }
export function arrayStd(arr){ const avg=arrayAvg(arr); return Math.sqrt(arr.reduce((s,v)=>s+Math.pow(v-avg,2),0)/arr.length); }
export function hslToHex(h, s, l){
  s/=100; l/=100;
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
  let r=0,g=0,b=0;
  if(h<60){ r=c; g=x; } else if(h<120){ r=x; g=c; }
  else if(h<180){ g=c; b=x; } else if(h<240){ g=x; b=c; }
  else if(h<300){ r=x; b=c; } else { r=c; b=x; }
  r=Math.round((r+m)*255); g=Math.round((g+m)*255); b=Math.round((b+m)*255);
  const toHex=v=>v.toString(16).padStart(2,'0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
export function buildPalette(count){ return Array.from({length:count},(_,i)=> (i*360)/count ); }
export function bandColor(hue, bandIndex){ const s=SAT_MIN + (bandIndex/MAX_VALUE)*(SAT_MAX-SAT_MIN); return hslToHex(hue, s, LIGHTNESS); }

// SVG paths
export function fullRingPath(r0, r1){
  const a0 = -Math.PI/2;
  const pSo = pointOnCircle(a0, r1);
  const pMidO = pointOnCircle(a0 + Math.PI, r1);
  const pSi = pointOnCircle(a0, r0);
  const pMidI = pointOnCircle(a0 + Math.PI, r0);
  return [
    `M ${pSo.x.toFixed(2)} ${pSo.y.toFixed(2)}`,
    `A ${r1.toFixed(2)} ${r1.toFixed(2)} 0 1 1 ${pMidO.x.toFixed(2)} ${pMidO.y.toFixed(2)}`,
    `A ${r1.toFixed(2)} ${r1.toFixed(2)} 0 1 1 ${pSo.x.toFixed(2)} ${pSo.y.toFixed(2)}`,
    `L ${pSi.x.toFixed(2)} ${pSi.y.toFixed(2)}`,
    `A ${r0.toFixed(2)} ${r0.toFixed(2)} 0 1 0 ${pMidI.x.toFixed(2)} ${pMidI.y.toFixed(2)}`,
    `A ${r0.toFixed(2)} ${r0.toFixed(2)} 0 1 0 ${pSi.x.toFixed(2)} ${pSi.y.toFixed(2)}`,
    `Z`
  ].join(' ');
}
export function annularSectorPath(r0,r1,start,end){
  const sweep = end - start;
  const LAF = (Math.abs(sweep) > Math.PI) ? 1 : 0;
  const pSi=pointOnCircle(start,r0), pEi=pointOnCircle(end,r0), pEo=pointOnCircle(end,r1), pSo=pointOnCircle(start,r1);
  if(r0 < 0.0001){
    return `M ${CX} ${CY} L ${pSo.x.toFixed(2)} ${pSo.y.toFixed(2)} A ${r1.toFixed(2)} ${r1.toFixed(2)} 0 ${LAF} 1 ${pEo.x.toFixed(2)} ${pEo.y.toFixed(2)} Z`;
  }
  return `M ${pSo.x.toFixed(2)} ${pSo.y.toFixed(2)} A ${r1.toFixed(2)} ${r1.toFixed(2)} 0 ${LAF} 1 ${pEo.x.toFixed(2)} ${pEo.y.toFixed(2)} L ${pEi.x.toFixed(2)} ${pEi.y.toFixed(2)} A ${r0.toFixed(2)} ${r0.toFixed(2)} 0 ${LAF} 0 ${pSi.x.toFixed(2)} ${pSi.y.toFixed(2)} Z`;
}
export function pathFromSeries(series, xScale, yScale){
  let d='', pen=false;
  series.forEach(p=>{
    if(p.y==null){ pen=false; return; }
    const x=xScale(p.x), y=yScale(p.y);
    if(!pen){ d+=`M ${x} ${y} `; pen=true; } else { d+=`L ${x} ${y} `; }
  });
  return d.trim();
}
export function seriesMA(series, windowSize){
  const arr=series.map(p=>p.y); const ma=[];
  for(let i=0;i<arr.length;i++){
    let count=0,sum=0;
    for(let j=i-windowSize+1;j<=i;j++){ if(j>=0 && arr[j]!=null){ sum+=arr[j]; count++; } }
    ma.push(count>0 ? sum/count : null);
  }
  return series.map((p,i)=>({x:p.x,y:ma[i]}));
}
export function cssVar(name, fallback=''){
  return (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
}
