import { env } from '../../config/env.js';
import { IntentRouter } from './IntentRouter.js';
import { LocalSemanticEngine,MENU } from './LocalSemanticEngine.js';
import { lexicalScore,supportsQuery } from './QuerySignals.js';
import { GroundingValidator } from './GroundingValidator.js';
import type { GeminiProvider } from './GeminiProvider.js';
import type { RetrievalService } from '../rag/RetrievalService.js';
import type { StructuredKnowledgeService } from '../knowledge/StructuredKnowledgeService.js';
import type { MessageRow } from '../conversation/Persistence.js';

export type Answer={text:string;route:string;topic:string|null;escalate:boolean;sources:string[]};

export class AIService{
 private router=new IntentRouter();
 private local=new LocalSemanticEngine();
 private grounding=new GroundingValidator();

 constructor(private knowledge:StructuredKnowledgeService,private retrieval:RetrievalService,private gemini:GeminiProvider){}

 async answer(question:string,history:MessageRow[]):Promise<Answer>{
 const intent=this.router.route(question,history);
 const base={topic:intent.category,sources:[] as string[],escalate:false};
 if(intent.escalate)return {...base,text:'Pertanyaan Anda akan diteruskan ke panitia.',route:'ESCALATION',escalate:true};
 if(intent.greeting||intent.menu&&!intent.category)return {...base,text:MENU,route:'LOCAL'};

 // 1) Fakta terstruktur adalah sumber utama dan tidak memerlukan generative inference.
 const items=await this.knowledge.evidence();
 const direct=this.local.select(intent,items);
 if(direct.length)return {...base,text:this.local.answer(direct),route:this.knowledge.source==='POSTGRESQL'?'STRUCTURED':'FALLBACK',sources:direct.map(i=>i.title)};

 // 2) FAQ terverifikasi dicari secara lexical sebelum dokumen RAG.
 const faq=this.local.selectFaq(intent,items);
 if(faq.length)return {...base,text:this.local.answer(faq),route:'FAQ',sources:faq.map(i=>i.title)};

 // 3) Dokumen memakai hybrid retrieval: semantic + lexical + reranking.
 const retrieved=await this.retrieval.search(intent.query);
 if(retrieved.evidence.length){
 if(this.gemini.available()){
 try{
 const raw=await this.gemini.select(intent.query,retrieved.evidence,history);
 const quotes=this.grounding.validate(raw,retrieved.evidence,intent.query);
 if(quotes?.length)return {...base,route:'RAG',sources:quotes.map(q=>q.source),text:'Berikut informasi dari dokumen yang tersedia:\n\n'+quotes.map(q=>(q.demo?'[DATA DEMO]\n':'')+q.quote+'\n(Sumber: '+q.source+(q.page?', hlm. '+q.page:'')+')').join('\n\n')};
 }catch{}
 }

 // Fallback offline tetap fail-closed: passage wajib relevan terhadap qualifier
 // dan memiliki lexical support yang cukup. Tidak ada completion/inference bebas.
 const passages=retrieved.evidence.flatMap(e=>e.text.split(/\n\s*\n|(?<=[.!?])\s+/).map(text=>({e,text:text.trim()}))).filter(x=>x.text.length>20&&x.text.length<=1800&&supportsQuery(intent.query,x.text)).map(x=>({...x,score:lexicalScore(intent.query,x.text)})).filter(x=>x.score>=Math.max(.55,env.RAG_MIN_SCORE-.1)).sort((a,b)=>b.score-a.score);
 const best=passages[0];
 if(best)return {...base,route:'FALLBACK',sources:[best.e.source],text:(best.e.demo?'[DATA DEMO]\n':'')+'Kutipan dokumen:\n\n'+best.text+'\n\nSumber: '+best.e.source+(best.e.page?' (hlm. '+best.e.page+')':'')};
 }

 // Abstention adalah perilaku normal jika tidak ada evidence yang cukup kuat.
 return {...base,text:'Informasi tersebut belum tersedia atau belum cukup spesifik dalam basis informasi resmi kami. Pertanyaan ini akan diteruskan ke panitia.',route:'ESCALATION',escalate:true};
 }
}
