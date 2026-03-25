// js/actions.js
import { MAX_VALUE, state, saveLocal, DISABLE_MODE } from './state.js';
import { disabledCountForValue } from './state.js';

export function buildPlansPanel(panelEl){
  panelEl.innerHTML='';
  for(let i=0;i<state.categories.length;i++){
    const row=document.createElement('div'); row.className='plan-row';
    const head=document.createElement('div'); head.className='plan-head';
    const title=document.createElement('div'); title.className='plan-title'; title.textContent=state.categories[i];
    const score=document.createElement('div'); score.className='plan-score'; score.textContent=state.values[i].toFixed(1);
    head.appendChild(title); head.appendChild(score);

    const disabledCount=disabledCountForValue(state.values[i]), enabledCount=MAX_VALUE-disabledCount;
    const stepsHeader=document.createElement('div'); stepsHeader.className='steps-header';
    stepsHeader.textContent=`Steps to write: ${enabledCount} (current score disables ${disabledCount} of 10)`;

    const grid=document.createElement('div'); grid.className='steps-grid';
    if(!Array.isArray(state.steps[i]) || state.steps[i].length!==MAX_VALUE){ state.steps[i]=new Array(MAX_VALUE).fill(''); }
    for(let j=0;j<MAX_VALUE;j++){
      const wrap=document.createElement('div'); wrap.className='step-wrap';
      const label=document.createElement('div'); label.className='step-label'; label.textContent=`Step ${j+1}`;
      const input=document.createElement('input'); input.type='text'; input.className='step'; input.placeholder=`Plan for level ${j+1}`; input.value=state.steps[i][j]||'';
      const isDisabled = j < disabledCount; if(isDisabled) input.setAttribute('disabled','true'); else input.removeAttribute('disabled');
      input.addEventListener('input',()=>{ state.steps[i][j]=input.value; saveLocal(); });
      wrap.appendChild(label); wrap.appendChild(input); grid.appendChild(wrap);
    }

    row.appendChild(head); row.appendChild(stepsHeader); row.appendChild(grid); panelEl.appendChild(row);
  }
}
