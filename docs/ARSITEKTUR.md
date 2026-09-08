# Arsitektur TIVAsk

## Alur aplikasi

```text
WhatsApp (whatsapp-web.js + LocalAuth)          Dashboard / Chat Playground
           |                                            |
           |                                    Session admin + API
           +-------------------+------------------------+
                               |
                      ConversationService
                sender ID + antrean + riwayat otomatis
                               |
                          IntentRouter
                               |
              +----------------+-------------------+
              |                |                   |
        Menu / salam      Structured Knowledge    Dokumen / RAG
              |                |                   |
         Local engine     PostgreSQL + cache       Extraction
              |                |                   Chunking
              |                |                   Embedding
              |                |                   Retrieval
              |                |                      |
              |                |               Gemini (bila perlu)
              |                |                      |
              |                |               GroundingValidator
              +----------------+----------------------+
                               |
                     Bukti cukup untuk menjawab?
                        |                 |
                       Ya               Tidak
                        |                 |
                  Jawaban singkat   TicketService
                        |           nomor tiket + kontak
                        +-----------------+
                               |
                 Memory + Analytics + Formatter
                               |
                    WhatsApp / Chat Playground

Admin membuka tiket → membaca riwayat → mengirim balasan → WhatsApp.send
                     → delivery SENT / UNCERTAIN / SIMULATED
```

## Struktur folder

```text
tivask/
├─ backend/
│  ├─ prisma/schema.prisma
│  ├─ prisma/migrations/202609080001_tivask_initial/migration.sql
│  ├─ prisma/seed.ts
│  ├─ scripts/enable-vector.ts
│  ├─ data/defaultKnowledge.json
│  ├─ data/fallback/              # runtime, tidak didistribusikan
│  ├─ data/uploads/               # runtime, tidak didistribusikan
│  ├─ src/config/
│  ├─ src/core/                   # Prisma, journal atomik, antrean, logging
│  ├─ src/middleware/auth.ts
│  ├─ src/modules/
│  │  ├─ ai/
│  │  ├─ knowledge/
│  │  ├─ conversation/
│  │  ├─ rag/
│  │  ├─ tickets/
│  │  ├─ whatsapp/
│  │  └─ analytics/
│  ├─ src/routes/index.ts
│  ├─ src/container.ts
│  ├─ src/app.ts
│  ├─ src/server.ts
│  └─ test/core.test.ts
├─ dashboard/src/
│  ├─ components/
│  ├─ hooks/
│  ├─ pages/
│  ├─ services/
│  ├─ App.tsx
│  └─ styles.css
├─ scripts/setup-local.ps1
├─ scripts/setup.mjs
├─ docker-compose.yml
├─ package-lock.json
└─ README.md
```

## Skema database

- **KnowledgeEntity** menjadi sumber teks jawaban kanonik untuk seluruh kategori, dengan `verified`, `demo`, kata kunci dan detail bertipe tervalidasi.
- **SchoolInfo, Department, AdmissionPath, Requirement, AdmissionSchedule, CostInfo, FAQ** adalah tabel detail bertipe dengan relasi satu-ke-satu ke KnowledgeEntity. Satu transaksi menjaga perubahan kategori/detail.
- **Document → DocumentChunk**: dokumen, status index, sumber, halaman, nomor chunk, tokenCount perkiraan, JSON embedding dan model embedding. Kolom pgvector opsional ditambahkan dengan SQL terpisah.
- **Conversation → Message**: sender unik, channel WHATSAPP/SIMULATOR, role USER/ASSISTANT/ADMIN, jalur jawaban, topik, delivery dan external ID.
- **Conversation → Ticket**: identitas pengirim, pertanyaan, ringkasan, alasan, prioritas, status dan timestamp penyelesaian.
- **AnalyticsEvent**: event nyata, channel, flag simulator, topik, latency dan timestamp. Tidak ada seed angka runtime.
- **SystemSetting**: kontak panitia dan tempat konfigurasi operasional yang bisa diperluas.
- **DeliveryReceipt** disiapkan dalam schema untuk migrasi deduplikasi ke database; prototipe memakai journal lokal agar deduplikasi tetap berjalan saat PostgreSQL mati.

Index tersedia untuk sender, conversation/time, status/prioritas tiket, documentId, dan category/verifikasi Knowledge.

## Keputusan untuk prototipe lokal

- Satu backend Node dan satu proses Chromium untuk satu akun WhatsApp. Index dokumen diantrikan satu per satu agar penggunaan RAM terkendali.
- TypeScript strict, Prisma 6.19 dan PostgreSQL 18. Versi dependency dikunci pada lockfile.
- Model Gemini configurable. Panggilan menu/structured tidak membutuhkan Gemini.
- PostgreSQL native tetap dapat dipakai tanpa pgvector. Penyimpanan embedding JSON + cosine adalah cadangan di database yang sama, bukan JSON file sebagai database utama.
- `VectorRepository` mengisolasi retrieval. Adapter vector lain dapat menggantikannya tanpa mengubah gateway WhatsApp.
- Untuk menghindari angka/kebijakan hasil karangan model, output Gemini berupa seleksi kutipan yang dicek against evidence. Gaya ini sengaja lebih ketat daripada ringkasan bebas.
- Tiket memakai ringkasan lokal berupa kutipan pertanyaan (`summarySource=LOCAL`), sehingga tetap dibuat saat Gemini gagal. Label dashboard menyatakan sumber ringkasannya.
- File JSON fallback ditulis atomik melalui temporary file + rename. Operasi per file diantrikan untuk mencegah lost update. Format rusak gagal secara jelas; tidak diam-diam ditimpa.
- ID percakapan deterministik dan ID message/ticket/event stabil memungkinkan sinkronisasi idempotent.
- Riwayat terbaru tetap tersedia pada journal untuk pemulihan saat database mati. Setelah sinkronisasi, journal hanya mempertahankan 30 pesan terbaru per percakapan; PostgreSQL menyimpan riwayat lengkap.
- Tidak ada nomor atau password default produksi. Setup meminta password administrator baru.

