# TIVAsk — Control Center

Prototipe WhatsApp SPMB untuk **SMK Negeri 1 Adiwerna · 2026/2027**.
Satu proyek lengkap: Node.js 22 + TypeScript + Express + Prisma + PostgreSQL, React + Vite, whatsapp-web.js, Gemini, pencarian dokumen dan tiket panitia.

> Mulai dari **[MULAI-DI-SINI.md](MULAI-DI-SINI.md)**. Tidak perlu mengikuti fase pengembangan.
> Data resmi biaya, kuota, persyaratan, jadwal dan kontak belum disertakan karena dokumen pengguna belum diterima. Seed hanya mengisi identitas sekolah dari brief.

## Jalankan pertama kali di Windows

1. Ekstrak ZIP ke folder yang boleh ditulis, misalnya `D:\Project\tivask`, lalu buka folder itu di VS Code.
2. Pastikan Node.js **22.12+** (teruji dengan 22.22.3) dan PostgreSQL berjalan.
3. Pada terminal **PowerShell** di folder proyek:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
npm.cmd run dev
```

Setup meminta host, port (default **1234**), user, nama database, password PostgreSQL, password admin baru, dan API key Gemini opsional. Password tidak ditampilkan saat diketik. Setup membuat database jika belum ada, menyimpan konfigurasi lokal, menjalankan Prisma migration dan seed. Database yang memiliki schema proyek lain ditolak tanpa direset.

Buka **http://localhost:3001**. Login menggunakan `admin` dan password yang Anda buat. Backend berjalan di **http://localhost:3000**.

`JALANKAN-TIVAsk.bat` dapat dipakai untuk start berikutnya. Stop dengan **Ctrl+C** sebelum setup ulang, generate Prisma, atau memindahkan folder.

## Urutan demo yang disarankan

1. **Documents** → unggah DOCX SPMB, PDF berbasis teks, atau JSON.
2. Centang verifikasi hanya setelah memastikan dokumen adalah sumber yang benar. Tunggu **INDEXED**.
3. **Knowledge** → masukkan data penting yang ingin dijawab instan tanpa AI. Isi teks jawaban resmi, kata kunci dan status verifikasi.
4. **Settings** → isi kontak panitia jika tersedia.
5. **Chat Playground** → uji menu, pertanyaan, follow-up dan eskalasi.
6. **WhatsApp** → Hubungkan → scan QR dari nomor demo.
7. Dari nomor lain, kirim `menu`, `1`, pertanyaan, atau `panitia`.
8. **Tickets** → buka tiket → kirim balasan. Balasan pada tiket WhatsApp dikirim melalui akun yang sedang terhubung.
9. **Analytics** → lihat data aktivitas nyata. Matikan “Termasuk simulator” untuk melihat penggunaan WhatsApp saja.

Simulator memakai pemrosesan backend yang sama dan memiliki identitas terpisah `sim:...`. Balasan tiket simulator tidak mengirim WhatsApp.

## Yang sudah tersedia

- Login satu admin dengan password scrypt, session cookie HttpOnly, validasi origin, dan pembatasan permintaan.
- Menu 1–5, keyword routing, jawaban terstruktur dan cache fallback.
- Memory otomatis berdasarkan pengirim; konteks terakhir configurable.
- Knowledge CRUD untuk sekolah, jurusan/kuota, biaya, jalur, persyaratan, jadwal, FAQ, kontak, program dan informasi tambahan.
- Upload **DOCX, PDF, JSON**, ekstraksi teks, chunking dengan metadata halaman PDF, indexing, tinjau chunks, download, verifikasi, reindex dan hapus.
- Gemini configurable melalui `.env`, pembatasan waktu panggilan dan cooldown ketika gagal.
- RAG vector dengan pgvector jika terpasang; PostgreSQL JSON embedding + cosine jika ekstensi belum ada; pencarian teks bila API embedding gagal.
- Validator memeriksa ID evidence dan kutipan persis. Biaya, jadwal atau kuota tidak dibuat dari pengetahuan umum model.
- Tiket otomatis, filter status/prioritas, riwayat, balasan admin, dan jeda bot ketika tiket IN_PROGRESS.
- Penyimpanan fallback atomik untuk percakapan/tiket dan sinkronisasi ulang otomatis setiap 15 detik ketika database pulih.
- WhatsApp QR/LocalAuth, connect/reconnect/disconnect/logout, filtering pesan, journal deduplikasi.
- Overview, analytics dari PostgreSQL, health check nyata dan reset percakapan/tiket/event simulator.
- Build produksi: frontend dapat disajikan dari backend, mengurangi jumlah proses saat demo.

## Menjalankan build untuk demo

Setelah setup dan pengujian:

```powershell
npm.cmd run build
npm.cmd start
```

Buka **http://localhost:3000** untuk dashboard dan API dalam satu proses Node. PostgreSQL tetap berjalan terpisah, Chromium mulai hanya ketika WhatsApp dihubungkan.

Untuk pengembangan dua terminal:

```powershell
# Terminal 1, folder backend
npm.cmd run dev

# Terminal 2, folder dashboard
npm.cmd run dev
```

Atau `npm.cmd run dev` dari root untuk keduanya.

## Gemini

Konfigurasi ada di `backend/.env`:

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
RAG_TOP_K=5
RAG_MIN_SCORE=0.65
CONVERSATION_HISTORY_LIMIT=10
```

