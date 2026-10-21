import { evaluationData, type CvRun } from '../degerlendirme/data';
import type { CvParams } from './scenario';
export const cvData=evaluationData.cv;
export const development=cvData.samples.filter(s=>s.partition==='development').sort((a,b)=>a.id.localeCompare(b.id));
export const testSamples=cvData.samples.filter(s=>s.partition==='test');
export const numberText=(value:number|null):string=>value===null?'tanımsız':value.toLocaleString('tr-TR',{minimumFractionDigits:3,maximumFractionDigits:3});
export const vectorText=(values:readonly number[]):string=>`[${values.map(numberText).join('; ')}]`;
export function runFor(params:CvParams):CvRun {
  const run=cvData.runs.find(r=>r.k===params.k&&r.method===params.method&&r.c===params.c);
  if(!run)throw new RangeError('Desteklenmeyen önceden hesaplanmış CV çalıştırması');
  return run;
}
export const cText=(c:number):string=>String(c).replace('.',',');
export const positiveTotal=development.filter(s=>s.actual===1).length;
export const negativeTotal=development.length-positiveTotal;
export const foldIndex=(p:CvParams):number=>Math.max(0,Math.min(p.k-1,Math.trunc(p.fold)));
export const positiveCount=(ids:readonly string[]):number=>development.filter(s=>s.actual===1&&ids.includes(s.id)).length;
