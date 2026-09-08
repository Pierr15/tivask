import type { Category } from '../knowledge/types.js';
import type { MessageRow } from '../conversation/Persistence.js';
export const normalize=(s:string)=>s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
const rules:Array<[Category,RegExp]>=[
 ['COST',/\b(biaya|bayar|harga|seragam|spp|uang|gratis)\b/],
 ['DEPARTMENT',/\b(jurusan|kuota|konsentrasi|keahlian)\b/],
 ['REQUIREMENT',/\b(syarat|persyaratan|berkas|dokumen)\b/],
 ['SCHEDULE',/\b(jadwal|kapan|tanggal|alur|tahapan)\b/],
 ['PATH',/\b(jalur|zonasi|afirmasi|prestasi|domisili)\b/],
 ['CONTACT',/\b(kontak|telepon|alamat|lokasi)\b/],
 ['PROGRAM',/\b(program|unggulan|ekskul|ekstrakurikuler)\b/],
 ['SCHOOL',/\b(profil|sejarah|visi|misi|sekolah)\b/]
];
export type Intent={category:Category|null;escalate:boolean;menu:boolean;query:string;followup:boolean;greeting:boolean};
export class IntentRouter{
 route(question:string,history:MessageRow[]):Intent{
 const q=normalize(question);const numeric=q.match(/^(?:(?:nomor|menu|opsi)\s*)?([1-5])$/);
 const escalate=!!q.match(/\b(admin|panitia|petugas|manusia|dispensasi|mutasi|nilai saya|kasus pribadi|masalah administrasi)\b/)||numeric?.[1]==='5';
 const followup=/^(kalau|kalo|bagaimana dengan|bagaimana kalau|yang|untuk perempuan|untuk laki|itu|terus|lalu)\b/.test(q);
 const prior=[...history].reverse().find(m=>m.role==='USER'&&m.topic);
 const category=numeric?({1:'DEPARTMENT',2:'REQUIREMENT',3:'COST',4:'SCHEDULE'} as Record<string,Category>)[numeric[1]]??null:rules.find(([,r])=>r.test(q))?.[0]??(followup?prior?.topic as Category??null:null);
 const anchor=[...history].reverse().find(m=>m.role==='USER'&&m.topic===category&&!/^(kalau|kalo|bagaimana dengan|bagaimana kalau|yang|untuk perempuan|untuk laki|itu|terus|lalu)\b/.test(normalize(m.content)))??prior;
 const newGender=/\b(perempuan|wanita|putri|laki laki|pria|putra)\b/.test(q);
 const anchorText=newGender?anchor?.content.replace(/perempuan|wanita|putri|laki[ -]laki|pria|putra/gi,''):anchor?.content;
 const inherited=followup&&anchorText?anchorText+' '+question:question;
 return {category,escalate,menu:!!numeric||/^(menu|bantuan|help|mulai)$/.test(q),query:inherited,followup,greeting:/^(halo|hai|hi|assalamualaikum|selamat (pagi|siang|sore|malam))$/.test(q)};
 }
}
