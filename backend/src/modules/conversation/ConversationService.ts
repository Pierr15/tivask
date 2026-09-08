import { env } from '../../config/env.js';
import { KeyQueue } from '../../core/KeyQueue.js';
import { AppError } from '../../core/errors.js';
import type { AIService } from '../ai/AIService.js';
import type { TicketService } from '../tickets/TicketService.js';
import type { Persistence } from './Persistence.js';
import { conversationId } from './Persistence.js';
export class ConversationService{
 readonly queue=new KeyQueue();
 constructor(readonly persistence:Persistence,private ai:AIService,private tickets:TicketService){}
 handle(sender:string,question:string,channel:'SIMULATOR'|'WHATSAPP',externalId:string|null=null){
 return this.queue.run(sender,async()=>{
 const start=Date.now();const id=await this.persistence.ensure(sender,channel);
 const history=await this.persistence.history(id,env.CONVERSATION_HISTORY_LIMIT);
 await this.persistence.message({conversationId:id,role:'USER',content:question,route:null,topic:null,delivery:'RECEIVED',externalId});
 await this.persistence.event('MESSAGE_RECEIVED',null,channel);
 const active=(await this.persistence.tickets()).find(t=>t.conversationId===id&&t.status==='IN_PROGRESS');
 let answer;
 if(active)answer={text:'Pesan Anda sudah dicatat untuk panitia pada tiket *'+active.id+'*. Panitia sedang menangani percakapan ini.',route:'HUMAN_PENDING',topic:null,escalate:false,sources:[]};
 else answer=await this.ai.answer(question,history);
 // Store resolved topic with the original user message for automatic follow-up resolution.
 await this.persistence.journal.update(s=>{const last=[...s.messages].reverse().find(m=>m.conversationId===id&&m.role==='USER');if(last){last.topic=answer.topic;last.pending=true;}});
 let ticketId:string|undefined;
 if(answer.escalate){const t=await this.tickets.create(id,sender,question,answer.text);ticketId=t.id;answer.text+='\n\n'+this.tickets.response(t);}
 const message=await this.persistence.message({conversationId:id,role:'ASSISTANT',content:answer.text,route:answer.route,topic:answer.topic,delivery:channel==='SIMULATOR'?'SIMULATED':'PENDING',externalId:null});
 await this.persistence.event(answer.route==='ESCALATION'?'ESCALATION':answer.route+'_ANSWER',answer.topic,channel,Date.now()-start);
 await this.persistence.sync();
 return {...answer,ticketId,conversationId:id,messageId:message.id,latencyMs:Date.now()-start,knowledgeYear:env.ACADEMIC_YEAR};
 });
 }
 async adminReply(ticketId:string,text:string,requestId:string,send:(to:string,text:string)=>Promise<void>){
 const ticket=await this.tickets.find(ticketId);
 return this.queue.run(ticket.whatsappNumber,async()=>{
 if(ticket.status==='RESOLVED')throw new AppError(409,'Buka kembali tiket sebelum membalas.');
 const id='admin-'+requestId;
 const old=await this.persistence.findMessage(id);
 if(old){if(old.conversationId!==ticket.conversationId||old.content!==text)throw new AppError(409,'Request ID sudah digunakan untuk balasan lain.');return {delivery:old.delivery,messageId:old.id,duplicate:true};}
 const simulator=ticket.whatsappNumber.startsWith('sim:');
 await this.persistence.message({id,conversationId:ticket.conversationId,role:'ADMIN',content:text,route:'HUMAN',topic:null,delivery:simulator?'SIMULATED':'SENDING',externalId:null});
 if(!simulator){
 try{await send(ticket.whatsappNumber,text);await this.persistence.delivery(id,'SENT');}
 catch(e){await this.persistence.delivery(id,'UNCERTAIN');throw new AppError(502,'Status kirim belum pasti. Periksa WhatsApp sebelum mengirim ulang agar tidak terjadi duplikat.');}
 }
 if(ticket.status==='OPEN')await this.tickets.update(ticketId,{status:'IN_PROGRESS'});
 await this.persistence.sync();return {delivery:simulator?'SIMULATED':'SENT',messageId:id,duplicate:false};
 });
 }
 history(sender:string){return this.persistence.history(conversationId(sender),50);}
}
