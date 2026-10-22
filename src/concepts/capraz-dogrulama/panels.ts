import { html, svg } from '../degerlendirme/ui';
import type { CvRun } from '../degerlendirme/data';
import { metrics } from '../degerlendirme/metrics';
import { cvData, cText, development, numberText, testSamples, vectorText, positiveCount } from './view';

const value=(label:string,n:number,attribute:string)=>html('p',{},label,html('strong',{[attribute]:'','data-value':String(n),...(attribute==='data-fold-f1'?{'data-revealed':'true'}:{})},numberText(n)));
/** Step 4 sweep: the running turn's score stays masked until the turn completes. */
const maskedScore=(step:number,done:boolean)=>step===3&&!done;
export function foldCard(run:CvRun,index:number,step:number,done=true):HTMLElement{
  const masked=maskedScore(step,done);
  const fold=run.folds[index],m=metrics(fold.confusion);
  const fit=html('div',{class:'cv-fit'},...(['mean','scale'] as const).map(key=>html('p',{},key==='mean'?'Ortalama μ ':'Ölçek σ ',html('strong',{'data-fit':key,'data-values':JSON.stringify(fold[key])},vectorText(fold[key])))));
  fit.hidden=step<2||step===4||step===5||step===6||step===7;
  const zero=html('div',{class:'cv-zero'},html('p',{'data-recall':''},`Recall: ${numberText(m.recall)}${m.recall===null?' · gerçek pozitif yok':''}`),html('p',{'data-ui-f1':''},`F1: ${numberText(m.f1)}`),html('p',{'data-f1-definition':''},'F1 paydası 2TP + FP + FN = 0 ise tanımsızdır; FP > 0 ise F1 = 0 olabilir.'));
  zero.hidden=step!==6;
  return html('aside',{class:'cv-fold-card','data-active-fold':String(index)},html('h2',{},`Tur ${index+1} · yeni fit`),
    html('p',{},html('strong',{'data-train-count':''},String(fold.trainIds.length)),' eğitim · ',html('strong',{'data-train-positive':''},String(positiveCount(fold.trainIds))),' pozitif'),
    html('p',{},`${fold.validationIds.length} doğrulama · `,html('strong',{'data-validation-positive':''},String(positiveCount(fold.validationIds))),' pozitif'),
    fit,masked?html('p',{},'Doğrulama F1 ',html('strong',{'data-fold-f1':'','data-revealed':'false'},'bekliyor')):value('Doğrulama F1 ',fold.f1,'data-fold-f1'),
    html('p',{class:'cv-confusion'},masked?'Tur bitince: TP · FP · FN · TN':`TP ${fold.confusion.tp} · FP ${fold.confusion.fp} · FN ${fold.confusion.fn} · TN ${fold.confusion.tn}`),zero,
    html('p',{class:'cv-fit-source'},'Fit kaynağı: yalnız bu turun eğitim kimlikleri. Doğrulamada yalnız transform + predict.'));
}

export function scorePanel(run:CvRun,active:number,step:number,done=true):HTMLElement{
  const H=step===3?95:160;
  const plot=svg('svg',{class:'cv-score-plot',viewBox:`0 0 460 ${H+90}`,role:'img','aria-label':`Kat F1 skorları: ${run.folds.map((f,i)=>`K${i+1} ${numberText(f.f1)}`).join(', ')}. Ortalama ${numberText(run.meanF1)}, popülasyon standart sapması ${numberText(run.stdF1)}.`});
  const y=(n:number)=>H+45-H*n;
  for(const n of [0,.5,1]){plot.append(svg('line',{x1:'40',x2:'445',y1:String(y(n)),y2:String(y(n)),class:'cv-gridline'}),svg('text',{x:'32',y:String(y(n)+5),'text-anchor':'end',class:'cv-tick'},String(n).replace('.',',')));}
  if(step===5){plot.append(svg('rect',{x:'40',y:String(y(Math.min(1,run.meanF1+run.stdF1))),width:'405',height:String(H*(Math.min(1,run.meanF1+run.stdF1)-Math.max(0,run.meanF1-run.stdF1))),class:'cv-std-band'}),svg('line',{x1:'40',x2:'445',y1:String(y(run.meanF1)),y2:String(y(run.meanF1)),class:'cv-mean-line'}));}
  run.folds.forEach((fold,i)=>{
    const revealed=step!==3||i<active||(i===active&&done);const x=60+i*(365/run.k);
    const g=svg('g',{'data-score':String(i),'data-revealed':String(revealed),'data-value':String(fold.f1)});
    g.append(svg('rect',{x:String(x),y:String(y(revealed?fold.f1:0)),width:String(Math.min(48,250/run.k)),height:String(Math.max(2,H*(revealed?fold.f1:0))),class:i===active?'cv-bar cv-bar-active':'cv-bar'}),svg('text',{x:String(x+24),y:String(H+80),'text-anchor':'middle',class:'cv-tick'},`K${i+1}`),svg('text',{x:String(x+24),y:String(y(revealed?fold.f1:0)-10),'text-anchor':'middle',class:'cv-tick'},revealed?numberText(fold.f1):'bekliyor'));
    plot.append(g);
  });
  return html('section',{class:'cv-scores'},html('h2',{},'Kat skorları · pozitif sınıf F1'),plot,
    html('div',{class:'cv-summary'},value('Ortalama ',run.meanF1,'data-mean'),value('Std (ddof=0) ',run.stdF1,'data-std')),
    html('p',{class:'cv-score-note'},step===5?'Bant = ortalama ± std; güven aralığı değildir.':'Her tur yeni model; tur bitince doğrulama F1 açılır.'));
}

