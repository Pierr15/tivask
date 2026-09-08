import { prisma,db } from '../../core/prisma.js';
export class AnalyticsService {
 async summary(includeDemo=true){
 const eventWhere=includeDemo?{}:{demo:false};const conversationWhere=includeDemo?{}:{channel:'WHATSAPP'};
 const since=new Date(Date.now()-7*86400000);
 try {
 const [conversations,messages,events,tickets,documents]=await db(()=>Promise.all([
 prisma.conversation.count({where:conversationWhere}),
 prisma.message.count({where:{conversation:conversationWhere}}),
 prisma.analyticsEvent.findMany({where:{...eventWhere,createdAt:{gte:since}},orderBy:{createdAt:'asc'},take:50000}),
 prisma.ticket.groupBy({by:['status'],where:{conversation:conversationWhere},_count:true}),
 prisma.document.count({where:{status:'INDEXED',...(includeDemo?{}:{demo:false})}})
 ]));
 const counts:Record<string,number>={};const topics:Record<string,number>={};let sum=0,samples=0;const days:Record<string,number>={};
 for(let i=6;i>=0;i--){const date=new Date(Date.now()-i*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});days[date]=0;}
 for(const e of events){counts[e.type]=(counts[e.type]??0)+1;if(e.topic&&e.type!=='MESSAGE_RECEIVED')topics[e.topic]=(topics[e.topic]??0)+1;
 if(e.latencyMs!==null){sum+=e.latencyMs;samples++;}
 if(e.type==='MESSAGE_RECEIVED'){const d=e.createdAt.toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});if(d in days)days[d]++;}
 }
 return {available:true,source:'POSTGRESQL',includeDemo,period:'7 hari terakhir',conversations,messages,counts,tickets:Object.fromEntries(tickets.map(t=>[t.status,t._count])),documents,averageLatencyMs:samples?Math.round(sum/samples):0,topics:Object.entries(topics).sort((a,b)=>b[1]-a[1]),days:Object.entries(days),recent:events.slice(-8).reverse()};
 }catch{return {available:false,source:'UNAVAILABLE',includeDemo,period:'7 hari terakhir',conversations:null,messages:null,counts:{},tickets:{},documents:null,averageLatencyMs:null,topics:[],days:[],recent:[]};}
 }
}

