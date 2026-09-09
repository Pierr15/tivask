import { createHash,randomUUID } from 'node:crypto';
import { prisma,db } from '../../core/prisma.js';
import { JsonStore } from '../../core/JsonStore.js';
import { dataPath } from '../../config/env.js';
import type { MessageRole,TicketStatus,Priority } from '@prisma/client';

export type ConversationRow={id:string;whatsappId:string;channel:string;createdAt:string;updatedAt:string};
export type MessageRow={id:string;conversationId:string;role:MessageRole;content:string;route:string|null;topic:string|null;delivery:string;externalId:string|null;createdAt:string};
export type TicketRow={
 id:string;conversationId:string;whatsappNumber:string;name:string|null;question:string;summary:string;summarySource:string;reason:string;
 topic:string|null;assignedTo:string|null;unreadCount:number;lastUserMessageAt:string|null;priority:Priority;status:TicketStatus;
 createdAt:string;updatedAt:string;resolvedAt:string|null;
};
export type TicketMessageRow={id:string;ticketId:string;role:MessageRole;content:string;whatsappMessageId:string|null;replyToMessageId:string|null;delivery:string;createdAt:string};
export type EventRow={id:string;type:string;topic:string|null;channel:string|null;latencyMs:number|null;demo:boolean;createdAt:string};
type Pending<T>=T&{pending:boolean};
type Journal={conversations:Pending<ConversationRow>[];messages:Pending<MessageRow>[];events:Pending<EventRow>[]};
function plain<T>(v:T&{pending:boolean}):T{const {pending,...rest}=v;void pending;return rest as T;}
export const conversationId=(sender:string)=>createHash('sha256').update('tivask:'+sender).digest('hex').slice(0,32);

export class Persistence {
 readonly journal=new JsonStore<Journal>(dataPath('fallback','conversations.json'),()=>({conversations:[],messages:[],events:[]}));
 readonly ticketStore=new JsonStore<{tickets:Pending<TicketRow>[]}>(dataPath('fallback','tickets.json'),()=>({tickets:[]}));
 readonly ticketMessageStore=new JsonStore<{messages:Pending<TicketMessageRow>[]}>(dataPath('fallback','ticket-messages.json'),()=>({messages:[]}));
 private syncing:Promise<void>|null=null;

 async ensure(sender:string,channel:string){
 const id=conversationId(sender);const now=new Date().toISOString();
 await this.journal.update(s=>{const row=s.conversations.find(c=>c.id===id);if(row){row.updatedAt=now;row.pending=true;}else s.conversations.push({id,whatsappId:sender,channel,createdAt:now,updatedAt:now,pending:true});});
 return id;
 }

 async message(row:Omit<MessageRow,'id'|'createdAt'> & {id?:string}){
 const value:MessageRow={...row,id:row.id??randomUUID(),createdAt:new Date().toISOString()};
 await this.journal.update(s=>{if(!s.messages.some(m=>m.id===value.id))s.messages.push({...value,pending:true});});
 return value;
 }

 async delivery(id:string,delivery:string){await this.journal.update(s=>{const row=s.messages.find(m=>m.id===id);if(row){row.delivery=delivery;row.pending=true;}});await this.sync();}

 async event(type:string,topic:string|null=null,channel:string|null=null,latencyMs:number|null=null){
 const event:EventRow={id:randomUUID(),type,topic,channel,latencyMs,demo:channel==='SIMULATOR',createdAt:new Date().toISOString()};
 await this.journal.update(s=>s.events.push({...event,pending:true}));
 }

