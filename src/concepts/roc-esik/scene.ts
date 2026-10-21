import type { StepPlayer } from '../../core/player';
import type { Mode } from '../../core/mode';
import type { SceneHandle } from '../../core/shell';
import { evaluationData } from '../degerlendirme/data';
import { averagePrecision, bestThreshold, classify, curvePoints, rocAuc, type Threshold } from '../degerlendirme/curves';
import { cost, metrics } from '../degerlendirme/metrics';
import type { RocParams } from './scenario';
import { selectFinalThreshold } from './selection';
import { drawCurve } from './plots';
import { html, number, percent, svg, thresholdText } from './ui';
import { UNDEFINED_TEXT } from '../degerlendirme/ui';

export function mountRocScene(host: HTMLElement, player: StepPlayer<RocParams>, initialMode: Mode): SceneHandle {
  let mode=initialMode, destroyed=false;
  const legend=html('p',{class:'roc-legend'},'İç şekil: gerçek sınıf · Çerçeve: tahmin');
  // The positive class stays named on every step, also where the shape legend is hidden.
  const positiveKey=html('span',{class:'roc-positive-key','data-positive-key':''},html('strong',{},'◆ Pozitif: Ayrılan müşteri (churn=1)'),' · ● Kalan (0)');
  const heading=html('p',{class:'roc-heading'}), thresholdLabel=html('strong',{'data-threshold':''});
  const locked=html('span',{'data-test-locked':'',class:'roc-locked'},'🔒 Test kilitli · son adımda açılır');
  const strip=svg('svg',{class:'roc-strip',role:'img','aria-label':'Doğrulama skorları ve karar eşiği'});
  const background=svg('g'), marks=svg('g'), thresholdLine=svg('line',{class:'roc-threshold'});
  strip.append(background,thresholdLine,marks);
  const markNodes=new Map<string,SVGGElement>();
  const counts=(['tn','fp','fn','tp'] as const).map(key=>html('div',{},html('span',{},key.toUpperCase()),html('strong',{'data-count':key})));
  const matrix=html('div',{class:'roc-matrix','aria-label':'Canlı karışıklık matrisi'},...counts);
  const metric=html('p',{class:'roc-metrics'}), precision=html('span',{'data-precision':''});
  metric.append(precision);
  const rocPlot=svg('svg',{class:'roc-plot',role:'img','aria-label':'ROC eğrisi: FPR ve TPR'});
  const prPlot=svg('svg',{class:'roc-plot',role:'img','aria-label':'PR eğrisi: recall ve precision'});
  const auc=html('strong',{'data-auc':''}), ap=html('strong',{'data-ap':''}), prevalence=html('span',{'data-prevalence':''});
  const rocPanel=html('section',{class:'roc-panel','data-panel':'roc'},html('div',{class:'roc-plot-heading'},html('b',{},'ROC'),auc),rocPlot);
  const prPanel=html('section',{class:'roc-panel','data-panel':'pr'},html('div',{class:'roc-plot-heading'},html('b',{},'PR'),ap),prPlot,prevalence);
  const curves=html('div',{class:'roc-curves'},rocPanel,prPanel);
  const convention=html('p',{class:'roc-convention','data-convention':''},'Boş pozitif tahminde çizim için precision=1; metrik precision tanımsızdır. AP basamak alanıdır; trapez PR-AUC değildir.');
  const costSummary=html('p',{class:'roc-cost-summary'}), costTable=html('div',{class:'roc-cost-table'});
  const costs=html('div',{class:'roc-costs'},costSummary,costTable);
  const flow=html('div',{class:'roc-flow'},html('b',{},'Eğitim'),html('span',{},'→ Doğrulama: eşik seç'),html('span',{},'→ Eşiği dondur'),html('b',{},'→ Bağımsız test'));
  const finalReport=html('p',{'data-test-report':'',class:'roc-final-report'});
  const final=html('div',{class:'roc-final'},flow,finalReport);
  const note=html('p',{class:'roc-note',role:'status'});
  const annotations=html('div',{class:'roc-annotations'},convention,note);
  const root=html('div',{class:'roc-scene'},legend,html('div',{class:'roc-live-heading'},positiveKey,heading,thresholdLabel),strip,matrix,metric,curves,costs,final,annotations);
  host.append(root);
  const render=():void=>{
    if(destroyed)return;
    const {index,params:p}=player.state, data=evaluationData.scoreSets[p.dataset], samples=data.validation;
    const optimum=bestThreshold(samples,p.fpCost,p.fnCost);
    const threshold:Threshold=index===9?selectFinalThreshold(data,p.fpCost,p.fnCost):p.nonePositive?'none':p.threshold;
    const c=classify(samples,threshold), m=metrics(c);
    root.dataset.step=String(index); root.dataset.mode=mode;
    root.dataset.teaching=String(index>=4&&index<=7);
    root.dataset.dataset=p.dataset;
    heading.replaceChildren(document.createTextNode(`Doğrulama · ${samples.length} müşteri · ${p.dataset==='balanced'?'dengeli':'dengesiz'}`),locked);
    locked.hidden=index===9;
    thresholdLabel.textContent=`Eşik: ${thresholdText(threshold)}`;
    thresholdLabel.hidden=index===0;
    matrix.hidden=index===0; metric.hidden=index<3||index===8;
    counts.forEach((el,i)=>el.querySelector('strong')!.textContent=String(c[(['tn','fp','fn','tp'] as const)[i]]));
    precision.textContent=`Precision ${percent(m.precision)} · Recall ${percent(m.recall)} · F1 ${percent(m.f1)}`;
    curves.hidden=index<4||index===9; rocPanel.hidden=index===6; prPanel.hidden=index<6||index===8;
    convention.hidden=index<6||index>=8; costs.hidden=index!==8; final.hidden=index!==9;
    const aucValue=rocAuc(samples), apValue=averagePrecision(samples);
    auc.textContent=`AUC ${aucValue===null?UNDEFINED_TEXT:number(aucValue)}`;
    ap.textContent=`AP ${apValue===null?UNDEFINED_TEXT:number(apValue)}`;
    prevalence.textContent=`PR referansı: pozitif oranı ${percent(samples.filter(s=>s.actual).length/samples.length)}`;
    costSummary.textContent=`Öneri ${thresholdText(optimum)} → maliyet ${number(cost(classify(samples,optimum),p.fpCost,p.fnCost))}. Varsayılan 0,50 → ${number(cost(classify(samples,.5),p.fpCost,p.fnCost))}. Daha yüksek eşik eşitlikte kazanır.`;
    costTable.replaceChildren(...curvePoints(samples).map(point=>html('span',{'data-candidate':String(point.threshold),'data-best':String(point.threshold===optimum)},`${thresholdText(point.threshold)}: ${number(cost(point.confusion,p.fpCost,p.fnCost))}`)));
    finalReport.textContent='';
    if(index===9){
      const test=classify(data.test,threshold), tm=metrics(test);
      finalReport.textContent=`Bağımsız test · ${data.test.length} müşteri · dondurulan eşik ${thresholdText(threshold)} · FP birim maliyeti ${number(p.fpCost)}, FN birim maliyeti ${number(p.fnCost)} · TN ${test.tn}, FP ${test.fp}, FN ${test.fn}, TP ${test.tp} · F1 ${percent(tm.f1)}. Test kimlikleri: ${data.test.map(s=>s.id.replace(`${p.dataset}-`, '')).join(', ')}.`;
    }
    note.textContent=index===0?'Skor, kalibre olasılık garantisi değildir. Kimlik ve skor işaretlerin yanında; tam kimlik üzerine gelince görünür.':index===1?'Karar: skor ≥ eşik → ayrılır (1); diğerleri kalır (0).':index===2?'Recall artabilir, FP artabilir. Precision her veri üzerinde monoton değildir.':index===3?'Precision, recall ve F1 aynı canlı matristen hesaplanır.':index===4?'FPR yatay, TPR dikey. Kesikli diyagonal: rastgele sıralama. Bağlı skorlar blok halinde.':index===5?'Trapez alanı sabittir: eşiği oynatmak sıralamayı ve AUC değerini değiştirmez.':index===6?'AP: Σ Δrecall × precision. Turuncu nokta seçili eşiği gösterir.':index===7?'PR referansı pozitif oranıdır; ROC referansı diyagonaldir. Örnek değişince AUC de değişebilir.':index===8?'Daha yüksek eşik: eşit maliyette daha az müşteriye teklif verme iş tercihi. Adaylar yalnız doğrulama skorlarından.':'Eğitim verisinde öğren → doğrulamada seç → testi bir defa raporla. Test seçim döngüsüne geri dönmez.';
    const w=strip.clientWidth||680, h=strip.clientHeight||150, left=28,right=w-28;
    strip.setAttribute('viewBox',`0 0 ${w} ${h}`);
    const thresholdX=threshold==='none'?right+8:left+threshold*(right-left);
    background.replaceChildren(svg('rect',{x:String(left),y:'12',width:String(Math.max(0,thresholdX-left)),height:String(h-38),class:'roc-negative-region'}),svg('rect',{x:String(thresholdX),y:'12',width:String(Math.max(0,right-thresholdX)),height:String(h-38),class:'roc-positive-region'}));
    if(index===0)background.replaceChildren(svg('rect',{x:String(left),y:'12',width:String(right-left),height:String(h-38),class:'roc-score-region'}));
    background.append(svg('text',{x:String(left),y:String(h-5),class:'roc-axis'},'0'),svg('text',{x:String(right),y:String(h-5),'text-anchor':'end',class:'roc-axis'},'1 · skor'));
    if(index>0){background.append(svg('text',{x:String(left+6),y:'28',class:'roc-tick'},'Kalır (0)'),svg('text',{x:String(right-6),y:'28','text-anchor':'end',class:'roc-tick'},'Ayrılır (1)'));}
    thresholdLine.setAttribute('x1',String(thresholdX));thresholdLine.setAttribute('x2',String(thresholdX));thresholdLine.setAttribute('y1','12');thresholdLine.setAttribute('y2',String(h-25));thresholdLine.style.visibility=index===0?'hidden':'visible';
    const keep=new Set(samples.map(s=>s.id)); for(const [id,node]of markNodes)if(!keep.has(id)){node.remove();markNodes.delete(id);}
    samples.forEach((s,i)=>{
      let node=markNodes.get(s.id);if(!node){node=svg('g',{'data-sample':s.id,class:'roc-sample'});node.append(svg('circle',{r:'10',class:'roc-ring'}),svg('path',{d:s.actual?'M0,-6 L6,0 L0,6 L-6,0 Z':'M-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0',class:'roc-actual'}),svg('text',{'text-anchor':'middle',class:'roc-id'}),svg('title',{},`${s.id} · gerçek ${s.actual} · skor ${thresholdText(s.score)}`));marks.append(node);markNodes.set(s.id,node);}
      node.dataset.actual=String(s.actual); node.dataset.predicted=String(threshold!=='none'&&s.score>=threshold?1:0);
      const markY=index>=4&&index<=7?(s.actual?38:65):43+(i%3)*Math.min(25,(h-70)/3);
      node.setAttribute('transform',`translate(${left+s.score*(right-left)},${markY})`);
      const text=node.querySelector('text')!;text.setAttribute('y','5');text.setAttribute('x',s.score>.85?'-14':'14');text.setAttribute('text-anchor',s.score>.85?'end':'start');text.textContent=`${i+1} · ${thresholdText(s.score)}`;
      if(p.dataset==='imbalanced'&&index>=4&&index<=7){
        // Bottom-row labels near the right end would sit on the "1 · skor" axis label: put them beside the mark.
        const beside=!s.actual&&s.score>.85;
        text.setAttribute('x',beside?'-14':'0');text.setAttribute('y',s.actual?'-14':beside?'5':'22');text.setAttribute('text-anchor',beside?'end':'middle');text.textContent=String(i+1);
      }
    });
    drawCurve(rocPlot,samples,threshold,'roc',index>=5);drawCurve(prPlot,samples,threshold,'pr',index>=6);
  };
  let previous=player.state;
  render();const unsubscribe=player.subscribe((state,cause)=>{
    const prior=previous;previous=state;
    // Only this teaching transition carries the chosen validation policy forward.
    if(cause==='step'&&prior.index===8&&state.index===9){
      player.setParams({dataset:prior.params.dataset,fpCost:prior.params.fpCost,fnCost:prior.params.fnCost});
      return;
    }
    render();
  });
  return {resize(){render();},setMode(value){mode=value;render();},destroy(){if(destroyed)return;destroyed=true;unsubscribe();root.remove();markNodes.clear();}};
}
