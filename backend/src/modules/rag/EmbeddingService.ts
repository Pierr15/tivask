import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
export class EmbeddingService{
 private client=env.GEMINI_API_KEY?new GoogleGenAI({apiKey:env.GEMINI_API_KEY,httpOptions:{timeout:env.AI_TIMEOUT_MS}}):null;
 readonly model=env.GEMINI_EMBEDDING_MODEL;readonly dimensions=768;
 available(){return !!this.client;}
 async embed(text:string,query=false):Promise<number[]>{
 if(!this.client)throw new Error('EMBEDDING_NOT_CONFIGURED');
 const v2=this.model.includes('embedding-2');
 const result=await this.client.models.embedContent({model:this.model,contents:v2?(query?'task: search result | query: ':'task: search result | document: ')+text:text,config:{outputDimensionality:this.dimensions,...(v2?{}:{taskType:query?'RETRIEVAL_QUERY':'RETRIEVAL_DOCUMENT'})}});
 const values=result.embeddings?.[0]?.values;if(!values||values.length!==this.dimensions||values.some(n=>!Number.isFinite(n)))throw new Error('INVALID_EMBEDDING');
 const norm=Math.hypot(...values);if(norm===0)throw new Error('EMPTY_EMBEDDING');return values.map(v=>v/norm);
 }
}

