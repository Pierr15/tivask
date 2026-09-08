import { readFile,mkdir,writeFile,rename } from 'node:fs/promises';
import { dataPath } from '../../config/env.js';
import { knowledgeSchema,type KnowledgeItem } from './types.js';
export class KnowledgeFallback{
 async load():Promise<KnowledgeItem[]>{
 for(const file of ['knowledge-cache.json','defaultKnowledge.json']){
 try{const data=JSON.parse(await readFile(dataPath(file),'utf8')) as {items:unknown[]};return data.items.map(item=>{const value=item as {id:string};return {...knowledgeSchema.parse(item),id:value.id};});}catch(e){if(file==='defaultKnowledge.json')throw e;}
 }return [];
 }
 async save(items:KnowledgeItem[]){await mkdir(dataPath(),{recursive:true});await writeFile(dataPath('knowledge-cache.json.tmp'),JSON.stringify({version:1,items}));await rename(dataPath('knowledge-cache.json.tmp'),dataPath('knowledge-cache.json'));}
}

