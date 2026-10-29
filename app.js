const $ = id => document.getElementById(id);
const modelNames = ['DeepBrainNet','BrainAgeNeXt','DBN GAP-512 + ridge','DBN dense-1024 + ridge','BrainAgeNeXt + ridge','DBN GAP + BrainAgeNeXt + ridge','Linear regression','Random forest','XGBoost'];
const groups = [['Published CNNs',modelNames.slice(0,2)],['Ridge heads · frozen CNN features',modelNames.slice(2,6)],['Tissue-volume models · IXI only',modelNames.slice(6)]];
const f = (n, decimals=1) => Number(n).toFixed(decimals);
const signed = n => `${n >= 0 ? '+' : '−'}${f(Math.abs(n))}`;
const escapeHTML = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sex = c => c.sex === 'F' ? 'Female' : 'Male';
let data;
let state = {id:'SALD_031740',filter:'all',query:'',mode:'3d',view:'axial',slice:3,quiz:false,revealed:new Set(),guesses:new Map(),route:'explorer'};
const current = () => data.cases.find(c=>c.id===state.id);
const hiddenAge = c => state.quiz && !state.revealed.has(c.id);
const visibleCases = () => data.cases.filter(c=>{
  const query=state.query.trim().toLowerCase();
  const matches=query==='male'||query==='female'?sex(c).toLowerCase()===query:`${c.id} ${c.cohort} ${c.why} ${sex(c)}`.toLowerCase().includes(query);
  return (state.filter==='all'||c.cohort===state.filter)&&matches;
});
function pressed(container,attr,value){document.querySelectorAll(`#${container} [${attr}]`).forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute(attr)===value)));}

function renderList(){
  const list=visibleCases();
  $('case-count').textContent=`${list.length} ${list.length===1?'case':'cases'}`;
  $('case-list').innerHTML=list.length?list.map(c=>`<button class="case-row" data-case="${c.id}" aria-pressed="${c.id===state.id}" aria-label="${c.id}, ${hiddenAge(c)?'age hidden':f(c.age)+' years'}, ${sex(c)}"><img src="${c.views.axial[3]}" alt="" loading="lazy"><span><span class="case-name">${c.id}</span><span class="case-demographics">${hiddenAge(c)?'Age hidden':f(c.age)+' y'} · ${sex(c)}</span><span class="case-why">${escapeHTML(c.why)}</span></span></button>`).join(''):'<p class="muted">No matching cases. Try a different ID or cohort.</p>';
  pressed('cohort-filters','data-filter',state.filter);
}

function renderMRI(){
  const c=current();
  $('mri-image').src=state.view==='axial'?c.views.axial[state.slice]:c.views[state.view];
  $('mri-image').alt=`${c.id}, ${state.view} preprocessed T1-weighted MRI${state.view==='axial'?`, slice ${state.slice+1} of 7`:''}`;
  const labels={axial:['A','P','L','R'],coronal:['S','I','L','R'],sagittal:['S','I','P','A']}[state.view];
  ['top','bottom','left','right'].forEach((side,i)=>$(`orientation-${side}`).textContent=labels[i]);
  $('slice-controls').hidden=state.view!=='axial';
  $('slice-number').textContent=`${state.slice+1} / 7`;
  pressed('mri-views','data-view',state.view);
}

function renderViewer(){
  $('model-pane').hidden=state.mode!=='3d';
  $('mri-pane').hidden=state.mode!=='mri';
  pressed('viewer-mode','data-mode',state.mode);
  $('anatomy-title').textContent=state.mode==='3d'?'Brain anatomy':'Case MRI';
  $('viewer-note').textContent=state.mode==='3d'?'Shared anatomical reference · Not reconstructed from the selected case.':'Original case slices · Skull-stripped, bias-corrected, MNI152 aligned · Neurological view.';
  if(state.mode!=='3d') stopRotation();
  renderMRI();
}

