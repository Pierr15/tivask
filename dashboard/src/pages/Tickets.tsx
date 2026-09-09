import {useState} from 'react';
import {Search,ArrowUpRight,Send,Ticket as TicketIcon,MessageSquare,User,RefreshCw,Reply,X,UserCheck} from 'lucide-react';
import {useResource} from '../hooks/useResource';
import {api,send,type Ticket,type Message} from '../services/api';
import {Badge,ErrorBox,Empty,Loading,PageHead,date} from '../components/UI';

const statuses=['OPEN','ASSIGNED','IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED'];

export function TicketsPage(){
 const [status,setStatus]=useState('');
 const [priority,setPriority]=useState('');
 const [search,setSearch]=useState('');
 const r=useResource<Ticket[]>('/tickets?status='+status+'&priority='+priority,10000);
 const [selected,setSelected]=useState<{ticket:Ticket;messages:Message[]}|null>(null);
 const [replyTarget,setReplyTarget]=useState<Message|null>(null);
 const [text,setText]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');

 async function open(id:string){
  try{
   const detail=await api<{ticket:Ticket;messages:Message[]}>('/tickets/'+id);
   setSelected({...detail,ticket:{...detail.ticket,unreadCount:0}});
   setReplyTarget(null);setNotice('');
   await send('/tickets/'+id+'/read');
   await r.refresh();
  }catch(e){setError((e as Error).message);}
 }
 async function update(patch:Record<string,string|null>){
  if(!selected)return;
  try{await send('/tickets/'+selected.ticket.id,patch,'PATCH');await open(selected.ticket.id);await r.refresh();}
  catch(e){setError((e as Error).message);}
 }
 async function assign(){
  if(!selected)return;
  try{await send('/tickets/'+selected.ticket.id+'/assign');await open(selected.ticket.id);await r.refresh();setNotice('Tiket sudah di-assign ke admin yang sedang login.');}
  catch(e){setError((e as Error).message);}
 }

 const rows=(r.data??[]).filter(t=>(t.id+t.question+t.summary+t.whatsappNumber+(t.assignedTo??'')).toLowerCase().includes(search.toLowerCase()));
 const closed=selected?['RESOLVED','CLOSED'].includes(selected.ticket.status):false;

 return <>
  <PageHead eyebrow="HUMAN SUPPORT" title="Saatnya sentuhan manusia." description="Tindak lanjuti thread tiket, pilih pesan yang ingin dibalas, dan tetap biarkan TIVAsk menjawab topik lain.">
   <button className="btn" onClick={()=>void r.refresh()}><RefreshCw size={16}/>Refresh</button>
  </PageHead>
  <ErrorBox message={error||r.error}/>
  <div className={'ticket-layout '+(selected?'has-detail':'')}>
   <section className="panel ticket-list">
    <div className="toolbar">
     <div className="search-field"><Search size={17}/><input placeholder="Cari tiket…" aria-label="Cari tiket" value={search} onChange={e=>setSearch(e.target.value)}/></div>
     <select aria-label="Filter status tiket" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Semua status</option>{statuses.map(s=><option key={s}>{s}</option>)}</select>
     <select aria-label="Filter prioritas" value={priority} onChange={e=>setPriority(e.target.value)}><option value="">Semua prioritas</option>{['LOW','NORMAL','HIGH','URGENT'].map(s=><option key={s}>{s}</option>)}</select>
    </div>
    {r.loading?<Loading/>:rows.length?<div className="ticket-cards">{rows.map(t=><button key={t.id} className={'ticket-card '+(selected?.ticket.id===t.id?'selected':'')} onClick={()=>void open(t.id)}>
     <div><span className="ticket-number"><TicketIcon size={14}/>{t.id}</span><Badge value={t.status}/></div>
     <h3>{t.question}</h3>
     <p><User size={13}/>{t.name||t.whatsappNumber}<span>·</span>{t.priority}</p>
     <small>{date(t.lastUserMessageAt||t.createdAt)}{t.unreadCount>0&&<span style={{marginLeft:8,padding:'3px 7px',borderRadius:999,background:'#eaf3e8',color:'#2f7b5b',fontWeight:700}}>{t.unreadCount} NEW</span>}<ArrowUpRight size={15}/></small>
    </button>)}</div>:<Empty title="Tidak ada tiket">Pertanyaan yang membutuhkan panitia akan muncul di sini.</Empty>}
   </section>

   {selected?<section className="panel ticket-detail">
    <div className="panel-head"><div><div className="eyebrow">{selected.ticket.id}</div><h2>{selected.ticket.name||selected.ticket.whatsappNumber}</h2></div><button className="icon-btn" aria-label="Refresh percakapan" onClick={()=>void open(selected.ticket.id)}><RefreshCw size={17}/></button></div>
    <div className="ticket-controls">
     <label>Status<select value={selected.ticket.status} onChange={e=>void update({status:e.target.value})}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
     <label>Prioritas<select value={selected.ticket.priority} onChange={e=>void update({priority:e.target.value})}>{['LOW','NORMAL','HIGH','URGENT'].map(s=><option key={s}>{s}</option>)}</select></label>
     <button className="btn small" type="button" onClick={()=>void assign()}><UserCheck size={14}/>{selected.ticket.assignedTo?'Re-assign ke saya':'Assign ke saya'}</button>
    </div>
    <div className="ticket-summary">
     <strong>Ringkasan · {selected.ticket.summarySource==='LOCAL'?'kutipan pertanyaan':'AI'}</strong>
     <p>{selected.ticket.summary}</p>
     <small>Topik: {selected.ticket.topic||'Belum diklasifikasikan'} · Alasan: {selected.ticket.reason}</small>
     <small style={{display:'block',marginTop:5}}>Assigned: {selected.ticket.assignedTo||'Belum ada admin'}</small>
    </div>

    <div className="ticket-messages">{selected.messages.map(m=>{
     const quoted=m.replyToMessageId?selected.messages.find(q=>q.id===m.replyToMessageId):null;
     return <div key={m.id} className={'conversation-message '+(m.role==='USER'?'incoming':'outgoing')}>
      <span className="message-author">{m.role==='USER'?'Pengguna':m.role==='ADMIN'?'Panitia':'TIVAsk'}</span>
      {quoted&&<div style={{borderLeft:'3px solid #9bb8a7',padding:'6px 9px',margin:'6px 0 8px',background:'#f6f8f6',borderRadius:6,fontSize:11,color:'#687b70'}}>↩ {quoted.content.slice(0,160)}</div>}
      <p>{m.content}</p>
      <small>{new Date(m.createdAt).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})} · {m.delivery}</small>
      {m.role==='USER'&&<button type="button" className="icon-btn" style={{marginTop:6,gap:5,fontSize:11}} onClick={()=>setReplyTarget(m)}><Reply size={13}/>Reply</button>}
     </div>;
    })}</div>

    <form className="reply-form" onSubmit={async e=>{
     e.preventDefault();setBusy(true);setError('');setNotice('');
     try{
      const result=await send<{delivery:string}>('/tickets/'+selected.ticket.id+'/reply',{message:text,requestId:crypto.randomUUID(),replyToMessageId:replyTarget?.id??null});
      setText('');setReplyTarget(null);await open(selected.ticket.id);
      setNotice(result.delivery==='SIMULATED'?'Balasan simulator tersimpan. Tidak ada pesan WhatsApp yang dikirim.':'Balasan terkirim melalui WhatsApp.');await r.refresh();
     }catch(e){setError((e as Error).message);}finally{setBusy(false);}
    }}>
     {notice&&<div className="success-box">{notice}</div>}
     {replyTarget&&<div style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 12px',border:'1px solid #dce7df',borderRadius:8,background:'#f7faf8',fontSize:11,color:'#65776d'}}>
      <Reply size={14}/><div style={{flex:1}}><strong>Replying to</strong><div style={{marginTop:4}}>{replyTarget.content.slice(0,220)}</div></div><button type="button" className="icon-btn" aria-label="Batalkan reply" onClick={()=>setReplyTarget(null)}><X size={14}/></button>
     </div>}
     <textarea aria-label="Balasan admin" placeholder={replyTarget?'Tulis balasan untuk pesan yang dipilih…':'Tulis balasan panitia…'} value={text} onChange={e=>setText(e.target.value)} required maxLength={4000} disabled={closed}/>
     <div><span className="muted tiny">{selected.ticket.whatsappNumber.startsWith('sim:')?'SIMULATOR · Tidak mengirim WhatsApp':replyTarget?'Balasan akan dikirim sebagai quoted reply jika WhatsApp mendukungnya':'Balasan dikirim ke pengguna tiket ini'}</span><button className="btn primary" disabled={busy||!text.trim()||closed}><Send size={16}/>{busy?'Mengirim…':'Kirim balasan'}</button></div>
    </form>
   </section>:<section className="panel ticket-placeholder"><MessageSquare size={40}/><h2>Pilih percakapan</h2><p>Buka tiket untuk membaca thread dan membantu pengguna.</p></section>}
  </div>
 </>;
}
