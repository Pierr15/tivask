import { prisma,db } from '../../core/prisma.js';
import { env } from '../../config/env.js';
import { EmbeddingService } from './EmbeddingService.js';
import { VectorRepository } from './VectorRepository.js';
import { genderMatches,lexicalScore,supportsQuery } from '../ai/QuerySignals.js';
import type { Evidence } from '../ai/GroundingValidator.js';

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

export function fuseHybridEvidence(question:string,vectorEvidence:Evidence[],lexicalEvidence:Evidence[],limit:number,minScore:number):Evidence[]{
 const merged=new Map<string,{e:Evidence;vector:number;lexical:number}>();
 for(const e of vectorEvidence)merged.set(e.id,{e,vector:clamp(e.score),lexical:0});
 for(const e of lexicalEvidence){
 const current=merged.get(e.id);
 if(current)current.lexical=Math.max(current.lexical,clamp(e.score));
 else merged.set(e.id,{e,vector:0,lexical:clamp(e.score)});
 }
 const ranked:Evidence[]=[];
 for(const entry of merged.values()){
 if(!genderMatches(question,entry.e.text))continue;
 const lexical=Math.max(entry.lexical,lexicalScore(question,entry.e.text));
 const vector=entry.vector;
 let score=vector&&lexical?.55*vector+.4*lexical+.05*Math.min(vector,lexical):vector?.72*vector:lexical;
 // Semantic similarity saja tidak cukup untuk qualifier spesifik seperti seragam,
 // pendaftaran, afirmasi, atau nama jurusan. Evidence yang tidak mendukungnya
 // dipenalti keras dan biasanya jatuh di bawah threshold.
 if(!supportsQuery(question,entry.e.text))score*=.55;
 if(score>=minScore)ranked.push({...entry.e,score:clamp(score)});
 }
 return ranked.sort((a,b)=>b.score-a.score).slice(0,limit);
}

export class RetrievalService{
 constructor(readonly embedding:EmbeddingService,readonly vectors:VectorRepository){}

 private async vectorCandidates(question:string):Promise<Evidence[]>{
 if(!this.embedding.available())return [];
 try{
 const vector=await this.embedding.embed(question,true);
 // Ambil kandidat sedikit lebih longgar daripada threshold final karena lexical
 // agreement dapat menyelamatkan kandidat semantic yang benar.
 return (await this.vectors.search(vector,this.embedding.model)).filter(e=>e.score>=Math.max(.25,env.RAG_MIN_SCORE-.25));
 }catch{return [];}
 }

 private async lexicalCandidates(question:string):Promise<Evidence[]>{
 try{
 const chunks=await db(()=>prisma.documentChunk.findMany({where:{document:{verified:true,status:'INDEXED',...(env.DEMO_MODE?{}:{demo:false})}},include:{document:{select:{demo:true}}},take:2000,orderBy:{createdAt:'desc'}}));
 const floor=Math.max(.25,env.RAG_MIN_SCORE*.45);
 return chunks.map(c=>({id:c.id,text:c.text,source:c.filename,page:c.page,demo:c.document.demo,score:lexicalScore(question,c.text)})).filter(c=>c.score>=floor).sort((a,b)=>b.score-a.score).slice(0,Math.max(env.RAG_TOP_K*4,12));
 }catch{return [];}
 }

 async search(question:string):Promise<{evidence:Evidence[];mode:string}>{
 const [vectorEvidence,lexicalEvidence]=await Promise.all([this.vectorCandidates(question),this.lexicalCandidates(question)]);
 const evidence=fuseHybridEvidence(question,vectorEvidence,lexicalEvidence,env.RAG_TOP_K,env.RAG_MIN_SCORE);
 const mode=vectorEvidence.length&&lexicalEvidence.length?'HYBRID':vectorEvidence.length?'VECTOR_RERANKED':lexicalEvidence.length?'LEXICAL':'UNAVAILABLE';
 return {evidence,mode};
 }
}
