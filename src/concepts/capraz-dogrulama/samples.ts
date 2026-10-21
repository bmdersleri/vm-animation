import { html } from '../degerlendirme/ui';
import type { CvRun } from '../degerlendirme/data';
import { development } from './view';

/** Nodes stay in identity order across all turns and methods. */
export function sampleBoard(){
  const chips=development.map(sample=>html('div',{'class':'cv-sample','data-sample':sample.id,'data-actual':String(sample.actual),title:sample.id},html('span',{class:`cv-shape cv-class-${sample.actual}`,'aria-hidden':'true'}),html('span',{class:'cv-id'},sample.id.slice(-2)),html('span',{class:'cv-membership'})));
  const grid=html('div',{class:'cv-grid','aria-label':'Geliştirme müşterileri; kimlik sırası sabit'},...chips);
  const folds=html('div',{class:'cv-folds','aria-label':'Doğrulama katları'});
  const board=html('section',{class:'cv-board'},html('h2',{},'Geliştirme · 40 müşteri'),grid,folds);
  return {board,update(run:CvRun,active:number,step:number){
    chips.forEach((chip,i)=>{
      const s=development[i];const member=run.folds.findIndex(f=>f.validationIds.includes(s.id));
      const validation=run.folds[active].validationIds.includes(s.id);const prediction=run.folds[active].predictions.find(p=>p.id===s.id);
      chip.dataset.role=step===1?'partition':validation?'validation':'train';chip.dataset.fold=String(member);chip.dataset.validationCount=String(run.folds.filter(f=>f.validationIds.includes(s.id)).length);
      chip.dataset.predicted=prediction?String(prediction.predicted):'';
      chip.querySelector('.cv-membership')!.textContent=step===1||step===4?`K${member+1}`:'';
      chip.setAttribute('aria-label',`${s.id}; gerçek ${s.actual===1?'ayrıldı':'kaldı'}; doğrulama katı ${member+1}; ${validation?'doğrulama':'eğitim'}`);
    });
    folds.replaceChildren(...run.folds.map((fold,i)=>html('div',{'data-fold-block':String(i),'data-active':String(i===active),class:'cv-fold-block'},`K${i+1} · ${fold.validationIds.length}`,html('span',{},i===active?'Doğrulama':'Eğitim'))));
    folds.hidden=step===0;
  }};
}
