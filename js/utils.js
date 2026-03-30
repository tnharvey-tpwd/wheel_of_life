/* ---------- CONFIG ---------- */
export const MAX_VALUE = 10;
export const SIZE = 1100;
export const CX = SIZE / 2;
export const CY = SIZE / 2;
export const MARGIN = 60;
export const RADIUS = (SIZE / 2) - MARGIN - 30;
export const BAND_THICKNESS = RADIUS / MAX_VALUE;
export const STEP_FINE = 0.5;
export const STEP_COARSE = 1.0;
export const DISABLE_MODE = 'ceil';
export const SAT_MIN = 30;
export const SAT_MAX = 80;
export const LIGHTNESS = 52;
export const DEFAULT_CATEGORIES = ["Career","Finance","Health","Family & Friends","Romance","Personal Growth","Fun & Recreation","Physical Environment"];

/* ---------- MATH & HELPERS ---------- */
export function angleForIndex(i, count) { const step = (2 * Math.PI) / count; return -Math.PI / 2 + (i * step); }
export function stepAngle(count) { return (2 * Math.PI) / count; }
export function pointOnCircle(theta, r) { return { x: CX + r * Math.cos(theta), y: CY + r * Math.sin(theta) }; }
export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
export function roundTo(v, step = STEP_FINE) { return Math.round(v / step) * step; }
export function valueToRadius(v) { return (v / MAX_VALUE) * RADIUS; }
export function radiusToValue(r) { return clamp(roundTo((r / RADIUS) * MAX_VALUE, STEP_FINE), 0, MAX_VALUE); }
export function fmtDate(ts) { return new Date(ts).toLocaleString(); }
export function arrayAvg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
export function arrayStd(arr) { 
  if(!arr.length) return 0;
  const avg = arrayAvg(arr); 
  return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / arr.length); 
}
export function disabledCountForValue(v) {
  if (DISABLE_MODE === 'ceil') return Math.min(MAX_VALUE, Math.ceil(v));
  if (DISABLE_MODE === 'round') return Math.min(MAX_VALUE, Math.round(v));
  return Math.min(MAX_VALUE, Math.floor(v));
}

/* ---------- COLOR HELPERS ---------- */
export function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  r = Math.round((r + m) * 255); g = Math.round((g + m) * 255); b = Math.round((b + m) * 255);
  const toHex = v => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
export function buildPalette(count) { return Array.from({ length: count }, (_, i) => (i * 360) / count); }
export function bandColor(hue, bandIndex) { 
  const s = SAT_MIN + (bandIndex / MAX_VALUE) * (SAT_MAX - SAT_MIN); 
  return hslToHex(hue, s, LIGHTNESS); 
}
