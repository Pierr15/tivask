import { env } from '../../config/env.js';
import { IntentRouter } from './IntentRouter.js';
import { LocalSemanticEngine,MENU,terms } from './LocalSemanticEngine.js';
import { GroundingValidator } from './GroundingValidator.js';
import type { GeminiProvider } from './GeminiProvider.js';
import type { RetrievalService } from '../rag/RetrievalService.js';
import type { StructuredKnowledgeService } from '../knowledge/StructuredKnowledgeService.js';
import type { MessageRow } from '../conversation/Persistence.js';
export type Answer={text:string;route:string;topic:string|null;escalate:boolean;sources:string[]};
export class AIService{
 private router=new IntentRouter();private local=new LocalSemanticEngine();private grounding=new GroundingValidator();
 constructor(private knowledge:StructuredKnowledgeService,private retrieval:RetrievalService,private gemini:GeminiProvider){}
 async answer(question:string,history:MessageRow[]):Promise<Answer>{
 const intent=this.router.route(question,history);
 const base={topic:intent.category,sources:[] as string[],escalate:false};
 if(intent.escalate)return {...base,text:'Pertanyaan Anda akan diteruskan ke panitia.',route:'ESCALATION',escalate:true};
 if(intent.greeting||intent.menu&&!intent.category)return {...base,text:MENU,route:'LOCAL'};
 const items=await this.knowledge.evidence();
 const direct=this.local.select(intent,items);
 if(direct.length)return {...base,text:this.local.answer(direct),route:this.knowledge.source==='POSTGRESQL'?'STRUCTURED':'FALLBACK',sources:direct.map(i=>i.title)};
 const retrieved=await this.retrieval.search(intent.query);
 if(retrieved.evidence.length){
 if(this.gemini.available()){
 try{
 const raw=await this.gemini.select(intent.query,retrieved.evidence,history);
 const quotes=this.grounding.validate(raw,retrieved.evidence);
 if(quotes?.length)return {...base,route:'RAG',sources:quotes.map(q=>q.source),text:'Berikut informasi dari dokumen yang tersedia:\n\n'+quotes.map(q=>(q.demo?'[DATA DEMO]\n':'')+q.quote+'\n(Sumber: '+q.source+(q.page?', hlm. '+q.page:'')+')').join('\n\n')};
 }catch{}
 }
 // Offline passage extraction is exact and must cover every meaningful query term, including gender.
 const required=terms(intent.query);const female=/perempuan|wanita|putri/i.test(question);const male=/laki.laki|pria|putra/i.test(question);
 for(const e of retrieved.evidence){
 const passages=e.text.split(/\n\s*\n|(?<=[.!?])\s+/).filter(s=>s.trim().length>20&&s.length<=1800);
 const passage=passages.find(s=>required.every(t=>s.toLowerCase().includes(t))&&(!female||/perempuan|wanita|putri/i.test(s))&&(!male||/laki.laki|pria|putra/i.test(s)));
 if(passage)return {...base,route:'FALLBACK',sources:[e.source],text:(e.demo?'[DATA DEMO]\n':'')+'Kutipan dokumen:\n\n'+passage.trim()+'\n\nSumber: '+e.source+(e.page?' (hlm. '+e.page+')':'')};
 }
 }
 return {...base,text:'Informasi tersebut belum tersedia dalam basis informasi resmi kami.',route:'ESCALATION',escalate:true};
 }
}