 async history(id:string,limit=10):Promise<MessageRow[]>{
 const local=(await this.journal.read()).messages.filter(m=>m.conversationId===id);
 let remote:MessageRow[]=[];
 try {remote=(await db(()=>prisma.message.findMany({where:{conversationId:id},orderBy:{createdAt:'desc'},take:limit}))).map(m=>({...m,createdAt:m.createdAt.toISOString()}));}catch{}
 const merged=new Map([...remote,...local.map(plain)].map(m=>[m.id,m]));
 return [...merged.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(-limit);
 }

 async tickets():Promise<TicketRow[]>{
 let remote:TicketRow[]=[];
 try {
 remote=(await db(()=>prisma.ticket.findMany({orderBy:{createdAt:'desc'},take:500}))).map(t=>({
 ...t,
 topic:t.topic??null,
 assignedTo:t.assignedTo??null,
 unreadCount:t.unreadCount??0,
 lastUserMessageAt:t.lastUserMessageAt?.toISOString()??null,
 createdAt:t.createdAt.toISOString(),updatedAt:t.updatedAt.toISOString(),resolvedAt:t.resolvedAt?.toISOString()??null,
 }));
 }catch{}
 const local=(await this.ticketStore.read()).tickets.map(t=>{
 const v=plain(t) as TicketRow;
 return {...v,topic:v.topic??null,assignedTo:v.assignedTo??null,unreadCount:v.unreadCount??0,lastUserMessageAt:v.lastUserMessageAt??null};
 });
 const merged=new Map([...remote,...local].map(t=>[t.id,t]));
 return [...merged.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 }

 async saveTicket(ticket:TicketRow){await this.ticketStore.update(s=>{const at=s.tickets.findIndex(t=>t.id===ticket.id);if(at<0)s.tickets.push({...ticket,pending:true});else s.tickets[at]={...ticket,pending:true};});await this.sync();return ticket;}

 async ticketMessages(ticketId:string,limit=100):Promise<TicketMessageRow[]>{
 const local=(await this.ticketMessageStore.read()).messages.filter(m=>m.ticketId===ticketId).map(plain);
 let remote:TicketMessageRow[]=[];
 try {remote=(await db(()=>prisma.ticketMessage.findMany({where:{ticketId},orderBy:{createdAt:'desc'},take:limit}))).map(m=>({...m,createdAt:m.createdAt.toISOString()}));}catch{}
 const merged=new Map([...remote,...local].map(m=>[m.id,m]));
 return [...merged.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(-limit);
 }

 async ticketMessage(row:Omit<TicketMessageRow,'id'|'createdAt'> & {id?:string}){
 const value:TicketMessageRow={...row,id:row.id??randomUUID(),createdAt:new Date().toISOString()};
 await this.ticketMessageStore.update(s=>{if(!s.messages.some(m=>m.id===value.id))s.messages.push({...value,pending:true});});
 await this.sync();
 return value;
 }

 async updateTicketMessage(id:string,patch:Partial<Pick<TicketMessageRow,'delivery'|'whatsappMessageId'|'replyToMessageId'>>){
 let result:TicketMessageRow|null=null;
 await this.ticketMessageStore.update(s=>{const row=s.messages.find(m=>m.id===id);if(row){Object.assign(row,patch);row.pending=true;result=plain(row);}});
 if(!result){
 try{const remote=await db(()=>prisma.ticketMessage.findUnique({where:{id}}));if(remote){result={...remote,createdAt:remote.createdAt.toISOString()};await this.ticketMessageStore.update(s=>s.messages.push({...result!,...patch,pending:true}));}}catch{}
 }
 await this.sync();return result;
 }

 async ticketMessageById(id:string):Promise<TicketMessageRow|null>{
 const local=(await this.ticketMessageStore.read()).messages.find(m=>m.id===id);if(local)return plain(local);
 try{const remote=await db(()=>prisma.ticketMessage.findUnique({where:{id}}));return remote?{...remote,createdAt:remote.createdAt.toISOString()}:null;}catch{return null;}
 }

 async sync(){
 if(this.syncing)return this.syncing;
 this.syncing=this.flush().finally(()=>{this.syncing=null;});return this.syncing;
 }

 private async flush(){
 try{
 await this.journal.update(async s=>{
 for(const c of s.conversations.filter(r=>r.pending)){const v=plain(c);await db(()=>prisma.conversation.upsert({where:{id:v.id},create:v,update:{updatedAt:v.updatedAt}}));c.pending=false;}
 for(const m of s.messages.filter(r=>r.pending)){const v=plain(m);await db(()=>prisma.message.upsert({where:{id:v.id},create:v,update:{delivery:v.delivery,topic:v.topic,route:v.route}}));m.pending=false;}
 for(const e of s.events.filter(r=>r.pending)){const v=plain(e);await db(()=>prisma.analyticsEvent.upsert({where:{id:v.id},create:v,update:{}}));e.pending=false;}
 const recent=new Set<string>();
 s.messages=[...s.messages].reverse().filter(m=>{const count=[...recent].filter(x=>x.startsWith(m.conversationId+':')).length;if(m.pending||count<30){recent.add(m.conversationId+':'+m.id);return true;}return false;}).reverse();
 s.events=s.events.filter(e=>e.pending);
 });
 await this.ticketStore.update(async s=>{for(const t of s.tickets.filter(r=>r.pending)){const v=plain(t);await db(()=>prisma.ticket.upsert({where:{id:v.id},create:v,update:v}));t.pending=false;}});
 await this.ticketMessageStore.update(async s=>{for(const m of s.messages.filter(r=>r.pending)){const v=plain(m);await db(()=>prisma.ticketMessage.upsert({where:{id:v.id},create:v,update:{delivery:v.delivery,whatsappMessageId:v.whatsappMessageId,replyToMessageId:v.replyToMessageId,content:v.content}}));m.pending=false;}});
 }catch{/* Durable records remain pending and are retried after database recovery. */}
 }

 async pending(){const s=await this.journal.read();const t=await this.ticketStore.read();const tm=await this.ticketMessageStore.read();return [...s.conversations,...s.messages,...s.events,...t.tickets,...tm.messages].filter(r=>r.pending).length;}
 async findMessage(id:string):Promise<MessageRow|null>{const local=(await this.journal.read()).messages.find(m=>m.id===id);if(local)return plain(local);try{const remote=await db(()=>prisma.message.findUnique({where:{id}}));return remote?{...remote,createdAt:remote.createdAt.toISOString()}:null;}catch{return null;}}
}
