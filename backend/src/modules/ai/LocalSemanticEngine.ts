import { normalize,type Intent } from './IntentRouter.js';
import { lexicalScore,supportsQuery,terms } from './QuerySignals.js';
import { labels,type KnowledgeItem } from '../knowledge/types.js';
export { terms } from './QuerySignals.js';

export const MENU='Halo! Saya *TIVAsk*, asisten informasi SPMB. Silakan pilih:\n\n1. Jurusan & Kuota\n2. Syarat Berkas & Dokumen\n3. Rincian Biaya\n4. Jadwal & Alur SPMB\n5. Bantuan Panitia\n\nKetik nomor menu atau tulis pertanyaan Anda.';

export class LocalSemanticEngine{
 select(intent:Intent,items:KnowledgeItem[]):KnowledgeItem[]{
 let candidates=items.filter(i=>!intent.category||i.category===intent.category);
 const q=normalize(intent.query);
 const gender=/\b(perempuan|wanita|putri)\b/.test(q)?'PEREMPUAN':/\b(laki laki|pria|putra)\b/.test(q)?'LAKI_LAKI':null;
 if(gender)candidates=candidates.filter(i=>i.details.gender===gender||i.details.gender==='SEMUA'||(gender==='PEREMPUAN'?/\b(perempuan|wanita|putri)\b/:/\b(laki laki|pria|putra)\b/).test(normalize(i.title+' '+i.content)));
 if(intent.menu&&intent.category)return candidates.slice(0,10);
 const generic=new Set('biaya harga bayar jurusan kuota syarat persyaratan berkas dokumen jadwal tanggal alur jalur profil sekolah rincian pendaftaran spmb kontak program unggulan'.split(' '));
 const specific=terms(q).filter(t=>!generic.has(t)||(intent.category==='COST'&&t==='pendaftaran'));
 // Pertanyaan spesifik wajib cocok dengan qualifier pentingnya. Jika tidak, lanjutkan ke FAQ/RAG.
 if(specific.length)candidates=candidates.filter(i=>specific.every(t=>normalize(i.title+' '+i.content+' '+i.keywords.join(' ')).includes(t)));
 else if(!intent.category)candidates=candidates.filter(i=>i.keywords.some(k=>normalize(k)===q)||normalize(i.title)===q);
 return candidates.slice(0,6);
 }

 selectFaq(intent:Intent,items:KnowledgeItem[]):KnowledgeItem[]{
 const scored=items.filter(i=>i.category==='FAQ').map(item=>{
 const haystack=[item.details.question??'',item.title,item.content,...item.keywords].join(' ');
 return {item,score:lexicalScore(intent.query,haystack),supported:supportsQuery(intent.query,haystack)};
 }).filter(x=>x.supported&&x.score>=.72).sort((a,b)=>b.score-a.score);
 return scored.slice(0,3).map(x=>x.item);
 }

 answer(items:KnowledgeItem[]){return items.map(i=>(i.demo?'[DATA DEMO]\n':'')+'*'+(labels[i.category])+' — '+i.title+'*\n'+i.content).join('\n\n');}
}
