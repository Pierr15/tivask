import { prisma,db } from '../../core/prisma.js';
import { env } from '../../config/env.js';
import type { Evidence } from '../ai/GroundingValidator.js';
export function cosine(a:number[],b:number[]){if(a.length!==b.length||!a.length)return 0;let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?dot/Math.sqrt(aa*bb):0;}
export class VectorRepository{
 mode='NOT_TESTED';
 async saveVector(id:string,vector:number[]){
 try{await db(()=>prisma.$executeRaw`UPDATE "DocumentChunk" SET vector = ${JSON.stringify(vector)}::vector WHERE id = ${id}`);this.mode='PGVECTOR';}catch{this.mode='POSTGRES_JSON_COSINE';}
 }
 async search(vector:number[],model:string):Promise<Evidence[]>{
 try{
 const rows=await db(()=>prisma.$queryRaw<Array<{id:string;text:string;filename:string;page:number|null;score:number;demo:boolean}>>`
 SELECT c.id,c.text,c.filename,c.page,d.demo,1-(c.vector <=> ${JSON.stringify(vector)}::vector) AS score
 FROM "DocumentChunk" c JOIN "Document" d ON c."documentId"=d.id
 WHERE d.verified=true AND d.status='INDEXED' AND (d.demo=false OR ${env.DEMO_MODE}) AND c."embeddingModel"=${model} AND c.vector IS NOT NULL
 ORDER BY c.vector <=> ${JSON.stringify(vector)}::vector LIMIT ${env.RAG_TOP_K}`);
 this.mode='PGVECTOR';return rows.map(r=>({...r,source:r.filename}));
 }catch{
 this.mode='POSTGRES_JSON_COSINE';
 const rows=await db(()=>prisma.documentChunk.findMany({where:{embeddingModel:model,document:{verified:true,status:'INDEXED',...(env.DEMO_MODE?{}:{demo:false})}},include:{document:{select:{demo:true}}},take:2000,orderBy:{createdAt:'desc'}}));
 return rows.map(r=>({id:r.id,text:r.text,page:r.page,source:r.filename,demo:r.document.demo,score:cosine(vector,Array.isArray(r.embedding)?r.embedding.filter((n):n is number=>typeof n==='number'):[])})).sort((a,b)=>b.score-a.score).slice(0,env.RAG_TOP_K);
 }
 }
}

