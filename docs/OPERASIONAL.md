# Operasional dan pemindahan laptop

## Persiapan laptop 16 GB

1. Pasang Node.js 22.12 atau lebih baru, PostgreSQL 18, dan Chrome atau Edge.
2. Salin source proyek atau ekstrak ZIP.
3. Jalankan setup-local.ps1 di laptop tersebut dengan konfigurasi database barunya.
4. Upload dokumen resmi dan isi Knowledge, atau pulihkan backup database.
5. Login admin, hubungkan WhatsApp melalui QR, dan uji dari nomor lain.
6. Jalankan build produksi untuk mengurangi proses development.

Instalasi dependency pertama membutuhkan internet. Setelah dependency dan PostgreSQL terpasang, fungsi lokal/simulator dapat berjalan tanpa internet. WhatsApp dan Gemini tetap memerlukan internet.

## Alternatif Docker dengan pgvector

Dari root proyek:
1. Salin `.env.example` ke `.env`.
2. Ganti POSTGRES_PASSWORD dengan password lokal Anda.
3. Jalankan:

```powershell
docker compose up -d postgres
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
```

Pada setup:
- Host `127.0.0.1`
- Port `5433`
- User `tivask`
- Database `tivask`
- Password sesuai POSTGRES_PASSWORD

Compose memakai image `pgvector/pgvector:pg18`, persistent volume, dan bind port ke loopback saja. Service PostgreSQL native port 1234 tidak perlu diubah. Pada laptop 8 GB, pilih satu instance database untuk demo.

`docker compose stop` menghentikan service tanpa menghapus volume. Jangan gunakan `down -v` jika ingin mempertahankan data.

## Backup

Hentikan server TIVAsk sebelum menyalin file runtime agar salinan konsisten.

Gunakan pgAdmin Backup atau pg_dump untuk database. Simpan juga:
- `backend/data/uploads` untuk file sumber dokumen.
- `backend/data/fallback` untuk data belum tersinkron dan riwayat cadangan.
- `backend/data/knowledge-cache.json` untuk Knowledge offline.
- `backend/.env` secara privat.
- `backend/.wwebjs_auth` secara privat jika memindahkan sesi; validitas sesi tetap perlu diperiksa pada laptop baru.

Jangan memasukkan bagian privat tersebut ke repository publik atau ZIP source yang dibagikan ke orang lain.

## Kesiapan demo

- Health endpoint benar-benar membaca database dan keberadaan schema.
- Status Gemini ONLINE berarti request generation terakhir sukses; cek metadata hanya REACHABLE.
- RAG READY berarti ada dokumen terindex; lihat indexMode pada Documents untuk membedakan vector/lexical.
- Tombol Hubungkan memulai browser. CONNECTED hanya setelah event ready dari WhatsApp.
- Jika tidak ada API key, jawaban structured dan pencarian teks lokal tetap dapat digunakan.
- Jika API quota habis, request AI memiliki timeout dan cooldown, lalu memakai fallback.
- Reset simulator di Settings membutuhkan teks konfirmasi dan hanya tersedia saat DEMO_MODE=true.
- Jangan menghapus session WhatsApp setiap restart. Gunakan Putuskan untuk mempertahankan autentikasi.

## File environment

| Field | Fungsi |
|---|---|
| DATABASE_URL | URL PostgreSQL termasuk user, password URL-encoded, port dan nama database |
| GEMINI_API_KEY | Key privat Google AI Studio |
| GEMINI_MODEL | Model generation |
| GEMINI_EMBEDDING_MODEL | Model embedding; perubahan memerlukan reindex |
| RAG_TOP_K | Batas potongan bukti untuk satu pertanyaan |
| RAG_MIN_SCORE | Minimum skor cosine untuk retrieval vector |
| CONVERSATION_HISTORY_LIMIT | Pesan terbaru untuk konteks backend |
| WA_AUTO_START | Default false; mulai gateway dari dashboard |
| WA_SESSION_PATH | Folder LocalAuth relatif terhadap backend |
| CHROME_EXECUTABLE_PATH | Kosong untuk deteksi Edge/Chrome pada lokasi umum Windows |
| PANITIA_NAME / PANITIA_WA | Kontak awal; dapat ditimpa pengaturan tersimpan di PostgreSQL |
| ADMIN_PASSWORD_HASH | Diisi otomatis setup, bukan password plaintext |
| SESSION_SECRET | Diisi otomatis setup |
| DEMO_MODE | Mengizinkan Knowledge berlabel demo dan reset simulator |
| HOST | Default 127.0.0.1, akses laptop yang sama |
| COOKIE_SECURE | false untuk HTTP localhost; true hanya bila server memakai HTTPS |

Mengaktifkan akses LAN/production memerlukan konfigurasi host, frontend origin, HTTPS, pengelolaan secret, dan kebijakan akses/retensi yang sesuai. Paket ini difokuskan untuk demo lokal.

## API utama

Semua endpoint selain health dan auth memerlukan cookie admin.

| Method | Path /api/v1 | Fungsi |
|---|---|---|
| GET | /health | Database, schema, readiness |
| POST | /auth/login | Login admin |
| POST | /auth/logout | Logout |
| GET | /auth/session | Status login |
| GET | /system/status | Seluruh status layanan |
| POST | /system/sync | Sinkronkan outbox |
| POST | /system/check-gemini | Periksa akses metadata model |
| POST | /chat | Simulator; senderId harus berawalan sim: |
| GET | /conversations/:senderId | Riwayat |
| GET | /whatsapp/status | Status dan QR |
| POST | /whatsapp/connect,reconnect,disconnect,logout | Aksi terpisah sesuai path |
| GET, POST | /knowledge | Daftar / buat entri |
| PUT, DELETE | /knowledge/:id | Edit / hapus |
| GET, POST | /documents | Daftar / upload multipart file |
| GET | /documents/:id | Detail dan chunks |
| GET | /documents/:id/download | Unduh sumber |
| PATCH | /documents/:id | Verifikasi |
| POST | /documents/:id/reindex | Index ulang |
| DELETE | /documents/:id | Hapus sumber/chunks |
| GET | /tickets | Filter status / priority |
| GET, PATCH | /tickets/:id | Detail / status / prioritas |
| POST | /tickets/:id/reply | Balas; sertakan UUID requestId |
| GET | /analytics?includeDemo=false | Analytics WhatsApp saja |
| GET, PUT | /settings | Pengaturan operasional |
| POST | /demo/reset | Hapus data simulator dengan konfirmasi |

