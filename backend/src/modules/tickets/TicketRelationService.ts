import { normalize } from '../ai/IntentRouter.js';
import type { TicketMessageRow, TicketRow } from '../conversation/Persistence.js';

export type TicketRelation = 'RELATED' | 'UNCERTAIN' | 'UNRELATED';
export type TicketRelationResult = {
  relation: TicketRelation;
  score: number;
  reason: string;
};

const stopWords = new Set([
  'aku','saya','kami','kamu','anda','yang','dan','atau','di','ke','dari','untuk','pada','itu','ini','nya',
  'apa','apakah','bagaimana','gimana','kalau','kalo','terus','lalu','masih','sudah','udah','mau','ingin','bisa',
  'dong','min','admin','panitia','tolong','ya','iya','tidak','nggak','enggak','gak','ga','jadi','dengan','tentang',
]);

const topicRules: Array<[string, RegExp]> = [
  ['COST', /\b(biaya|bayar|harga|seragam|spp|uang|gratis)\b/],
  ['DEPARTMENT', /\b(jurusan|kuota|konsentrasi|keahlian)\b/],
  ['REQUIREMENT', /\b(syarat|persyaratan|berkas|dokumen|nisn|nik|kk|akta)\b/],
  ['SCHEDULE', /\b(jadwal|kapan|tanggal|gelombang|tahapan|waktu)\b/],
  ['PATH', /\b(jalur|zonasi|afirmasi|prestasi|domisili)\b/],
  ['CONTACT', /\b(kontak|telepon|alamat|lokasi)\b/],
  ['PROGRAM', /\b(program|unggulan|ekskul|ekstrakurikuler)\b/],
  ['SCHOOL', /\b(profil|sejarah|visi|misi|sekolah)\b/],
];

function topicOf(text: string): string | null {
  const q = normalize(text);
  return topicRules.find(([, rule]) => rule.test(q))?.[0] ?? null;
}

function tokens(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(' ')
      .filter((token) => token.length >= 3 && !stopWords.has(token)),
  );
}

function overlapScore(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / Math.max(1, Math.min(a.size, 6));
}

export class TicketRelationService {
  classify(ticket: TicketRow, message: string, recentMessages: TicketMessageRow[] = []): TicketRelationResult {
    const q = normalize(message);
    if (!q) return { relation: 'UNRELATED', score: 0, reason: 'Pesan kosong.' };

    if (q.includes(ticket.id.toLowerCase())) {
      return { relation: 'RELATED', score: 1, reason: 'Nomor tiket disebut langsung.' };
    }

    const context = [
      ticket.topic ?? '',
      ticket.question,
      ticket.summary,
      ...recentMessages.slice(-6).map((item) => item.content),
    ].join(' ');
    const messageTokens = tokens(message);
    const contextTokens = tokens(context);
    let score = overlapScore(messageTokens, contextTokens);

    const messageTopic = topicOf(message);
    const ticketTopic = ticket.topic ?? topicOf(ticket.question + ' ' + ticket.summary);
    if (messageTopic && ticketTopic) {
      score += messageTopic === ticketTopic ? 0.38 : -0.32;
    }

    if (ticket.status === 'WAITING_USER') score += 0.18;
    if (/^(kalau|kalo|terus|lalu|tadi|masih|sudah|udah|setelah|kemudian|yang tadi|itu)\b/.test(q)) score += 0.18;
    if (/\b(pertanyaan lain|topik lain|ngomong ngomong|btw|beda topik)\b/.test(q)) score -= 0.28;

    score = Math.max(0, Math.min(1, score));
    if (score >= 0.56) return { relation: 'RELATED', score, reason: 'Konteks pesan cukup dekat dengan tiket aktif.' };
    if (score >= 0.28) return { relation: 'UNCERTAIN', score, reason: 'Ada kemiripan konteks, tetapi belum cukup pasti.' };
    return { relation: 'UNRELATED', score, reason: 'Topik pesan berbeda dari tiket aktif.' };
  }
}
