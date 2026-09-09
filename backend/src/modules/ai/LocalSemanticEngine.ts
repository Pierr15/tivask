import { normalize, type Intent } from "./IntentRouter.js";
import { labels, type KnowledgeItem } from "../knowledge/types.js";
const stop = new Set(
  "apa apakah berapa bagaimana kapan di ke dari dan atau yang untuk dengan saya kami anda kalau kalo boleh bisa ingin tanya tahu informasi tentang ada itu nya sih ya dong tolong jelaskan mengenai jadi lebih minta masih saat pada ketika berapakah apa saja perempuan laki laki pria wanita penjelasan pengertian definisi maksud artinya jelasin uraikan".split(
    " ",
  ),
);
export function terms(s: string) {
  return [
    ...new Set(
      normalize(s)
        .split(" ")
        .filter((t) => t.length > 2 && !stop.has(t)),
    ),
  ];
}
export const MENU =
  "Halo! Saya *TIVAsk*, asisten informasi SPMB. Silakan pilih:\n\n1. Jurusan & Kuota\n2. Syarat Berkas & Dokumen\n3. Rincian Biaya\n4. Jadwal & Alur SPMB\n5. Bantuan Panitia\n\nKetik nomor menu atau tulis pertanyaan Anda.";
export class LocalSemanticEngine {
  select(intent: Intent, items: KnowledgeItem[]): KnowledgeItem[] {
    let candidates = items.filter(
      (i) => !intent.category || i.category === intent.category,
    );
    const q = normalize(intent.query);
    const gender = /\b(perempuan|wanita|putri)\b/.test(q)
      ? "PEREMPUAN"
      : /\b(laki laki|pria|putra)\b/.test(q)
        ? "LAKI_LAKI"
        : null;
    if (gender)
      candidates = candidates.filter(
        (i) =>
          i.details.gender === gender ||
          i.details.gender === "SEMUA" ||
          (gender === "PEREMPUAN"
            ? /\b(perempuan|wanita|putri)\b/
            : /\b(laki laki|pria|putra)\b/
          ).test(normalize(i.title + " " + i.content)),
      );
    if (intent.menu && intent.category) return candidates.slice(0, 10);
    const generic = new Set(
      "biaya harga bayar jurusan kuota syarat persyaratan berkas dokumen jadwal tanggal alur jalur profil sekolah rincian pendaftaran spmb kontak program unggulan".split(
        " ",
      ),
    );
    const specific = terms(q).filter(
      (t) =>
        !generic.has(t) || (intent.category === "COST" && t === "pendaftaran"),
    );
    // A specific question must match all its meaningful qualifiers; otherwise retrieve documents or escalate.
    if (specific.length)
      candidates = candidates.filter((i) =>
        specific.every((t) =>
          normalize(
            i.title + " " + i.content + " " + i.keywords.join(" "),
          ).includes(t),
        ),
      );
    else if (!intent.category)
      candidates = candidates.filter(
        (i) =>
          i.keywords.some((k) => normalize(k) === q) ||
          normalize(i.title) === q,
      );
    return candidates.slice(0, 6);
  }
  answer(items: KnowledgeItem[]) {
    return items
      .map(
        (i) =>
          (i.demo ? "[DATA DEMO]\n" : "") +
          "*" +
          labels[i.category] +
          " — " +
          i.title +
          "*\n" +
          i.content,
      )
      .join("\n\n");
  }
}
