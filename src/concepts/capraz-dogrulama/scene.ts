import type { StepPlayer } from '../../core/player';
import type { Mode } from '../../core/mode';
import type { SceneHandle } from '../../core/shell';
import { cvScenario, type CvParams } from './scenario';
import { html } from '../degerlendirme/ui';
import { cvData, development, foldIndex, negativeTotal, positiveTotal, runFor, testSamples } from './view';
import { sampleBoard } from './samples';
import { classPanel, finalPanel, foldCard, pipelinePanel, scorePanel } from './panels';

export function mountCvScene(host:HTMLElement,player:StepPlayer<CvParams>,mode:Mode):SceneHandle{
  const heading=html('p',{class:'cv-run-heading'});
  const reserved=html('p',{class:'cv-reserved'});
  // The positive class stays named on every step; only the role key is dropped once the board is gone.
  const positiveKey=html('span',{class:'cv-positive-key','data-positive-key':''},html('strong',{},'◆ Pozitif: Ayrılan müşteri (churn=1)'),' · ● Kalan (0) · iç şekil: gerçek sınıf');
  const roles=[html('span',{class:'cv-role-train'},'Düz çerçeve: eğitim'),html('span',{class:'cv-role-validation'},'Kesikli lacivert çerçeve: doğrulama')];
  const legend=html('div',{class:'cv-legend'},positiveKey,...roles);
  const {board,update}=sampleBoard();const content=html('div',{class:'cv-main'},board);const aside=html('div',{class:'cv-aside'});content.append(aside);
  const special=html('div',{class:'cv-special'});
  const note=html('p',{class:'cv-note'});
  const convention=html('p',{class:'cv-convention','data-score-convention':''},'Skorlar ve ortalamalar: sklearn F1, zero_division=0. Önceden hesaplanmış gerçek Pipeline çalıştırmaları; tarayıcıda eğitim yapılmaz.');
  const root=html('div',{class:'cv-scene','data-mode':mode},html('div',{class:'cv-scene-heading'},heading,reserved),legend,content,special,note,convention);
  host.append(root);
  const notes=[
    `Bu tek turun F1 değeri diğer bölünmelerin sonucunu garanti etmez. Kimlikler: ${development[0].id}…${development[development.length-1].id.slice(-2)}; hücrede son iki rakam.`,
    'K etiketleri, müşterinin doğrulamada yer alacağı katı gösterir. Test, geliştirmeden ayrı tutulur.',
    'Kesikli hücreler doğrulamada; diğer hücreler eğitimde. İç şekil sınıfı, dış çerçeve rolü gösterir.',
    'Tur değişince doğrulama kimlikleri, yeni fit parametreleri ve skor birlikte değişir. Önceki model taşınmaz.',
    'Her kimliğin tek K etiketi var: doğrulama üyeliği tam 1; eğitim üyeliği K−1. Kapsama tüm geliştirmede tamamlanır.',
    'Aynı çalıştırmanın kat F1 skorları, ortalaması ve popülasyon std değeri. Yayılma güven aralığı değildir.',
    'Pozitif sınıfsız katlarda recall tanımsızdır. F1 yalnız 2TP+FP+FN=0 olduğunda tanımsızdır.',
    `Aynı ${development.length} kimlik; pozitifler katlara dengeli dağılır. Geliştirmede ${positiveTotal} pozitif, ${negativeTotal} negatif var; her sınıfta en az K örnek gerekir.`,
    'Doğrulama yalnız eğitimde öğrenilen dönüşümü kullanır. Sızıntı skoru her zaman artırmaz.',
    'Keşif kontrollerinden bağımsız sabit protokol. Test yalnız seçilmiş yapılandırmanın son raporudur.',
  ];
  // Step 4: the running sweep turn completes after one interval; manual changes and reduced motion open it at once.
  const reduce=():boolean=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  let turnDone=true;let turnTimer:ReturnType<typeof setTimeout>|null=null;
  const clearTurn=():void=>{if(turnTimer!==null)clearTimeout(turnTimer);turnTimer=null;};
  let lastFold=player.state.params.fold;
  const onChange=(s:{index:number;params:CvParams},cause?:string):void=>{
    clearTurn();
    // A fold change is a manual pick (it also cancels the sweep); any other param change keeps the running sweep.
    const sameFold=s.params.fold===lastFold;lastFold=s.params.fold;
    // Every sweep emission starts a turn; the sweep ends on its last turn without a closing emission.
    // A parameter change while a turn is running restarts that turn; with no turn running it opens the score at once.
    if(s.index===3&&(cause==='step'||cause==='sweep'||(cause==='param'&&!turnDone&&sameFold))&&!reduce()){
      turnDone=false;
      turnTimer=setTimeout(()=>{turnTimer=null;turnDone=true;render();},cvScenario.steps[3].sweep!.intervalMs);
    }else turnDone=true;
    render();
  };
  const render=():void=>{
    const {params,index}=player.state;const final=index===9;
    const p=final?{k:5 as const,method:'stratified' as const,fold:0,c:cvData.selection.c}:params;
    const run=runFor(p),active=foldIndex(p);
    root.dataset.step=String(index);root.dataset.run=`${run.k}-${run.method}-${run.c}`;
    heading.textContent=`K=${run.k} · ${run.method==='stratified'?'StratifiedKFold':'K-Fold'} · C=${String(run.c).replace('.',',')}${final?' · seçim donduruldu':` · aktif tur ${active+1}`}`;
    reserved.replaceChildren();
    if(final){reserved.textContent='Dış test: son rapor açıldı';reserved.removeAttribute('data-test-locked');}
    else{reserved.setAttribute('data-test-locked','');reserved.textContent=`🔒 Dış test · ${testSamples.length} müşteri · seçim bitene kadar kilitli`;}
    update(run,active,index);note.textContent=notes[index];
    for(const role of roles)role.hidden=index>=8;content.hidden=index>=8;special.hidden=index<8;
    board.hidden=index===5;aside.replaceChildren();
    if(index===5){aside.append(scorePanel(run,active,index),foldCard(run,active,index));}
    else if(index===6||index===7){aside.append(classPanel(run),foldCard(run,active,index));}
    else{aside.append(foldCard(run,active,index,turnDone));if(index===3)aside.append(scorePanel(run,active,index,turnDone));}
    if(index===1)aside.replaceChildren(html('div',{class:'cv-partition-note'},html('h2',{},`${run.k} ayrı doğrulama bloğu`),html('p',{},'Her K etiketi bir katı gösterir. Kimlik sırası değişmez; görev sırayla değişir.'),html('p',{},'Her turda 1 kat doğrulama; kalan K−1 kat eğitim.')));
    special.replaceChildren(...(index===8?[pipelinePanel(run,active)]:final?[finalPanel()]:[]));
  };
  render();const unsubscribe=player.subscribe(onChange);
  return {resize(){},setMode(next){root.dataset.mode=next;},destroy(){clearTurn();unsubscribe();root.remove();}};
}