function renderChart(){
  const c=current();
  const names=modelNames.filter(n=>typeof c.preds[n]==='number');
  $('prediction-count').textContent=`${names.length} models`;
  $('prediction-title').textContent=hiddenAge(c)?'Make your estimate':'Model predictions';
  $('prediction-description').textContent=hiddenAge(c)?'Use the case MRI to estimate age, then compare.':'Predicted age against the person’s true age.';
  if(hiddenAge(c)){
    $('prediction-chart').innerHTML=`<form id="guess-form" class="quiz-form"><label for="age-guess">How old is this person?</label><input id="age-guess" type="number" min="15" max="95" step="1" inputmode="numeric" placeholder="Age in years" required><div class="quiz-actions"><button class="button primary" type="submit">Reveal answers</button><button class="button" type="button" id="skip-guess">Reveal without guessing</button></div><p>The case age and model predictions stay hidden until you reveal them.</p></form>`;
    $('guess-form').addEventListener('submit',e=>{e.preventDefault();const guess=Number($('age-guess').value);if(!Number.isFinite(guess)||guess<15||guess>95)return;state.guesses.set(c.id,guess);state.revealed.add(c.id);renderCase();});
    $('skip-guess').addEventListener('click',()=>{state.revealed.add(c.id);renderCase();});
    return;
  }
  const values=[c.age,...Object.values(c.preds).flat()];
  let lo=Math.floor((Math.min(...values)-3)/5)*5,hi=Math.ceil((Math.max(...values)+3)/5)*5;
  if(hi-lo<20){lo=Math.floor(((hi+lo)/2-10)/5)*5;hi=lo+20;}
  const pct=v=>(v-lo)/(hi-lo)*100;
  const closest=names.reduce((best,name)=>Math.abs(c.preds[name]-c.age)<Math.abs(c.preds[best]-c.age)?name:best,names[0]);
  let html='';
  if(state.guesses.has(c.id)){const g=state.guesses.get(c.id);html+=`<p class="guess-result">Your estimate: ${f(g)} y · Error: ${signed(g-c.age)} y</p>`;}
  html+=`<div class="chart-key"><span><i class="truth-key"></i>True age <strong>${f(c.age)} years</strong></span><span><i class="prediction-key"></i>Model prediction</span></div><div class="chart-column-labels"><span>Model</span><span>Age in years</span><span>Prediction / error</span></div>`;
  for(const [label,members] of groups){
    const rows=members.filter(n=>typeof c.preds[n]==='number');
    if(!rows.length)continue;
    html+=`<div class="chart-group"><h3>${label}</h3>`;
    for(const name of rows){
      const value=c.preds[name],error=value-c.age;
      let internal='';
      if(name==='BrainAgeNeXt'){
        const outputs=c.preds['BrainAgeNeXt models'];
        internal=`<i class="internal-range" style="--left:${pct(Math.min(...outputs))}%;--width:${pct(Math.max(...outputs))-pct(Math.min(...outputs))}%"></i>`+outputs.map(v=>`<i class="internal-tick" style="--left:${pct(v)}%"></i>`).join('');
      }
      html+=`<div class="prediction-row${name===closest?' closest-row':''}" title="${escapeHTML(name)}: ${value} years; error ${error.toFixed(2)} years"><span class="model-name">${escapeHTML(name)}${name===closest?'<span class="closest-label">Closest to true age</span>':''}</span><div class="prediction-track" aria-hidden="true" style="--truth:${pct(c.age)}%;--value:${pct(value)}%"><i class="track-line"></i><i class="error-span" style="left:${pct(Math.min(c.age,value))}%;width:${Math.abs(pct(value)-pct(c.age))}%"></i>${internal}<i class="truth-mark"></i><i class="prediction-dot"></i></div><span class="prediction-value">${f(value)}<small>${signed(error)} y</small></span></div>`;
    }
    html+='</div>';
  }
  const step=hi-lo<=35?5:10;
  const ticks=[];for(let t=Math.ceil(lo/step)*step;t<=hi;t+=step)ticks.push(`<span style="left:${pct(t)}%">${t}</span>`);
  html+=`<div class="chart-axis" aria-label="Age scale from ${lo} to ${hi} years"><div></div><div>${ticks.join('')}</div><div></div></div><p class="chart-footnote">Age in years. Error = prediction − true age.</p><details class="model-internals"><summary>BrainAgeNeXt’s five internal predictions</summary><p>${c.preds['BrainAgeNeXt models'].map(v=>`${f(v,2)} y`).join(' · ')}. Grey ticks show these outputs.</p></details>`;
  if(c.cohort==='SALD')html+='<p class="chart-footnote">Tabular models are unavailable for SALD; tissue-volume features were only extracted for IXI.</p>';
  $('prediction-chart').innerHTML=html;
}

function renderCase(){
  const c=current();
  $('selected-id').textContent=c.id;
  $('selected-site').textContent=c.cohort===c.site?c.cohort:`${c.cohort} · ${c.site}`;
  $('selected-sex').textContent=sex(c);
  $('selected-age').innerHTML=hiddenAge(c)?'Hidden':`${f(c.age)}<small>years</small>`;
  $('case-selection').textContent=c.why;
  $('case-note').textContent=c.note;
  $('quiz-toggle').checked=state.quiz;
  renderList();renderViewer();renderChart();
  const list=visibleCases(),idx=list.findIndex(x=>x.id===c.id);
  $('previous-case').disabled=idx<=0;
  $('next-case').disabled=idx<0||idx>=list.length-1;
}

