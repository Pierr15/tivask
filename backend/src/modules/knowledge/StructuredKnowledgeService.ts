import { KnowledgeRepository } from './KnowledgeRepository.js';
import { KnowledgeFallback } from './KnowledgeFallback.js';
import { env } from '../../config/env.js';
import { logger } from '../../core/logger.js';
import type { KnowledgeItem } from './types.js';
import { databaseCoolingDown } from '../../core/prisma.js';
export class StructuredKnowledgeService{
 readonly repository=new KnowledgeRepository();private fallback=new KnowledgeFallback();
 private cached:KnowledgeItem[]=[];source='DEFAULT';private expires=0;
 async load(force=false){
 if(!force&&Date.now()<this.expires){if(databaseCoolingDown()&&this.source==='POSTGRESQL')this.source='FALLBACK';return this.cached;}
 try {this.cached=await this.repository.list();this.source='POSTGRESQL';try{await this.fallback.save(this.cached);}catch{logger.warn('Knowledge cache could not be saved');}}
 catch {this.cached=await this.fallback.load();this.source='FALLBACK';}
 this.expires=Date.now()+10000;return this.cached;
 }
 async evidence(){return (await this.load()).filter(i=>i.verified&&(!i.demo||env.DEMO_MODE));}
 invalidate(){this.expires=0;}
}
