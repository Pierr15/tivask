import { randomBytes } from 'node:crypto';
import { AppError } from '../../core/errors.js';
import type { Persistence,TicketRow } from '../conversation/Persistence.js';
import { env } from '../../config/env.js';
export class TicketService{
 constructor(private persistence:Persistence){}
 async create(conversationId:string,sender:string,question:string,reason:string){
 const existing=(await this.persistence.tickets()).find(t=>t.conversationId===conversationId&&t.status!=='RESOLVED');
 if(existing)return existing;
 const now=new Date().toISOString();
 const row:TicketRow={id:'TCK-'+randomBytes(5).toString('hex').toUpperCase(),conversationId,whatsappNumber:sender,name:null,question,summary:question.slice(0,300),summarySource:'LOCAL',reason,priority:'NORMAL',status:'OPEN',createdAt:now,updatedAt:now,resolvedAt:null};
 return this.persistence.saveTicket(row);
 }
 async find(id:string){const t=(await this.persistence.tickets()).find(t=>t.id===id);if(!t)throw new AppError(404,'Tiket tidak ditemukan.');return t;}
 async update(id:string,patch:Partial<Pick<TicketRow,'status'|'priority'|'name'>>){
 const ticket=await this.find(id);if(patch.status&&patch.status!==ticket.status){
 const allowed={OPEN:['IN_PROGRESS'],IN_PROGRESS:['RESOLVED','OPEN'],RESOLVED:['OPEN']};
 if(!allowed[ticket.status].includes(patch.status))throw new AppError(409,'Ubah tiket OPEN menjadi IN_PROGRESS sebelum RESOLVED.');
 }
 return this.persistence.saveTicket({...ticket,...patch,updatedAt:new Date().toISOString(),resolvedAt:patch.status==='RESOLVED'?new Date().toISOString():patch.status?null:ticket.resolvedAt});
 }
 response(ticket:TicketRow){return 'Informasi atau kasus ini perlu dikonfirmasi kepada panitia.\n\nNomor tiket: *'+ticket.id+'*\nPertanyaan Anda sudah dicatat. Panitia dapat menindaklanjuti melalui percakapan ini.'+(env.PANITIA_WA?'\n\nKontak '+env.PANITIA_NAME+': '+env.PANITIA_WA:'\n\nKontak panitia belum diisi oleh admin.');}
}

