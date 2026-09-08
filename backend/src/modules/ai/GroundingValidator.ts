import { z } from 'zod';
export type Evidence={id:string;text:string;source:string;score:number;demo?:boolean;page?:number|null};
const selection=z.object({quotes:z.array(z.object({id:z.string(),quote:z.string().min(12).max(1800)})).min(1).max(5)});
export class GroundingValidator{
 validate(raw:unknown,evidence:Evidence[]){
 const parsed=selection.safeParse(raw);if(!parsed.success)return null;
 const accepted=parsed.data.quotes.map(q=>{const e=evidence.find(e=>e.id===q.id);return e&&e.text.includes(q.quote)?{...q,source:e.source,page:e.page,demo:e.demo}:null;});
 return accepted.some(a=>a===null)?null:accepted.filter(a=>a!==null);
 }
}

