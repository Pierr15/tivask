import { randomBytes } from 'node:crypto';
import { AppError } from '../../core/errors.js';
import { JsonStore } from '../../core/JsonStore.js';
import { dataPath,env } from '../../config/env.js';
import type { Persistence,TicketRow } from '../conversation/Persistence.js';
import { TicketRelationService,type TicketRelationResult } from './TicketRelationService.js';

type PendingRelation={ticketId:string;message:string;whatsappMessageId:string|null;createdAt:number};
const activeStatuses=new Set(['OPEN','ASSIGNED','IN_PROGRESS','WAITING_USER']);

export class TicketService{
 private relation=new TicketRelationService();
 private pendingRelations=new JsonStore<Record<string,PendingRelation>>(dataPath('fallback','pending-ticket-relations.json'),()=>({}));
 constructor(private persistence:Persistence){}

 async activeForConversation(conversationId:string){
 return (await this.persistence.tickets()).filter(t=>t.conversationId===conversationId&&activeStatuses.has(t.status));
 }

 async matchActive(conversationId:string,message:string):Promise<{ticket:TicketRow;result:TicketRelationResult}|null>{
 let best:{ticket:TicketRow;result:TicketRelationResult}|null=null;
 for(const ticket of await this.activeForConversation(conversationId)){
 const recent=await this.persistence.ticketMessages(ticket.id,8);
 const result=this.relation.classify(ticket,message,recent);
 if(!best||result.score>best.result.score)best={ticket,result};
 }
 return best;
 }

 async create(conversationId:string,sender:string,question:string,reason:string,topic:string|null=null){
 for(const existing of await this.activeForConversation(conversationId)){
 const recent=await this.persistence.ticketMessages(existing.id,8);
 if(this.relation.classify(existing,question,recent).relation==='RELATED')return {ticket:existing,reused:true};
 }
 const now=new Date().toISOString();
 const row:TicketRow={
 id:'TCK-'+randomBytes(5).toString('hex').toUpperCase(),conversationId,whatsappNumber:sender,name:null,question,
 summary:question.slice(0,300),summarySource:'LOCAL',reason,topic,assignedTo:null,unreadCount:0,lastUserMessageAt:null,
 priority:'NORMAL',status:'OPEN',createdAt:now,updatedAt:now,resolvedAt:null,
 };
 return {ticket:await this.persistence.saveTicket(row),reused:false};
 }

 async appendUserMessage(ticketId:string,content:string,whatsappMessageId:string|null){
 const ticket=await this.find(ticketId);
 const existing=whatsappMessageId?(await this.persistence.ticketMessages(ticketId,100)).find(m=>m.whatsappMessageId===whatsappMessageId):null;
 if(existing)return existing;
 const message=await this.persistence.ticketMessage({ticketId,role:'USER',content,whatsappMessageId,replyToMessageId:null,delivery:'RECEIVED'});
 const now=new Date().toISOString();
 await this.persistence.saveTicket({...ticket,status:ticket.status==='WAITING_USER'?'IN_PROGRESS':ticket.status,unreadCount:(ticket.unreadCount??0)+1,lastUserMessageAt:now,updatedAt:now,resolvedAt:null});
 return message;
 }

 async markRead(id:string){const ticket=await this.find(id);return this.persistence.saveTicket({...ticket,unreadCount:0,updatedAt:new Date().toISOString()});}

 async find(id:string){const t=(await this.persistence.tickets()).find(t=>t.id===id);if(!t)throw new AppError(404,'Tiket tidak ditemukan.');return t;}

 async update(id:string,patch:Partial<Pick<TicketRow,'status'|'priority'|'name'|'assignedTo'>>){
 const ticket=await this.find(id);
 if(patch.status&&patch.status!==ticket.status){
 const allowed:Record<string,string[]>={
 OPEN:['ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED'],
 ASSIGNED:['OPEN','IN_PROGRESS','RESOLVED','CLOSED'],
 IN_PROGRESS:['OPEN','WAITING_USER','RESOLVED','CLOSED'],
 WAITING_USER:['IN_PROGRESS','RESOLVED','CLOSED'],
 RESOLVED:['OPEN','CLOSED'],
 CLOSED:['OPEN'],
 };
 if(!allowed[ticket.status]?.includes(patch.status))throw new AppError(409,'Perubahan status tiket tidak valid.');
 }
 const status=patch.status??ticket.status;
 const finished=status==='RESOLVED'||status==='CLOSED';
 return this.persistence.saveTicket({...ticket,...patch,updatedAt:new Date().toISOString(),resolvedAt:finished?(ticket.resolvedAt??new Date().toISOString()):patch.status?null:ticket.resolvedAt});
 }

 async setPendingRelation(conversationId:string,ticketId:string,message:string,whatsappMessageId:string|null){
 await this.pendingRelations.update(s=>{s[conversationId]={ticketId,message,whatsappMessageId,createdAt:Date.now()};});
 }

 async pendingRelation(conversationId:string){
 const state=await this.pendingRelations.read();const pending=state[conversationId];
 if(!pending)return null;
 if(pending.createdAt<Date.now()-10*60*1000){await this.clearPendingRelation(conversationId);return null;}
 return pending;
 }

 async clearPendingRelation(conversationId:string){await this.pendingRelations.update(s=>{delete s[conversationId];});}
 confirmation(message:string):'YES'|'NO'|null{
 const q=message.trim().toLowerCase();
 if(/^(1|ya|iya|y|yes|lanjut|terkait|masih terkait)$/.test(q))return 'YES';
 if(/^(2|tidak|nggak|enggak|gak|ga|no|baru|beda|tidak terkait)$/.test(q))return 'NO';
 return null;
 }

 response(ticket:TicketRow,reused=false){
 return (reused?'Pesan Anda ditambahkan ke tiket yang masih aktif.':'Pertanyaan Anda sudah diteruskan ke panitia.')+'\n\nNomor tiket: *'+ticket.id+'*\nAnda tetap bisa bertanya hal lain kepada TIVAsk. Pesan yang masih terkait tiket ini akan diteruskan ke panitia.'+(env.PANITIA_WA?'\n\nKontak '+env.PANITIA_NAME+': '+env.PANITIA_WA:'');
 }
}