Model dipilih melalui konfigurasi. Ketersediaan free tier dan kuota mengikuti project Google AI Studio Anda; lihat [harga resmi Gemini](https://ai.google.dev/gemini-api/docs/pricing). Tidak ada model LLM lokal besar yang perlu dimuat ke RAM.

- `NOT_CONFIGURED`: key belum diisi.
- `NOT_TESTED`: key ada, belum ada request.
- `REACHABLE`: akses metadata model berhasil, belum membuktikan generation.
- `ONLINE`: request generation terakhir berhasil.
- `ERROR`: request gagal. Bot menggunakan fallback dan menunggu cooldown.

Pemeriksaan akses di Settings tidak mengirim pesan WhatsApp. Setelah mengisi key, restart backend dan index ulang dokumen yang masih LEXICAL jika ingin embedding. Jika mengganti model embedding, **index ulang seluruh dokumen**; embedding lintas model tidak dibandingkan.

## PostgreSQL dan pgvector

**PostgreSQL adalah database utama dalam semua mode. Tidak menggunakan SQLite.**

Skema awal tidak mensyaratkan ekstensi agar bisa dimigrate pada PostgreSQL native Windows. Embedding disimpan di kolom JSON PostgreSQL sebagai representasi portabel. Bila pgvector tersedia:

```powershell
npm.cmd run db:vector
```

Skrip membuat ekstensi `vector`, kolom `vector(768)`, melakukan backfill embedding yang sudah ada, dan membuat index HNSW. Jika ekstensi belum terpasang, skrip menjelaskan fallback tanpa mengganti database.

Dokumen yang gagal mendapatkan embedding tetap dapat diindex dalam mode **LEXICAL**. Skor lexical merupakan proporsi istilah yang cocok, bukan skor cosine dan bukan probabilitas kebenaran. Pencarian fallback dibatasi 2.000 chunks terbaru untuk prototipe; gunakan pgvector sebelum memperbesar koleksi. Upload dibatasi 10 MB, 500.000 karakter hasil ekstraksi, dan 350 chunks per dokumen.

Pilihan Docker memakai image pgvector PostgreSQL 18 dan port **5433**, sehingga tidak bertabrakan dengan PostgreSQL native port 1234. Panduan di [docs/OPERASIONAL.md](docs/OPERASIONAL.md).

## Perilaku grounding dan keterbatasan

Teks yang ditulis admin dan dokumen yang diverifikasi adalah sumber kebenaran. Gemini memilih potongan bukti yang relevan; sistem menerima hanya kutipan yang terdapat persis pada evidence. Ini sengaja konservatif untuk demo: jawaban kompleks dapat berupa beberapa kutipan, dan pertanyaan ambigu dapat dieskalasikan.

Memory membantu menyelesaikan rujukan percakapan. Pernyataan pengguna atau jawaban terdahulu tidak otomatis menjadi fakta sekolah. Verifikasi kutipan mengurangi pengarang-an fakta, tetapi tidak membuktikan bahwa dokumen sumber benar, terbaru, atau bahwa setiap pemilihan konteks selalu tepat. Tinjau sumber dan uji skenario penting.

Jika PostgreSQL mati:
- Knowledge dari cache terakhir tetap dapat dibaca.
- Percakapan dan tiket tetap dicatat di JSON lokal dan ditampilkan sebagai data tertunda.
- Pencarian dokumen dan mutasi Knowledge/Documents membutuhkan PostgreSQL.
- Analytics ditampilkan tidak tersedia, bukan angka nol palsu.
- Saat pulih, record disinkronkan secara idempotent.

Jika **internet** mati, menu/simulator lokal tetap berjalan; **WhatsApp tidak dapat menerima atau mengirim pesan baru tanpa koneksi internet**.

PDF scan tidak memiliki teks untuk diekstrak; lakukan OCR sebelum upload. DOCX dibaca tanpa perlu label kategori per bagian, tetapi isinya tidak otomatis diubah menjadi entri biaya/jurusan terstruktur. Admin dapat menambahkan data yang sering ditanyakan pada Knowledge.

## Keamanan dan penyimpanan

- Semua endpoint administrasi dan simulator membutuhkan session admin.
- Default listen hanya `127.0.0.1`. Dashboard digunakan pada laptop yang sama.
- Jangan commit `.env`, `.wwebjs_auth`, uploads, cache Knowledge, atau file fallback.
- Fallback menyimpan isi percakapan dan tiket lokal tanpa enkripsi aplikasi; jaga akses folder laptop.
- State pengiriman yang tidak pasti diberi `UNCERTAIN`; tidak otomatis dikirim ulang. Periksa WhatsApp sebelum mencoba lagi.
- Session login dashboard berakhir setelah delapan jam atau restart backend. Session WhatsApp terpisah dan dipertahankan LocalAuth selama masih valid.
- WhatsApp gateway menggunakan `whatsapp-web.js`, seperti yang diminta dalam brief.
- API key Gemini dan password PostgreSQL tidak ditampilkan pada dashboard.

## Verifikasi

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd audit
```

Lihat [docs/VALIDASI.md](docs/VALIDASI.md) untuk hasil dan batas pengujian. Validasi lokal tidak berarti akun WhatsApp atau Gemini pengguna sudah aktif.

Referensi konsep: [digiDasa](https://github.com/akhmadzaqiriyadi/digiDasa). Implementasi ini dibuat terpisah. Referensi teknis: [whatsapp-web.js](https://docs.wwebjs.dev/Client.html), [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings), dan [pgvector](https://github.com/pgvector/pgvector).

