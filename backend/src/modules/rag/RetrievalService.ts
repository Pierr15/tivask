import { prisma,db } from '../../core/prisma.js';
import { env } from '../../config/env.js';
import { EmbeddingService } from './EmbeddingService.js';
import { VectorRepository } from './VectorRepository.js';
import { genderMatches,lexicalScore,supportsQuery,terms } from '../ai/QuerySignals.js';
import { normalize } from '../ai/IntentRouter.js';
import type { Evidence } from '../ai/GroundingValidator.js';

const clamp=(n:number)=>Math.max(0,Math.min(1,n));

function looseLexicalScore(question:string,text:string){
 const q=terms(question);if(!q.length)return 0;
 const haystack=normalize(text);
 return q.filter(t=>haystack.includes(t)).length/q.length;
}

export function mergeContextTexts(texts:string[]){
 let merged='';
 for(const raw of texts){
  const text=raw.trim();if(!text)continue;
  if(!merged){merged=text;continue;}
  if(merged.includes(text))continue;
  const max=Math.min(420,merged.length,text.length);let overlap=0;
  for(let n=max;n>=24;n--){if(merged.endsWith(text.slice(0,n))){overlap=n;break;}}
  const remainder=text.slice(overlap).trim();
  if(remainder)merged+='\n\n'+remainder;
 }
 return merged.trim();
}

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
 let score:number;
 if(vector>0&&lexical>0)score=.55*vector+.4*lexical+.05*Math.min(vector,lexical);
 else if(vector>0)score=.72*vector;
 else score=lexical;
 // Qualifier diperiksa SETELAH chunk tetangga direkonstruksi. Dengan begitu data yang
 // terbelah di batas chunk masih bisa dipakai, tetapi konteks yang salah tetap ditolak.
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
 return (await this.vectors.search(vector,this.embedding.model)).filter(e=>e.score>=Math.max(.25,env.RAG_MIN_SCORE-.25));
 }catch{return [];}
 }

 private async lexicalCandidates(question:string):Promise<Evidence[]>{
 try{
 const chunks=await db(()=>prisma.documentChunk.findMany({where:{document:{verified:true,status:'INDEXED',...(env.DEMO_MODE?{}:{demo:false})}},include:{document:{select:{demo:true}}},take:2000,orderBy:{createdAt:'desc'}}));
 const floor=Math.max(.2,env.RAG_MIN_SCORE*.35);
 return chunks.map(c=>{
  // Loose score sengaja mengabaikan gender pada tahap kandidat. Gender/qualifier bisa
  // berada di chunk sebelah dan akan divalidasi setelah context reconstruction.
  const score=Math.max(lexicalScore(question,c.text),looseLexicalScore(question,c.text));
  return {id:c.id,text:c.text,source:c.filename,page:c.page,demo:c.document.demo,score};
 }).filter(c=>c.score>=floor).sort((a,b)=>b.score-a.score).slice(0,Math.max(env.RAG_TOP_K*5,16));
 }catch{return [];}
 }

 private async expandContext(candidates:Evidence[]):Promise<Evidence[]>{
 if(!candidates.length)return [];
 try{
  const ids=[...new Set(candidates.map(c=>c.id))];
  const anchors=await db(()=>prisma.documentChunk.findMany({where:{id:{in:ids}},select:{id:true,documentId:true,chunkIndex:true,page:true}}));
  if(!anchors.length)return candidates;
  const ranges=anchors.map(a=>({documentId:a.documentId,chunkIndex:{gte:Math.max(0,a.chunkIndex-1),lte:a.chunkIndex+1}}));
  const rows=await db(()=>prisma.documentChunk.findMany({where:{OR:ranges},select:{documentId:true,chunkIndex:true,text:true,page:true},orderBy:[{documentId:'asc'},{chunkIndex:'asc'}]}));
  const anchorById=new Map(anchors.map(a=>[a.id,a]));
  return candidates.map(candidate=>{
   const anchor=anchorById.get(candidate.id);if(!anchor)return candidate;
   const neighbors=rows.filter(r=>r.documentId===anchor.documentId&&Math.abs(r.chunkIndex-anchor.chunkIndex)<=1).sort((a,b)=>a.chunkIndex-b.chunkIndex);
   if(!neighbors.length)return candidate;
   return {...candidate,text:mergeContextTexts(neighbors.map(n=>n.text)),page:anchor.page??candidate.page};
  });
 }catch{return candidates;}
 }

 async search(question:string):Promise<{evidence:Evidence[];mode:string}>{
 const [vectorEvidence,lexicalEvidence]=await Promise.all([this.vectorCandidates(question),this.lexicalCandidates(question)]);
 const expanded=await this.expandContext([...vectorEvidence,...lexicalEvidence]);
 const expandedById=new Map(expanded.map(e=>[e.id,e]));
 const withContext=(items:Evidence[])=>items.map(item=>{const context=expandedById.get(item.id);return context?{...context,score:item.score}:item;});
 const vectorWithContext=withContext(vectorEvidence);
 const lexicalWithContext=withContext(lexicalEvidence);
 const evidence=fuseHybridEvidence(question,vectorWithContext,lexicalWithContext,env.RAG_TOP_K,env.RAG_MIN_SCORE);
 const mode=vectorEvidence.length&&lexicalEvidence.length?'HYBRID_CONTEXT':vectorEvidence.length?'VECTOR_CONTEXT':lexicalEvidence.length?'LEXICAL_CONTEXT':'UNAVAILABLE';
 return {evidence,mode};
 }
}
