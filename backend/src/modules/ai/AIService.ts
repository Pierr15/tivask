import { env } from "../../config/env.js";
import { IntentRouter } from "./IntentRouter.js";
import { LocalSemanticEngine, MENU, terms } from "./LocalSemanticEngine.js";
import { GroundingValidator } from "./GroundingValidator.js";
import type { GeminiProvider } from "./GeminiProvider.js";
import type { RetrievalService } from "../rag/RetrievalService.js";
import type { StructuredKnowledgeService } from "../knowledge/StructuredKnowledgeService.js";
import type { MessageRow } from "../conversation/Persistence.js";
export type Answer = {
  text: string;
  route: string;
  topic: string | null;
  escalate: boolean;
  sources: string[];
};
export class AIService {
  private router = new IntentRouter();
  private local = new LocalSemanticEngine();
  private grounding = new GroundingValidator();
  constructor(
    private knowledge: StructuredKnowledgeService,
    private retrieval: RetrievalService,
    private gemini: GeminiProvider,
  ) {}
  async answer(question: string, history: MessageRow[]): Promise<Answer> {
    const intent = this.router.route(question, history);
    const base = {
      topic: intent.category,
      sources: [] as string[],
      escalate: false,
    };
    if (intent.escalate)
      return {
        ...base,
        text: "Pertanyaan Anda akan diteruskan ke panitia.",
        route: "ESCALATION",
        escalate: true,
      };
    if (intent.greeting || (intent.menu && !intent.category))
      return { ...base, text: MENU, route: "LOCAL" };
    const items = await this.knowledge.evidence();
    const direct = this.local.select(intent, items);
    if (direct.length)
      return {
        ...base,
        text: this.local.answer(direct),
        route:
          this.knowledge.source === "POSTGRESQL" ? "STRUCTURED" : "FALLBACK",
        sources: direct.map((i) => i.title),
      };
    const retrieved = await this.retrieval.search(intent.query);
    if (retrieved.evidence.length) {
      if (this.gemini.available()) {
        try {
          const raw = await this.gemini.select(
            intent.query,
            retrieved.evidence,
            history,
          );
          const quotes = this.grounding.validate(raw, retrieved.evidence);
          if (quotes?.length)
            return {
              ...base,
              route: "RAG",
              sources: quotes.map((q) => q.source),
              text:
                "Berikut informasi dari dokumen yang tersedia:\n\n" +
                quotes
                  .map(
                    (q) =>
                      (q.demo ? "[DATA DEMO]\n" : "") +
                      q.quote +
                      "\n(Sumber: " +
                      q.source +
                      (q.page ? ", hlm. " + q.page : "") +
                      ")",
                  )
                  .join("\n\n"),
            };
        } catch {}
      }
      const required = terms(intent.query);

      const relationWords = new Set([
        "belajar",
        "pelajari",
        "dipelajari",
        "mempelajari",
        "jelaskan",
        "penjelasan",
        "pengertian",
        "definisi",
      ]);

      const important = required.filter((token) => !relationWords.has(token));

      const wanted = important.length ? important : required;

      const female = /perempuan|wanita|putri/i.test(question);

      const male = /laki.laki|pria|putra/i.test(question);

      for (const evidence of retrieved.evidence) {
        const passages = evidence.text
          .split(/\n\s*\n|(?<=[.!?])\s+/)
          .map((passage) => passage.trim())
          .filter((passage) => passage.length > 20 && passage.length <= 1800);

        const candidates = passages
          .filter(
            (passage) =>
              (!female || /perempuan|wanita|putri/i.test(passage)) &&
              (!male || /laki.laki|pria|putra/i.test(passage)),
          )
          .map((passage) => {
            const normalized = passage.toLowerCase();

            const matched = wanted.filter((token) =>
              normalized.includes(token),
            ).length;

            return {
              passage,
              coverage: wanted.length ? matched / wanted.length : 0,
            };
          })
          .sort((a, b) => b.coverage - a.coverage);

        const best = candidates[0];

        if (best && (wanted.length === 0 || best.coverage >= 0.5)) {
          return {
            ...base,
            route: "FALLBACK",
            sources: [evidence.source],
            text:
              (evidence.demo ? "[DATA DEMO]\n" : "") +
              "Kutipan dokumen:\n\n" +
              best.passage +
              "\n\nSumber: " +
              evidence.source +
              (evidence.page ? ` (hlm. ${evidence.page})` : ""),
          };
        }
      }
    }
    return {
      ...base,
      text: "Aku belum menemukan informasi resmi yang cukup untuk menjawab pertanyaan itu. Coba tuliskan pertanyaannya lebih spesifik. Jika kasusnya perlu ditangani petugas, ketik *admin* untuk meneruskannya ke panitia.",
      route: "CLARIFY",
      escalate: false,
    };
  }
}
