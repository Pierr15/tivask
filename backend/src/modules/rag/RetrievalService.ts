import { prisma, db } from "../../core/prisma.js";
import { env } from "../../config/env.js";
import { EmbeddingService } from "./EmbeddingService.js";
import { VectorRepository } from "./VectorRepository.js";
import { terms } from "../ai/LocalSemanticEngine.js";
import { normalize } from "../ai/IntentRouter.js";
import type { Evidence } from "../ai/GroundingValidator.js";

const GENERIC_TERMS = new Set([
  "jurusan",
  "program",
  "keahlian",
  "sekolah",
  "spmb",
  "informasi",
  "pendaftaran",
  "murid",
  "siswa",
]);

function enrichQuery(question: string) {
  const q = normalize(question);
  const hints: string[] = [];

  if (
    /\b(apa itu|apa yang dimaksud|pengertian|definisi|penjelasan|jelaskan)\b/.test(
      q,
    )
  ) {
    hints.push("pengertian definisi adalah");
  }

  if (/\b(belajar apa|belajar|dipelajari|mempelajari|materi)\b/.test(q)) {
    hints.push("materi pelajaran kompetensi yang dipelajari");
  }

  if (/\b(kuota|daya tampung)\b/.test(q)) {
    hints.push("kuota daya tampung jumlah murid");
  }

  if (/\b(kerja|karier|karir|prospek|lulusan)\b/.test(q)) {
    hints.push("peluang kerja prospek lulusan karier");
  }

  if (/\b(buta warna|warna)\b/.test(q)) {
    hints.push("persyaratan tidak buta warna kesehatan");
  }

  if (!hints.length) {
    return question;
  }

  return `${question}\nKonteks pencarian: ${hints.join(" ")}`;
}

function lexicalScore(question: string, content: string) {
  const tokens = terms(question);

  if (!tokens.length) {
    return 0;
  }

  const normalizedContent = normalize(content);

  const specific = tokens.filter((token) => !GENERIC_TERMS.has(token));

  const important = specific.length ? specific : tokens;

  const importantHits = important.filter((token) =>
    normalizedContent.includes(token),
  ).length;

  const allHits = tokens.filter((token) =>
    normalizedContent.includes(token),
  ).length;

  const importantCoverage = importantHits / important.length;

  const overallCoverage = allHits / tokens.length;

  let score = importantCoverage * 0.75 + overallCoverage * 0.25;

  // Acronym / keyword spesifik seperti TJKT, DPIB, TPFL,
  // TKA, DTSEN, dll diberi bobot lebih kuat.
  if (
    important.some(
      (token) =>
        token.length >= 3 &&
        token.length <= 10 &&
        normalizedContent.includes(token),
    )
  ) {
    score += 0.08;
  }

  return Math.min(1, score);
}

export class RetrievalService {
  constructor(
    readonly embedding: EmbeddingService,
    readonly vectors: VectorRepository,
  ) {}

  async search(question: string): Promise<{
    evidence: Evidence[];
    mode: string;
  }> {
    const candidateLimit = Math.min(30, Math.max(env.RAG_TOP_K * 3, 12));

    let vectorEvidence: Evidence[] = [];

    /*
     * VECTOR SEARCH
     */
    if (this.embedding.available()) {
      try {
        const query = enrichQuery(question);

        const vector = await this.embedding.embed(query, true);

        vectorEvidence = await this.vectors.search(
          vector,
          this.embedding.model,
          candidateLimit,
        );
      } catch {
        vectorEvidence = [];
      }
    }

    /*
     * LEXICAL SEARCH
     */
    let lexicalEvidence: Evidence[] = [];

    try {
      const chunks = await db(() =>
        prisma.documentChunk.findMany({
          where: {
            document: {
              verified: true,
              status: "INDEXED",
              ...(env.DEMO_MODE ? {} : { demo: false }),
            },
          },
          include: {
            document: {
              select: {
                demo: true,
              },
            },
          },
          take: 2000,
          orderBy: {
            createdAt: "desc",
          },
        }),
      );

      lexicalEvidence = chunks
        .map((chunk) => ({
          id: chunk.id,
          text: chunk.text,
          source: chunk.filename,
          page: chunk.page,
          demo: chunk.document.demo,
          score: lexicalScore(question, chunk.text),
        }))
        .filter((item) => item.score >= 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, candidateLimit);
    } catch {
      lexicalEvidence = [];
    }

    /*
     * HYBRID MERGE
     */
    const results = new Map<
      string,
      {
        evidence: Evidence;
        vectorScore: number;
        lexicalScore: number;
      }
    >();

    for (const evidence of vectorEvidence) {
      results.set(evidence.id, {
        evidence,
        vectorScore: evidence.score,
        lexicalScore: 0,
      });
    }

    for (const evidence of lexicalEvidence) {
      const existing = results.get(evidence.id);

      if (existing) {
        existing.lexicalScore = evidence.score;
      } else {
        results.set(evidence.id, {
          evidence,
          vectorScore: 0,
          lexicalScore: evidence.score,
        });
      }
    }

    const ranked = [...results.values()]
      .filter(
        ({ vectorScore, lexicalScore }) =>
          vectorScore >= env.RAG_MIN_SCORE || lexicalScore >= 0.5,
      )
      .map(({ evidence, vectorScore, lexicalScore }) => {
        /*
         * Keyword kuat tidak boleh kalah hanya karena
         * vector similarity sedikit lebih rendah.
         */
        let score = Math.max(vectorScore, lexicalScore * 0.92);

        // Bonus ketika semantic + lexical sama-sama cocok.
        if (vectorScore > 0 && lexicalScore > 0) {
          score += Math.min(vectorScore, lexicalScore) * 0.08;
        }

        return {
          ...evidence,
          score: Math.min(score, 1),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, env.RAG_TOP_K);

    if (ranked.length) {
      return {
        evidence: ranked,
        mode:
          vectorEvidence.length && lexicalEvidence.length
            ? `HYBRID_${this.vectors.mode}`
            : vectorEvidence.length
              ? this.vectors.mode
              : "LEXICAL",
      };
    }

    return {
      evidence: [],
      mode: "UNAVAILABLE",
    };
  }
}
