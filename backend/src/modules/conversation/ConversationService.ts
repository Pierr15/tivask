import { env } from '../../config/env.js';
import { KeyQueue } from '../../core/KeyQueue.js';
import { AppError } from '../../core/errors.js';
import type { AIService,Answer } from '../ai/AIService.js';
import type { TicketService } from '../tickets/TicketService.js';
import type { Persistence } from './Persistence.js';
import { conversationId } from './Persistence.js';

export class ConversationService{
 readonly queue=new KeyQueue();
 constructor(readonly persistence:Persistence,private ai:AIService,private tickets:TicketService){}

 handle(sender:string,question:string,channel:'SIMULATOR'|'WHATSAPP',externalId:string|null=null,whatsappMessageId:string|null=null){
 return this.queue.run(sender,async()=>{
 const start=Date.now();const id=await this.persistence.ensure(sender,channel);
 const history=await this.persistence.history(id,env.CONVERSATION_HISTORY_LIMIT);
 await this.persistence.message({conversationId:id,role:'USER',content:question,route:null,topic:null,delivery:'RECEIVED',externalId});
 await this.persistence.event('MESSAGE_RECEIVED',null,channel);

 const finish=async(answer:Answer,ticketId?:string,updateTopic=true)=>{
 if(updateTopic)await this.persistence.journal.update(s=>{const last=[...s.messages].reverse().find(m=>m.conversationId===id&&m.role==='USER');if(last){last.topic=answer.topic;last.pending=true;}});
 const message=await this.persistence.message({conversationId:id,role:'ASSISTANT',content:answer.text,route:answer.route,topic:answer.topic,delivery:channel==='SIMULATOR'?'SIMULATED':'PENDING',externalId:null});
 await this.persistence.event(answer.route==='ESCALATION'?'ESCALATION':answer.route+'_ANSWER',answer.topic,channel,Date.now()-start);
 await this.persistence.sync();
 return {...answer,ticketId,conversationId:id,messageId:message.id,latencyMs:Date.now()-start,knowledgeYear:env.ACADEMIC_YEAR};
 };

 let effectiveQuestion=question;
 let effectiveWhatsappMessageId=whatsappMessageId;
 let skipRelation=false;
 let processingDeferred=false;
 const pending=await this.tickets.pendingRelation(id);
 if(pending){
 const confirmation=this.tickets.confirmation(question);
 if(confirmation==='YES'){
 await this.tickets.clearPendingRelation(id);
 const ticket=await this.tickets.find(pending.ticketId);
 await this.tickets.appendUserMessage(ticket.id,pending.message,pending.whatsappMessageId);
 const answer:Answer={text:'Siap, pesan sebelumnya sudah ditambahkan ke tiket *'+ticket.id+'*. Panitia akan melihatnya di thread yang sama.',route:'HUMAN_PENDING',topic:ticket.topic,escalate:false,sources:[]};
 return finish(answer,ticket.id);
 }
 if(confirmation==='NO'){
 await this.tickets.clearPendingRelation(id);
 effectiveQuestion=pending.message;effectiveWhatsappMessageId=pending.whatsappMessageId;skipRelation=true;processingDeferred=true;
 }else{
 await this.tickets.clearPendingRelation(id);
 }
 }

 if(!skipRelation){
 const match=await this.tickets.matchActive(id,effectiveQuestion);
 if(match?.result.relation==='RELATED'){
 await this.tickets.appendUserMessage(match.ticket.id,effectiveQuestion,effectiveWhatsappMessageId);
 const answer:Answer={text:'Pesan ini masih berkaitan dengan tiket *'+match.ticket.id+'*, jadi sudah kutambahkan ke thread panitia. Kamu tetap bisa mengirim pertanyaan lain yang berbeda topik.',route:'HUMAN_PENDING',topic:match.ticket.topic,escalate:false,sources:[]};
 return finish(answer,match.ticket.id);
 }
 if(match?.result.relation==='UNCERTAIN'){
 await this.tickets.setPendingRelation(id,match.ticket.id,effectiveQuestion,effectiveWhatsappMessageId);
 const answer:Answer={text:'Pesan ini mungkin masih berkaitan dengan tiket *'+match.ticket.id+'* ('+match.ticket.summary+').\n\nBalas *1* atau *ya* jika masih terkait. Balas *2* atau *tidak* jika ini pertanyaan baru.',route:'TICKET_CONFIRM',topic:match.ticket.topic,escalate:false,sources:[]};
 return finish(answer,match.ticket.id);
 }
 }

 let answer=await this.ai.answer(effectiveQuestion,history);
 let ticketId:string|undefined;
 if(answer.escalate){
 const adminOnly=/^(admin|panitia|petugas|manusia|5|nomor 5|menu 5|opsi 5)$/i.test(effectiveQuestion.trim());
 const previous=[...history].reverse().find(m=>m.role==='USER'&&m.content.trim()&&!/^(admin|panitia|petugas|manusia)$/i.test(m.content.trim()));
 const ticketQuestion=adminOnly&&previous?previous.content:effectiveQuestion;
 const ticketTopic=answer.topic??(adminOnly&&previous?previous.topic:null);
 const created=await this.tickets.create(id,sender,ticketQuestion,answer.text,ticketTopic);
 ticketId=created.ticket.id;
 await this.tickets.appendUserMessage(created.ticket.id,ticketQuestion,adminOnly&&previous?null:effectiveWhatsappMessageId);
 answer={...answer,text:answer.text+'\n\n'+this.tickets.response(created.ticket,created.reused)};
 }
 return finish(answer,ticketId,!processingDeferred);
 });
 }

