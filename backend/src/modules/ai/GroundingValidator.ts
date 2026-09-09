import { z } from 'zod';
import { supportsQuery } from './QuerySignals.js';

export type Evidence={id:string;text:string;source:string;score:number;demo?:boolean;page?:number|null};

const selection=z.object({
 quotes:z.array(z.object({id:z.string(),quote:z.string().min(12).max(1800)})).max(5).default([]),
 abstain:z.boolean().optional().default(false)
});

export class GroundingValidator{
 validate(raw:unknown,evidence:Evidence[],query?:string){
 const parsed=selection.safeParse(raw);
 if(!parsed.success||parsed.data.abstain||!parsed.data.quotes.length)return null;
 const accepted=parsed.data.quotes.map(q=>{
 const e=evidence.find(item=>item.id===q.id);
 return e&&e.text.includes(q.quote)?{...q,source:e.source,page:e.page,demo:e.demo}:null;
 });
 if(accepted.some(a=>a===null))return null;
 const exact=accepted.filter((a):a is NonNullable<typeof a>=>a!==null);
 // Kutipan yang benar-benar ada di dokumen tetap ditolak jika tidak mendukung
 // qualifier pertanyaan. Ini mencegah quote valid tetapi salah konteks/gender/item.
 if(query&&!supportsQuery(query,exact.map(a=>a.quote).join('\n')))return null;
 return exact;
 }
}
