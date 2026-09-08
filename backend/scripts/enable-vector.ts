import { prisma } from '../src/core/prisma.js';
try{
 await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
 await prisma.$executeRawUnsafe('ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS vector vector(768)');
 await prisma.$executeRawUnsafe('UPDATE "DocumentChunk" SET vector = embedding::text::vector WHERE embedding IS NOT NULL AND jsonb_typeof(embedding) = \'array\' AND jsonb_array_length(embedding) = 768');
 await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS document_chunk_vector_hnsw ON "DocumentChunk" USING hnsw (vector vector_cosine_ops)');
 console.info('pgvector aktif. Vector 768 dimensi dan index HNSW siap.');
}catch{
 console.warn('pgvector belum bisa diaktifkan. Install extension untuk PostgreSQL 18 atau gunakan Docker Compose. Prototipe tetap memakai PostgreSQL: JSON embedding + cosine / pencarian teks.');
}finally{await prisma.$disconnect();}