 async adminReply(ticketId:string,text:string,requestId:string,replyToMessageId:string|null,send:(to:string,text:string,quotedWhatsappMessageId?:string|null,quoteText?:string|null)=>Promise<string|null>){
 const ticket=await this.tickets.find(ticketId);
 return this.queue.run(ticket.whatsappNumber,async()=>{
 if(ticket.status==='RESOLVED'||ticket.status==='CLOSED')throw new AppError(409,'Buka kembali tiket sebelum membalas.');
 const id='admin-'+requestId;
 const old=await this.persistence.findMessage(id);
 if(old){if(old.conversationId!==ticket.conversationId||old.content!==text)throw new AppError(409,'Request ID sudah digunakan untuk balasan lain.');return {delivery:old.delivery,messageId:old.id,duplicate:true,replyToMessageId};}
 const replyTarget=replyToMessageId?await this.persistence.ticketMessageById(replyToMessageId):null;
 if(replyToMessageId&&(!replyTarget||replyTarget.ticketId!==ticket.id))throw new AppError(400,'Pesan yang akan dibalas tidak ditemukan pada tiket ini.');
 const simulator=ticket.whatsappNumber.startsWith('sim:');
 const threadId='ticket-'+requestId;
 await this.persistence.message({id,conversationId:ticket.conversationId,role:'ADMIN',content:text,route:'HUMAN',topic:ticket.topic,delivery:simulator?'SIMULATED':'SENDING',externalId:null});
 await this.persistence.ticketMessage({id:threadId,ticketId:ticket.id,role:'ADMIN',content:text,whatsappMessageId:null,replyToMessageId:replyTarget?.id??null,delivery:simulator?'SIMULATED':'SENDING'});
 if(!simulator){
 try{
 const sentId=await send(ticket.whatsappNumber,text,replyTarget?.whatsappMessageId??null,replyTarget?.content??null);
 await this.persistence.delivery(id,'SENT');
 await this.persistence.updateTicketMessage(threadId,{delivery:'SENT',whatsappMessageId:sentId});
 }
 catch(e){await this.persistence.delivery(id,'UNCERTAIN');await this.persistence.updateTicketMessage(threadId,{delivery:'UNCERTAIN'});throw new AppError(502,'Status kirim belum pasti. Periksa WhatsApp sebelum mengirim ulang agar tidak terjadi duplikat.');}
 }
 const latest=await this.tickets.find(ticketId);
 if(['OPEN','ASSIGNED','WAITING_USER'].includes(latest.status))await this.tickets.update(ticketId,{status:'IN_PROGRESS',assignedTo:latest.assignedTo??env.ADMIN_USERNAME});
 else if(!latest.assignedTo)await this.tickets.update(ticketId,{assignedTo:env.ADMIN_USERNAME});
 await this.persistence.sync();return {delivery:simulator?'SIMULATED':'SENT',messageId:id,duplicate:false,replyToMessageId:replyTarget?.id??null};
 });
 }

 history(sender:string){return this.persistence.history(conversationId(sender),50);}
}