export function classPanel(run:CvRun):HTMLElement{
  const heading=run.method==='kfold'?'Düz K-Fold':'StratifiedKFold';
  const rows=run.folds.map((fold,i)=>{
    const n=positiveCount(fold.validationIds);
    return html('div',{class:'cv-positive-row','data-positive-fold':String(i),'data-count':String(n),...(n===0?{'data-recall-undefined':''}:{})},html('span',{},`K${i+1}`),html('div',{class:'cv-positive-track'},html('div',{class:'cv-positive-fill',style:`width:${100*n/fold.validationIds.length}%`}),...(n===0?[html('span',{class:'cv-undefined-flag'},'pozitif yok · recall tanımsız')]:[])),html('span',{},`${n} / ${fold.validationIds.length}`));
  });
  return html('section',{class:'cv-classes'},html('h2',{},`${heading} · doğrulama pozitifleri`),html('div',{class:'cv-positive-rows'},...rows),html('p',{},'◆ Ayrılan müşteri / tüm doğrulama müşterileri'),);
}

export function pipelinePanel(run:CvRun,index:number):HTMLElement{
  const fold=run.folds[index];
  const correct=html('section',{'data-pipeline':'correct',class:'cv-pipeline cv-correct'},html('h2',{},'Doğru · katın içinde'),html('div',{class:'cv-flow'},html('p',{},`Eğitimde fit · ${fold.trainIds.length} müşteri`),html('p',{},'StandardScaler → LogisticRegression'),html('p',{},`Doğrulamada transform → predict · ${fold.validationIds.length} müşteri`)),html('p',{},`μ ${vectorText(fold.mean)}`),html('p',{},`σ ${vectorText(fold.scale)}`));
  const wrong=html('section',{'data-pipeline':'wrong',class:'cv-pipeline cv-wrong'},html('h2',{},'Yanlış · katlardan önce'),html('div',{class:'cv-flow'},html('p',{},`Tüm geliştirmede fit · ${development.length} müşteri`),html('p',{},'Sonra katlara ayır → eğitim / doğrulama')),html('p',{},'Doğrulama bilgisi ortalama ve ölçeğe sızar.'),html('p',{'data-global-fit':'mean','data-values':JSON.stringify(cvData.selection.fitMean)},`μ ${vectorText(cvData.selection.fitMean)}`),html('p',{'data-global-fit':'scale','data-values':JSON.stringify(cvData.selection.fitScale)},`σ ${vectorText(cvData.selection.fitScale)}`));
  return html('div',{class:'cv-pipelines'},correct,wrong,html('p',{class:'cv-leak-note'},'Sızıntı skoru her zaman artırmaz; ölçümün bağımsızlığını bozar. Dış test iki akışa da girmez.'));
}

export function finalPanel():HTMLElement{
  const selected=cvData.selection;
  const candidates=cvData.runs.filter(r=>r.k===5&&r.method==='stratified');
  const protocol=html('section',{class:'cv-selection'},html('h2',{'data-final-protocol':''},'Sabit protokol: K=5 · StratifiedKFold'),html('p',{},'Aynı Pipeline; yalnız C değişir. Ortalama F1 büyük olan seçilir; eşitlikte küçük C.'),
    html('div',{class:'cv-candidates'},...candidates.map(run=>html('div',{'data-candidate':String(run.c),'data-mean':String(run.meanF1),'data-chosen':String(run.c===selected.c)},html('strong',{},`C=${String(run.c).replace('.',',')}`),html('span',{},`Ort. F1 ${numberText(run.meanF1)}`)))),
    html('p',{'data-selected-c':String(selected.c)},`Seçim donduruldu: C=${cText(selected.c)}`),html('div',{class:'cv-refit'},html('h2',{},`${development.length} geliştirme müşterisiyle yeniden fit`),html('p',{},`μ ${vectorText(selected.fitMean)}`),html('p',{},`σ ${vectorText(selected.fitScale)}`),html('p',{},'Sonraki tek adım: bağımsız dış testi raporla.')));
  const c=selected.finalTest.confusion;
  const report=html('section',{class:'cv-test-report','data-test-report':''},html('h2',{},`Dış test açıldı · ${testSamples.length} müşteri`),value('Son test F1 ',selected.finalTest.f1,'data-test-f1'),html('p',{},`TP ${c.tp} · FP ${c.fp} · FN ${c.fn} · TN ${c.tn}`),html('div',{class:'cv-test-outcomes'},...selected.finalTest.predictions.map(p=>html('span',{'data-test-outcome':p.id,title:p.id},`T${p.id.slice(-2)}: ${p.actual}→${p.predicted}`))),html('p',{},'Kimlik: gerçek → tahmin. Test seçim döngüsüne geri dönmez.'));
  return html('div',{class:'cv-final'},protocol,report,html('p',{class:'cv-final-note'},'Zaman ve grup bağımlı veride rastgele K-Fold uygun olmayabilir; zamana veya gruba göre ayırın.'));
}
