import { DEFAULT_CATEGORIES, STEP_FINE, roundTo, buildPalette } from './utils.js';

export const STATE_KEY = 'wheelOfLifeState.v8';
export const SNAPSHOTS_KEY = 'wheelOfLifeSnapshots.v1';

export const state = {
  categories: [...DEFAULT_CATEGORIES],
  values: new Array(DEFAULT_CATEGORIES.length).fill(5),
  notes: new Array(DEFAULT_CATEGORIES.length).fill(''),
  steps: new Array(DEFAULT_CATEGORIES.length).fill(null).map(() => new Array(10).fill('')),
  snapshots: [],
  paletteHues: buildPalette(DEFAULT_CATEGORIES.length)
};

export function ensureArrayLengths() {
  const len = state.categories.length;
  if (state.values.length !== len) state.values = new Array(len).fill(5);
  if (state.notes.length !== len) state.notes = new Array(len).fill('');
  if (state.steps.length !== len) state.steps = new Array(len).fill(null).map(() => new Array(10).fill(''));
  state.paletteHues = buildPalette(len);
}

export function saveLocal() {
  const payload = { categories: state.categories, values: state.values, notes: state.notes, steps: state.steps, ts: Date.now() };
  try { localStorage.setItem(STATE_KEY, JSON.stringify(payload)); } catch (e) {}
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(STATE_KEY); if (!raw) return false;
    const obj = JSON.parse(raw);
    if (!obj || !obj.categories || !obj.values) return false;
    state.categories = obj.categories;
    state.values = obj.values.map(v => roundTo(v, STEP_FINE));
    state.notes = obj.notes || new Array(state.categories.length).fill('');
    state.steps = obj.steps && Array.isArray(obj.steps) ? obj.steps.map(arr => (Array.isArray(arr) ? arr.slice(0, 10).concat(new Array(Math.max(0, 10 - (arr.length || 0))).fill('')) : new Array(10).fill(''))) : new Array(state.categories.length).fill(null).map(() => new Array(10).fill(''));
    ensureArrayLengths();
    return true;
  } catch (e) { return false; }
}

export function saveSnapshots() {
  try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify({ snaps: state.snapshots })); } catch (e) {}
}

export function loadSnapshots() {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY); if (!raw) return false;
    const obj = JSON.parse(raw); if (!obj || !obj.snaps) return false;
    state.snapshots = obj.snaps; return true;
  } catch (e) { return false; }
}
