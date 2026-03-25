// js/state.js
export const MAX_VALUE = 10;
export const SIZE = 1100;
export const CX = SIZE / 2;
export const CY = SIZE / 2;
export const MARGIN = 60;
export const RADIUS = (SIZE / 2) - MARGIN - 30;
export const BAND_THICKNESS = RADIUS / MAX_VALUE;

export const STEP_FINE = 0.5;
export const STEP_COARSE = 1.0;

export const STATE_KEY = 'wheelOfLifeState.v8';
export const SNAPSHOTS_KEY = 'wheelOfLifeSnapshots.v1';

/* Disable mode for action steps: 'floor' | 'round' | 'ceil' */
export const DISABLE_MODE = 'ceil';

/* Saturation curve for bands */
export const SAT_MIN = 30, SAT_MAX = 80, LIGHTNESS = 52;

export const DEFAULT_CATEGORIES = [
  "Career","Finance","Health","Family & Friends","Romance",
  "Personal Growth","Fun & Recreation","Physical Environment"
];

// --- State (mutable) ---
export const state = {
  categories: [...DEFAULT_CATEGORIES],
  values: new Array(DEFAULT_CATEGORIES.length).fill(5),
  notes: new Array(DEFAULT_CATEGORIES.length).fill(''),
  steps: new Array(DEFAULT_CATEGORIES.length).fill(null).map(() => new Array(10).fill('')),
  snapshots: [],
  paletteHues: [],        // set during draw
};

// Persistence
export function saveLocal() {
  const payload = {
    categories: state.categories,
    values: state.values,
    notes: state.notes,
    steps: state.steps,
    ts: Date.now()
  };
  try { localStorage.setItem(STATE_KEY, JSON.stringify(payload)); } catch (e) {}
}
export function loadLocal() {
  try {
    const raw = localStorage.getItem(STATE_KEY); if (!raw) return false;
    const obj = JSON.parse(raw);
    if (!obj || !obj.categories || !obj.values) return false;
    state.categories = obj.categories;
    state.values = obj.values.map(v => Math.round(v / STEP_FINE) * STEP_FINE);
    state.notes = obj.notes || new Array(state.categories.length).fill('');
    state.steps = (obj.steps && Array.isArray(obj.steps))
      ? obj.steps.map(arr => (Array.isArray(arr)
          ? arr.slice(0,10).concat(new Array(Math.max(0,10-(arr.length||0))).fill(''))
          : new Array(10).fill('')))
      : new Array(state.categories.length).fill(null).map(() => new Array(10).fill(''));
    ensureArrayLengths();
    return true;
  } catch (e) { return false; }
}
export function ensureArrayLengths() {
  if (state.values.length !== state.categories.length) state.values = new Array(state.categories.length).fill(5);
  if (state.notes.length !== state.categories.length) state.notes = new Array(state.categories.length).fill('');
  if (state.steps.length !== state.categories.length) state.steps = new Array(state.categories.length).fill(null).map(() => new Array(10).fill(''));
}

// Snapshots
export function saveSnapshots() {
  try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify({snaps: state.snapshots})); } catch (e) {}
}
export function loadSnapshots() {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY); if (!raw) return false;
    const obj = JSON.parse(raw); if (!obj || !obj.snaps) return false;
    state.snapshots = obj.snaps; return true;
  } catch (e) { return false; }
}

// Utility specific to steps disabling
export function disabledCountForValue(v) {
  if (DISABLE_MODE==='ceil') return Math.min(MAX_VALUE, Math.ceil(v));
  if (DISABLE_MODE==='round') return Math.min(MAX_VALUE, Math.round(v));
  return Math.min(MAX_VALUE, Math.floor(v));
}