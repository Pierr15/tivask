import { readFile } from 'node:fs/promises';
import { prisma } from '../src/core/prisma.js';
import { dataPath } from '../src/config/env.js';
import { KnowledgeRepository } from '../src/modules/knowledge/KnowledgeRepository.js';
import { knowledgeSchema } from '../src/modules/knowledge/types.js';
const input=JSON.parse(await readFile(dataPath('defaultKnowledge.json'),'utf8')) as {items:unknown[]};
const repository=new KnowledgeRepository();
try{
 for(const raw of input.items){const item=knowledgeSchema.parse(raw);const exists=await prisma.knowledgeEntity.findFirst({where:{category:item.category,title:item.title}});if(!exists)await repository.save(item);}
 console.info('Seed selesai. Identitas sekolah tersedia; tidak ada biaya, jadwal, atau kuota rekaan.');
}finally{await prisma.$disconnect();}

