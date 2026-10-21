import type { StepPlayer } from '../../core/player';
import type { CvParams } from './scenario';
import { html } from '../degerlendirme/ui';
import { foldIndex } from './view';
let uid=0;
export function mountCvParams(host:HTMLElement,player:StepPlayer<CvParams>){
  const id=`cv-${++uid}`;
  const makeSelect=(key:string,options:readonly (readonly [string,string])[])=>html('select',{id:`${id}-${key}`,name:key},...options.map(([value,text])=>html('option',{value},text)));
  const k=makeSelect('k',[['3','3 kat'],['5','5 kat']]);
  const method=makeSelect('method',[['kfold','Düz K-Fold'],['stratified','StratifiedKFold']]);
  const fold=makeSelect('fold',[]);const c=makeSelect('c',[['0.1','0,1'],['1','1']]);
  const wrap=(key:string,title:string,control:HTMLElement)=>html('label',{for:control.id,'data-control':key},title,control);
  const kControl=wrap('k','Kat sayısı (K)',k),methodControl=wrap('method','Katlama yöntemi',method),foldControl=wrap('fold','Aktif doğrulama katı',fold),cControl=wrap('c','LogisticRegression · C',c);
  const reset=html('button',{type:'button'},'Bu adımı sıfırla');const hint=html('p',{});
  const root=html('div',{class:'cv-params'},kControl,methodControl,foldControl,cControl,hint,reset);host.append(root);
  const listeners:(()=>void)[]=[];
  const on=(el:HTMLElement,event:string,fn:()=>void)=>{el.addEventListener(event,fn);listeners.push(()=>el.removeEventListener(event,fn));};
  on(k,'change',()=>{const next=k.value==='3'?3:5;player.setParams({k:next,fold:Math.min(foldIndex(player.state.params),next-1)});});
  on(method,'change',()=>{if(method.value==='kfold'||method.value==='stratified')player.setParam('method',method.value);});
  on(fold,'change',()=>player.setParam('fold',Number(fold.value)));
  on(c,'change',()=>player.setParam('c',c.value==='0.1'?.1:1));
  on(reset,'click',()=>player.goto(player.state.index));
  const sync=():void=>{
    const {params:p,index}=player.state,locked=index===9;
    k.value=String(p.k);method.value=p.method;c.value=String(p.c);
    fold.replaceChildren(...Array.from({length:p.k},(_,i)=>html('option',{value:String(i)},`Kat ${i+1}`)));fold.value=String(foldIndex(p));
    kControl.hidden=index===0;methodControl.hidden=index<6;foldControl.hidden=index===1||index===4||index===5||index===9;cControl.hidden=index<2||index===4||index===7||index===9;
    for(const el of [k,method,fold,c])el.disabled=locked;
    reset.disabled=locked;
    hint.textContent=locked?'Son seçim sabittir: K=5 StratifiedKFold; C=0,1 ve C=1. Test seçim için kullanılmaz.':'Yalnız desteklenen gerçek çalıştırmalar: K=3/5. 10 pozitif ve 30 negatif her iki K için yeterlidir. Tarayıcıda yeni eğitim yok.';
  };
  sync();const unsubscribe=player.subscribe(sync);
  return {destroy(){unsubscribe();listeners.forEach(off=>off());root.remove();}};
}
