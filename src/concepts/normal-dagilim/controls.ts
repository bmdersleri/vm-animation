import type { StepPlayer } from '../../core/player';
import { formatNumber } from '../../core/plot/format';
import { SERIES, type Seri } from './data';
import { SERIES_STEPS, MU_SIGMA_STEPS, AB_STEPS, K_STEPS, X_STEPS, type NormalParams } from './scenario';

let uid = 0;
export function mountNormalParams(host: HTMLElement, player: StepPlayer<NormalParams>): void {
 const doc = host.ownerDocument;
 const prefix = `normal-params-${++uid}`;
 const wrap = doc.createElement('div'); wrap.className = 'knn-params normal-params';
 const rows: {key:keyof NormalParams; steps:readonly number[]; box:HTMLElement; control:HTMLInputElement|HTMLSelectElement; output?:HTMLOutputElement}[] = [];
 const add = (key:keyof NormalParams,label:string,steps:readonly number[],options?:readonly [string,string][]) => {
  const box=doc.createElement('div'); box.className=`ctl ${options?'select':'range'}`;
  const control=options?doc.createElement('select'):doc.createElement('input');
  control.id=`${prefix}-${key}`; control.dataset.param=key;
  const title=doc.createElement('label'); title.className='ctl-label'; title.htmlFor=control.id; title.textContent=label;
  box.append(title);
  let output:HTMLOutputElement|undefined;
  if(control instanceof HTMLSelectElement){for(const [value,text] of options!){const option=doc.createElement('option'); option.value=value;option.textContent=text;control.append(option);}}
  else {control.type='range'; output=doc.createElement('output'); output.htmlFor=control.id; output.className='normal-value'; box.append(output);}
  box.append(control); wrap.append(box); rows.push({key,steps,box,control,output});
  control.addEventListener(options?'change':'input',()=>{
   if(key==='seri'){
    const seri=control.value as Seri, source=SERIES[seri];
    const clamp=(x:number)=>Math.max(source.domain[0],Math.min(source.domain[1],x));
    const p=player.state.params;
    player.setParams({seri,mu:source.mean,sigma:source.std,a:clamp(p.a),b:clamp(p.b),x:clamp(p.x)});
   }else if(key==='k')player.setParam('k',Number(control.value) as 1|2|3);
   else player.setParam(key,Number(control.value));
  });
 };
 add('seri','Seri',SERIES_STEPS,[['sinav','Sınav notu'],['cagri','Çağrı süresi']]);
 add('mu','Ortalama μ',MU_SIGMA_STEPS); add('sigma','Standart sapma σ',MU_SIGMA_STEPS);
 add('a','Alt sınır a',AB_STEPS); add('b','Üst sınır b',AB_STEPS);
 add('k','Bant k',K_STEPS,[['1','1'],['2','2'],['3','3']]); add('x','Değer x',X_STEPS);
 host.append(wrap);
 let previousSeri=player.state.params.seri;
 const sync=()=>{
  const {index,params:p}=player.state;
  // Scenario transitions and keyboard shortcuts can also change the series.
  if(p.seri!==previousSeri){
   previousSeri=p.seri;
   const source=SERIES[p.seri];
   const clamp=(x:number)=>Math.max(source.domain[0],Math.min(source.domain[1],x));
   player.setParams({mu:source.mean,sigma:source.std,a:clamp(p.a),b:clamp(p.b),x:clamp(p.x)});
   return;
  }
  for(const r of rows){
   if(r.control instanceof HTMLInputElement){
    const domain=SERIES[p.seri].domain;
    const [min,max,step]=r.key==='mu'?[30,110,1]:r.key==='sigma'?[3,20,0.5]:[...domain,p.seri==='cagri'?0.5:1];
    r.control.min=String(min);r.control.max=String(max);r.control.step=String(step);
   }
   r.control.value=String(p[r.key]);
   if(r.output)r.output.textContent=formatNumber(Number(p[r.key]),1);
   const off=!r.steps.includes(index); r.control.disabled=off;r.box.toggleAttribute('data-off',off);
  }
  host.toggleAttribute('data-off',rows.every(r=>!r.steps.includes(index)));
 };
 sync();player.subscribe(sync);
}
