import { normalize } from './IntentRouter.js';

const stop=new Set('apa apakah berapa bagaimana kapan di ke dari dan atau yang untuk dengan saya kami anda kalau kalo boleh bisa ingin tanya tahu informasi tentang ada itu nya sih ya dong tolong jelaskan mengenai jadi lebih minta masih saat pada ketika berapakah apa saja perempuan laki laki pria wanita putra putri'.split(' '));

// Kata-kata kategori ini membantu routing, tetapi tidak cukup spesifik untuk membuktikan
// bahwa sebuah evidence menjawab subjek yang sama. Contoh: "biaya" tidak boleh membuat
// chunk biaya pendaftaran dianggap cocok untuk pertanyaan biaya seragam.
const generic=new Set('biaya harga bayar uang rincian jurusan kuota konsentrasi keahlian syarat persyaratan berkas dokumen jadwal tanggal alur tahapan jalur kontak telepon nomor alamat lokasi program unggulan profil sejarah visi misi sekolah panitia spmb'.split(' '));

const female=/\b(perempuan|wanita|putri)\b/i;
const male=/\b(laki[ -]?laki|pria|putra)\b/i;

export type RequestedGender='PEREMPUAN'|'LAKI_LAKI'|null;

export function terms(s:string){
 return [...new Set(normalize(s).split(' ').filter(t=>t.length>2&&!stop.has(t)))];
}

export function requestedGender(s:string):RequestedGender{
 const q=normalize(s);
 if(female.test(q))return 'PEREMPUAN';
 if(male.test(q))return 'LAKI_LAKI';
 return null;
}

export function genderMatches(query:string,text:string){
 const gender=requestedGender(query);
 if(!gender)return true;
 const normalized=normalize(text);
 return gender==='PEREMPUAN'?female.test(normalized):male.test(normalized);
}

export function specificTerms(query:string){
 return terms(query).filter(t=>!generic.has(t));
}

function ratio(values:string[],predicate:(value:string)=>boolean){
 if(!values.length)return 0;
 return values.filter(predicate).length/values.length;
}

export function lexicalScore(query:string,text:string){
 if(!genderMatches(query,text))return 0;
 const qTerms=terms(query);
 if(!qTerms.length)return 0;
 const haystack=normalize(text);
 const coverage=ratio(qTerms,t=>haystack.includes(t));
 const specific=specificTerms(query);
 const specificCoverage=specific.length?ratio(specific,t=>haystack.includes(t)):coverage;
 const bigrams=qTerms.slice(0,-1).map((t,i)=>t+' '+qTerms[i+1]);
 const bigramCoverage=bigrams.length?ratio(bigrams,b=>haystack.includes(b)):coverage;
 let base:number;
 if(specific.length)base=.35*coverage+.5*specificCoverage+.15*bigramCoverage;
 else base=.75*coverage+.25*bigramCoverage;
 const genderBonus=requestedGender(query)?0.05:0;
 return Math.max(0,Math.min(1,base+genderBonus));
}

// Dipakai pada tahap grounding. Evidence harus menyebut gender yang diminta dan
// mayoritas qualifier spesifik (seragam, pendaftaran, afirmasi, TJKT, dst.).
export function supportsQuery(query:string,text:string){
 if(!genderMatches(query,text))return false;
 const specific=specificTerms(query);
 if(!specific.length)return true;
 const haystack=normalize(text);
 return ratio(specific,t=>haystack.includes(t))>=.6;
}