function route(){
  const hash=location.hash;
  state.route=hash==='#cohorts'?'cohorts':hash==='#data'?'data':'explorer';
  const requested=hash.match(/^#case-([\w-]+)$/)?.[1];
  if(requested&&data.cases.some(c=>c.id===requested))state.id=requested;
  for(const view of ['explorer','cohorts','data'])$(`${view}-view`).hidden=view!==state.route;
  document.querySelectorAll('[data-route]').forEach(a=>{if(a.dataset.route===state.route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('breadcrumb').textContent=`Research / ${{explorer:'Case explorer',cohorts:'Cohort results',data:'All case data'}[state.route]}`;
  if(state.route==='explorer')renderCase();else stopRotation();
  $('sidebar').classList.remove('menu-open');$('menu-toggle').setAttribute('aria-expanded','false');
  window.scrollTo({top:0,behavior:'instant'});
}

function selectCase(id){
  state.id=id;
  if(location.hash===`#case-${id}`)route();else location.hash=`case-${id}`;
}

function renderCohorts(){
  const ci=r=>`${f(r.MAE,2)}<small>${f(r.ci_low,2)}–${f(r.ci_high,2)}</small>`;
  const cohorts=['IXI Guys+HH','eNKI','SALD'];
  $('cohort-table').innerHTML='<table><thead><tr><th>Cohort</th><th class="num">Scans</th><th class="num">DeepBrainNet MAE / 95% CI</th><th class="num">BrainAgeNeXt MAE / 95% CI</th><th>Training overlap</th></tr></thead><tbody>'+cohorts.map(co=>{
    const d=data.summary.find(r=>r.cohort===co&&r.model==='DeepBrainNet'),b=data.summary.find(r=>r.cohort===co&&r.model==='BrainAgeNeXt');
    return `<tr><td>${co}</td><td class="num">${b.n}</td><td class="num">${ci(d)}</td><td class="num">${ci(b)}</td><td>${co==='SALD'?'None · held out':'BrainAgeNeXt training'}</td></tr>`;
  }).join('')+'</tbody></table>';
  const saldRows=['DeepBrainNet raw','BrainAgeNeXt raw',null,'DBN dense1024 + ridge (trained on IXI)','BANG 512 + ridge (trained on IXI)','DBN gap + BANG + ridge (trained on IXI)'];
  $('heads-table').innerHTML='<table><thead><tr><th>Model variant</th><th class="num">IXI MAE · 5-fold</th><th class="num">eNKI MAE</th><th class="num">SALD MAE</th></tr></thead><tbody>'+data.heads_ixi.map((r,i)=>{
    const s=data.heads_sald.find(x=>x.model===saldRows[i]);return `<tr><td>${escapeHTML(r.model)}</td><td class="num">${f(r.mae_guys_hh_5fold_oof,2)}</td><td class="num">${f(r.mae_enki,2)}</td><td class="num">${s?f(s.MAE,2):'—'}</td></tr>`;
  }).join('')+'</tbody></table>';
  const b=data.summary.find(r=>r.cohort==='SALD'&&r.model==='BrainAgeNeXt');
  $('sald-mae').textContent=`${f(b.MAE,2)} years`;$('cohort-lead').textContent=f(b.MAE,2);$('cohort-ci').textContent=`${f(b.ci_low,2)}–${f(b.ci_high,2)}`;
}

function renderData(){
  $('data-count').textContent=`${data.cases.length} cases · ${data.cases.reduce((n,c)=>n+modelNames.filter(m=>typeof c.preds[m]==='number').length,0)} predictions · ${data.cases.reduce((n,c)=>n+c.preds['BrainAgeNeXt models'].length,0)} internal model outputs`;
  $('all-data-table').innerHTML=`<table><thead><tr><th>Case</th><th>Cohort / site</th><th>Sex</th><th class="num">True age</th>${modelNames.map(n=>`<th class="num">${escapeHTML(n)}</th>`).join('')}</tr></thead><tbody>${data.cases.map(c=>`<tr><td><a href="#case-${c.id}">${c.id}</a><small>${escapeHTML(c.why)}</small></td><td>${c.cohort} / ${c.site}</td><td>${sex(c)}</td><td class="num">${f(c.age)}</td>${modelNames.map(n=>`<td class="num">${typeof c.preds[n]==='number'?f(c.preds[n],2):'—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function downloadCSV(){
  const rows=[['case_id','cohort','site','sex','ethnicity','true_age_years','selection','model','predicted_age_years','error_years']];
  for(const c of data.cases){for(const name of modelNames){if(typeof c.preds[name]!=='number')continue;rows.push([c.id,c.cohort,c.site,c.sex,c.ethnicity??'',c.age,c.why,name,c.preds[name],Number((c.preds[name]-c.age).toFixed(4))]);}c.preds['BrainAgeNeXt models'].forEach((value,i)=>rows.push([c.id,c.cohort,c.site,c.sex,c.ethnicity??'',c.age,c.why,`BrainAgeNeXt internal ${i+1}`,value,Number((value-c.age).toFixed(4))]));}
  const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='iaudit-all-predictions.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

const brain=$('brain-model');
const expandChart=document.createElement('button');
expandChart.type='button';expandChart.className='button chart-expand';expandChart.textContent='Expand chart';expandChart.setAttribute('aria-expanded','false');expandChart.setAttribute('aria-controls','prediction-chart');
$('prediction-title').parentElement.append(expandChart);
expandChart.addEventListener('click',()=>{const expanded=document.querySelector('.explorer-grid').classList.toggle('chart-expanded');expandChart.textContent=expanded?'Split view':'Expand chart';expandChart.setAttribute('aria-expanded',String(expanded));if(expanded)stopRotation();});
function stopRotation(){brain.removeAttribute('auto-rotate');$('rotate-model').setAttribute('aria-pressed','false');$('rotate-model').textContent='Auto rotate';}
brain.addEventListener('progress',e=>{$('model-progress').value=e.detail.totalProgress;$('model-status').textContent=`Loading 3D brain… ${Math.round(e.detail.totalProgress*100)}%`;brain.querySelector('.model-progress').hidden=e.detail.totalProgress>=1;});
brain.addEventListener('load',()=>{$('model-error').hidden=true;brain.querySelector('.model-progress').hidden=true;$('model-status').textContent='3D brain loaded';});
brain.addEventListener('error',()=>{$('model-error').hidden=false;brain.querySelector('.model-progress').hidden=true;});
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{if(e.matches)stopRotation();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRotation();});
$('camera-views').addEventListener('click',e=>{const b=e.target.closest('[data-orbit]');if(!b)return;brain.cameraOrbit=b.dataset.orbit;pressed('camera-views','data-orbit',b.dataset.orbit);if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)brain.jumpCameraToGoal?.();});
$('rotate-model').addEventListener('click',()=>{const active=brain.hasAttribute('auto-rotate');if(active)stopRotation();else{brain.setAttribute('auto-rotate','');$('rotate-model').setAttribute('aria-pressed','true');$('rotate-model').textContent='Pause rotation';}});
$('reset-model').addEventListener('click',()=>{stopRotation();brain.cameraOrbit='35deg 75deg 105%';brain.fieldOfView='30deg';brain.cameraTarget='auto auto auto';pressed('camera-views','data-orbit','35deg 75deg 105%');});
$('viewer-mode').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(b){state.mode=b.dataset.mode;renderViewer();}});
$('fallback-mri').addEventListener('click',()=>{state.mode='mri';renderViewer();});
$('mri-views').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b){state.view=b.dataset.view;renderMRI();}});
$('mri-slice').addEventListener('input',e=>{state.slice=Number(e.target.value);renderMRI();});
$('case-list').addEventListener('click',e=>{const b=e.target.closest('[data-case]');if(b)selectCase(b.dataset.case);});
$('cohort-filters').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;state.filter=b.dataset.filter;const list=visibleCases();if(list.length&&!list.some(c=>c.id===state.id))selectCase(list[0].id);else renderCase();});
$('case-search').addEventListener('input',e=>{state.query=e.target.value;renderList();const list=visibleCases(),idx=list.findIndex(c=>c.id===state.id);$('previous-case').disabled=idx<=0;$('next-case').disabled=idx<0||idx>=list.length-1;});
$('previous-case').addEventListener('click',()=>{const list=visibleCases(),i=list.findIndex(c=>c.id===state.id);if(i>0)selectCase(list[i-1].id);});
$('next-case').addEventListener('click',()=>{const list=visibleCases(),i=list.findIndex(c=>c.id===state.id);if(i>=0&&i<list.length-1)selectCase(list[i+1].id);});
$('quiz-toggle').addEventListener('change',e=>{state.quiz=e.target.checked;state.revealed.clear();state.guesses.clear();if(state.quiz)state.mode='mri';renderCase();});
$('menu-toggle').addEventListener('click',()=>{const open=$('sidebar').classList.toggle('menu-open');$('menu-toggle').setAttribute('aria-expanded',String(open));});
$('download-csv').addEventListener('click',downloadCSV);
$('download-data').addEventListener('click',()=>{location.hash='data';});
window.addEventListener('hashchange',()=>{if(data)route();});

async function init(){
  try{
    const response=await fetch('data/cases.json');if(!response.ok)throw new Error(`Data HTTP ${response.status}`);data=await response.json();
    if(!Array.isArray(data.cases)||!data.cases.length)throw new Error('Missing case data');
    renderCohorts();renderData();route();
  }catch(error){console.error('Could not initialise iAudit',error);$('explorer-view').hidden=true;$('load-error').hidden=false;$('case-list').innerHTML='<p class="muted">Case data unavailable.</p>';$('download-data').disabled=true;}
}
init();
