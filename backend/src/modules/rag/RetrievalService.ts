import { prisma,db } from '../../core/prisma.js';
import { env } from '../../config/env.js';
import { EmbeddingService } from './EmbeddingService.js';
import { VectorRepository } from './VectorRepository.js';
import { terms } from '../ai/LocalSemanticEngine.js';
import { normalize } from '../ai/IntentRouter.js';
import type { Evidence } from '../ai/GroundingValidator.js';
export class RetrievalService{
 constructor(readonly embedding:EmbeddingService,readonly vectors:VectorRepository){}
 async search(question:string):Promise<{evidence:Evidence[];mode:string}>{
 if(this.embedding.available())try{const v=await this.embedding.embed(question,true);const evidence=(await this.vectors.search(v,this.embedding.model)).filter(e=>e.score>=env.RAG_MIN_SCORE);if(evidence.length)return {evidence,mode:this.vectors.mode};}catch{}
 const tokens=terms(question);if(!tokens.length)return {evidence:[],mode:'LEXICAL'};
 try{
 const chunks=await db(()=>prisma.documentChunk.findMany({where:{document:{verified:true,status:'INDEXED',...(env.DEMO_MODE?{}:{demo:false})}},include:{document:{select:{demo:true}}},take:2000,orderBy:{createdAt:'desc'}}));
 const evidence=chunks.map(c=>({id:c.id,text:c.text,source:c.filename,page:c.page,demo:c.document.demo,score:tokens.filter(t=>normalize(c.text).includes(t)).length/tokens.length})).filter(c=>c.score>=.8).sort((a,b)=>b.score-a.score).slice(0,env.RAG_TOP_K);
 return {evidence,mode:'LEXICAL'};
 }catch{return {evidence:[],mode:'UNAVAILABLE'};}
 }
}

