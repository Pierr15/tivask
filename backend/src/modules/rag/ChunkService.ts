export type TextPage = {
  page: number | null;
  text: string;
};

type Chunk = {
  text: string;
  page: number | null;
  chunkIndex: number;
  tokenCount: number;
};

const HEADING_PREFIX =
  /^(bab|bagian|tahap|jurusan|program|jalur|dokumen|informasi|prosedur|kontak|visi|misi|biaya|sertifikasi|nilai|tes|alur|profil|kerja sama)\b/i;

function cleanText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isHeading(text: string) {
  const value = text.trim();

  if (value.length < 3 || value.length > 140) {
    return false;
  }

  if (HEADING_PREFIX.test(value)) {
    return true;
  }

  const letters = value.replace(/[^\p{L}]/gu, "");

  if (letters.length < 4) {
    return false;
  }

  const uppercase = [...letters].filter(
    (char) => char === char.toUpperCase(),
  ).length;

  return uppercase / letters.length >= 0.85;
}

function splitLongBlock(text: string, maxLength: number) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    const pieces: string[] = [];

    for (let start = 0; start < text.length; start += maxLength) {
      let end = Math.min(start + maxLength, text.length);

      if (end < text.length) {
        const space = text.lastIndexOf(" ", end);

        if (space > start + maxLength * 0.6) {
          end = space;
        }
      }

      pieces.push(text.slice(start, end).trim());
      start = end - maxLength;
    }

    return pieces.filter(Boolean);
  }

  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > maxLength) {
      pieces.push(current.trim());
      current = "";
    }

    current += `${current ? " " : ""}${sentence}`;
  }

  if (current.trim()) {
    pieces.push(current.trim());
  }

  return pieces;
}

export class ChunkService {
  split(pages: TextPage[], size = 1400, overlapBlocks = 1): Chunk[] {
    const chunks: Chunk[] = [];

    const addChunk = (text: string, page: number | null) => {
      const cleaned = text.trim();

      if (cleaned.length <= 12) {
        return;
      }

      chunks.push({
        text: cleaned,
        page,
        chunkIndex: chunks.length,
        tokenCount: Math.ceil(cleaned.length / 3.5),
      });
    };

    for (const page of pages) {
      const text = cleanText(page.text);

      if (!text) {
        continue;
      }

      const rawBlocks = text
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter(Boolean);

      let heading = "";
      let currentBlocks: string[] = [];

      const flush = (keepOverlap = true) => {
        if (!currentBlocks.length) {
          return;
        }

        const body = currentBlocks.join("\n\n").trim();

        addChunk(heading ? `${heading}\n\n${body}` : body, page.page);

        currentBlocks = keepOverlap ? currentBlocks.slice(-overlapBlocks) : [];
      };

      for (const rawBlock of rawBlocks) {
        const lines = rawBlock
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        if (!lines.length) {
          continue;
        }

        // Heading berada sendiri dalam satu block.
        if (lines.length === 1 && isHeading(lines[0])) {
          flush(false);
          heading = lines[0];
          continue;
        }

        // Heading + isi berada dalam block yang sama.
        let block = rawBlock;

        if (lines.length > 1 && isHeading(lines[0])) {
          flush(false);
          heading = lines[0];
          block = lines.slice(1).join("\n").trim();

          if (!block) {
            continue;
          }
        }

        const prefixLength = heading ? heading.length + 2 : 0;

        const maxBodyLength = Math.max(500, size - prefixLength);

        if (block.length > maxBodyLength) {
          flush(false);

          const pieces = splitLongBlock(block, maxBodyLength);

          for (const piece of pieces) {
            addChunk(heading ? `${heading}\n\n${piece}` : piece, page.page);
          }

          continue;
        }

        const candidate = [...currentBlocks, block].join("\n\n");

        if (currentBlocks.length && candidate.length + prefixLength > size) {
          flush(true);
        }

        currentBlocks.push(block);
      }

      flush(false);
    }

    return chunks;
  }
}
