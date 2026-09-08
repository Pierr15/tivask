import { randomUUID } from 'node:crypto';
import { readFile,writeFile,mkdir,unlink } from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { prisma,db } from '../../core/prisma.js';
import { AppError } from '../../core/errors.js';
import { dataPath } from '../../config/env.js';
import { ChunkService,type TextPage } from './ChunkService.js';
import type { EmbeddingService } from './EmbeddingService.js';
import type { VectorRepository } from './VectorRepository.js';
import type { Persistence } from '../conversation/Persistence.js';
import { logger } from '../../core/logger.js';
export class DocumentService{
 private running=new Set<string>();private tail:Promise<void>=Promise.resolve();
 constructor(private embedding:EmbeddingService,private vectors:VectorRepository,private persistence:Persistence){}
 async upload(file:{originalname:string;mimetype:string;buffer:Buffer},verified:boolean,demo:boolean){
 const ext=path.extname(file.originalname).toLowerCase();if(!['.pdf','.docx','.json'].includes(ext))throw new AppError(400,'Gunakan PDF, DOCX, atau JSON.');
 const filename=path.basename(file.originalname).replace(/[\x00-\x1f]/g,'').slice(0,180);
 const storageName=randomUUID()+ext;await mkdir(dataPath('uploads'),{recursive:true});await writeFile(dataPath('uploads',storageName),file.buffer);
 try{const row=await db(()=>prisma.document.create({data:{filename,storageName,mimeType:file.mimetype,verified,demo}}));this.enqueue(row.id);return row;}
 catch(e){await unlink(dataPath('uploads',storageName)).catch(()=>{});throw e;}
 }
 enqueue(id:string){
 if(this.running.has(id))return;this.running.add(id);
 this.tail=this.tail.then(()=>this.index(id)).catch(()=>logger.warn({documentId:id},'Document indexing failed')).finally(()=>{this.running.delete(id);});
 }
 async recover(){await db(()=>prisma.document.updateMany({where:{status:{in:['PENDING','PROCESSING']}},data:{status:'FAILED',error:'Indexing terhenti saat server restart. Klik Index ulang.'}})).catch(()=>{});}
 async index(id:string){
 try{
 const document=await db(()=>prisma.document.update({where:{id},data:{status:'PROCESSING',error:null,indexedAt:null}}));
 const buffer=await readFile(dataPath('uploads',document.storageName));let pages:TextPage[];
 switch(path.extname(document.filename).toLowerCase()){
 case '.docx':{const result=await mammoth.extractRawText({buffer});pages=[{page:null,text:result.value}];break;}
 case '.pdf':{const parser=new PDFParse({data:new Uint8Array(buffer)});try{const result=await parser.getText();pages=result.pages.map(p=>({page:p.num,text:p.text}));}finally{await parser.destroy();}break;}
 default:{const value:unknown=JSON.parse(buffer.toString('utf8'));pages=[{page:null,text:JSON.stringify(value,null,2)}];}
 }
 if(pages.reduce((n,p)=>n+p.text.length,0)>500000)throw new Error('Dokumen terlalu panjang. Pecah menjadi beberapa dokumen.');
 const chunks=new ChunkService().split(pages);if(!chunks.length)throw new Error('Tidak ada teks yang terbaca. PDF hasil scan perlu OCR terlebih dahulu.');
 if(chunks.length>350)throw new Error('Maksimal 350 chunks per dokumen. Pecah dokumen terlebih dahulu.');
 await db(()=>prisma.documentChunk.deleteMany({where:{documentId:id}}));
 let embedded=0,embeddingFailed=false;
 for(const chunk of chunks){
 let vector:number[]|undefined;
 if(this.embedding.available()&&!embeddingFailed)try{vector=await this.embedding.embed(chunk.text);}catch{embeddingFailed=true;}
 const row=await db(()=>prisma.documentChunk.create({data:{...chunk,documentId:id,filename:document.filename,...(vector?{embedding:vector,embeddingModel:this.embedding.model}:{})}}));
 if(vector){await this.vectors.saveVector(row.id,vector);embedded++;}
 }
 const indexMode=embedded===chunks.length?'VECTOR':embedded?'PARTIAL_VECTOR':'LEXICAL';
 await db(()=>prisma.document.update({where:{id},data:{status:'INDEXED',indexedAt:new Date(),indexMode,error:embeddingFailed?'Embedding gagal; pencarian teks tetap tersedia. Coba Index ulang setelah API pulih.':null}}));
 await this.persistence.event('DOCUMENT_INDEXED',null,'ADMIN');await this.persistence.sync();
 }catch(e){
 const message=e instanceof Error&&/teks|panjang|chunks|dokumen/i.test(e.message)?e.message:'Dokumen gagal diproses. Periksa format file, database, lalu index ulang.';
 await prisma.document.update({where:{id},data:{status:'FAILED',error:message}}).catch(()=>{});
 }
 }
 async remove(id:string){if(this.running.has(id))throw new AppError(409,'Tunggu indexing selesai sebelum menghapus.');const d=await db(()=>prisma.document.delete({where:{id}}));await unlink(dataPath('uploads',d.storageName)).catch(()=>{});}
}

