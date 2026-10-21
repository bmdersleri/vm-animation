import { curvePoints, type ScoredSample, type Threshold } from '../degerlendirme/curves';
import { classify } from '../degerlendirme/curves';
import { metrics } from '../degerlendirme/metrics';
import { svg } from './ui';

/** Render in measured pixels: axis typography stays readable in either shell mode. */
export function drawCurve(plot: SVGSVGElement, samples: readonly ScoredSample[], threshold: Threshold, kind: 'roc'|'pr', shade: boolean): void {
  const w=plot.clientWidth||340, h=plot.clientHeight||230;
  const left=52, top=24, right=w-18, bottom=h-40;
  const x=(v:number):number=>left+v*(right-left), y=(v:number):number=>bottom-v*(bottom-top);
  const points=curvePoints(samples), c=classify(samples,threshold), m=metrics(c);
  const xy=points.map(p=>[kind==='roc'?p.fpr!:p.recall!,kind==='roc'?p.tpr!:p.precision??1]);
  const line=xy.map(([a,b],i)=>`${i?'L':'M'}${x(a)},${y(b)}`).join(' ');
  // AP uses each interval's right-end precision, not the trapezoidal ROC rule.
  const ap=xy.map(([a,b],i)=>i?`V${y(b)} H${x(a)}`:`M${x(a)},${y(b)}`).join(' ');
  plot.setAttribute('viewBox',`0 0 ${w} ${h}`);
  plot.replaceChildren();
  if(shade) plot.append(svg('path',{d:`${kind==='roc'?line:ap} L${x(1)},${y(0)} L${x(0)},${y(0)} Z`,class:'roc-area'}));
  for(const v of [0,.5,1]) {
    plot.append(svg('line',{x1:String(x(v)),x2:String(x(v)),y1:String(top),y2:String(bottom),class:'roc-grid'}));
    plot.append(svg('line',{x1:String(left),x2:String(right),y1:String(y(v)),y2:String(y(v)),class:'roc-grid'}));
    plot.append(svg('text',{x:String(x(v)),y:String(bottom+18),'text-anchor':'middle',class:'roc-tick'},String(v)));
    plot.append(svg('text',{x:String(left-9),y:String(y(v)+5),'text-anchor':'end',class:'roc-tick'},String(v)));
  }
  const prevalence=samples.filter(s=>s.actual===1).length/samples.length;
  plot.append(svg('line',{x1:String(left),y1:String(kind==='roc'?bottom:y(prevalence)),x2:String(right),y2:String(kind==='roc'?top:y(prevalence)),class:'roc-reference'}));
  plot.append(svg('path',{d:kind==='roc'?line:ap,class:'roc-curve','data-curve':kind}));
  for(const [a,b] of xy)plot.append(svg('circle',{cx:String(x(a)),cy:String(y(b)),r:'3',class:'roc-candidate'}));
  const px=kind==='roc'?c.fp/(c.fp+c.tn):m.recall!;
  const py=kind==='roc'?m.recall!:m.precision??1;
  plot.append(svg('circle',{cx:String(x(px)),cy:String(y(py)),r:'7',class:'roc-selected','data-operating':kind,'data-x':String(px),'data-y':String(py)}));
  plot.append(svg('text',{x:String((left+right)/2),y:String(h-4),'text-anchor':'middle',class:'roc-axis'},kind==='roc'?'FPR = FP / (FP + TN)':'Recall = TP / (TP + FN)'));
  plot.append(svg('text',{x:'4',y:'15',class:'roc-axis'},kind==='roc'?'TPR (recall)':'Precision'));
}
