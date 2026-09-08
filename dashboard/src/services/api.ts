export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
 const form=options.body instanceof FormData;
 const response=await fetch('/api/v1'+path,{credentials:'include',...options,headers:{...(!form?{'Content-Type':'application/json'}:{}),...options.headers}});
 const data=await response.json().catch(()=>({error:'Respons server tidak valid.'})) as {ok:boolean;data:T;error?:string};
 if(!response.ok||!data.ok)throw new Error(data.error||'Permintaan gagal.');return data.data;
}
export const send=<T>(path:string,data:unknown={},method='POST')=>api<T>(path,{method,body:JSON.stringify(data)});
export type Knowledge={id:string;category:string;title:string;content:string;keywords:string[];verified:boolean;demo:boolean;details:{quota?:number;amount?:number;gender?:string;startsAt?:string;endsAt?:string;academicYear?:string;mandatory?:boolean;question?:string}};
export type Doc={id:string;filename:string;status:string;verified:boolean;demo:boolean;indexMode:string|null;error:string|null;uploadedAt:string;indexedAt:string|null;_count:{chunks:number}};
export type Message={id:string;role:string;content:string;createdAt:string;delivery:string;route:string|null;topic:string|null};
export type Ticket={id:string;whatsappNumber:string;question:string;summary:string;summarySource:string;reason:string;status:string;priority:string;name:string|null;createdAt:string};
export type Status={backend:string;database:{status:string;schema:string;pgvector:boolean};gemini:{status:string;model:string;lastChecked:string|null};whatsapp:string;rag:{status:string;mode:string;indexed:number};knowledgeSource:string;pendingSync:number;demoMode:boolean;schoolName:string;academicYear:string};
export type Analytics={available:boolean;source:string;period:string;conversations:number|null;messages:number|null;counts:Record<string,number>;tickets:Record<string,number>;documents:number|null;averageLatencyMs:number|null;topics:[string,number][];days:[string,number][];recent:{id:string;type:string;createdAt:string;topic:string|null;demo:boolean}[]};
export type WAState={status:string;qr:string|null;phone:string|null;accountName:string|null;error:string|null};
export type Settings={schoolName:string;academicYear:string;panitiaName:string;panitiaWa:string;geminiModel:string;embeddingModel:string;historyLimit:number;ragTopK:number;ragMinScore:number;demoMode:boolean;adminUsername:string};

