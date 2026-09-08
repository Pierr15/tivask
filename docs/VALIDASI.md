# Laporan validasi TIVAsk

Tanggal: **8 September 2026**. Lingkungan: Windows, Node.js **22.22.3**, PostgreSQL **18.6**, Prisma **6.19.0**, Edge headless.

Pengujian memakai PostgreSQL uji yang terisolasi di port 15434 dan server API uji port 3110. Database/akun sekolah milik pengguna tidak dikonfigurasi menggunakan kredensial rekaan. Fixture biaya, jurusan dan dokumen untuk tes tidak menjadi data bawaan paket.

## Hasil

| Pemeriksaan | Hasil |
|---|---|
| TypeScript strict backend + dashboard | Lolos |
| Prisma generate dengan dependency final | Lolos |
| Migration pada PostgreSQL 18 nyata | Lolos |
| Seed identitas sekolah | Lolos |
| Build backend + Vite dashboard | Lolos |
| Unit/regression test | **15/15 lolos** |
| Integrasi API + PostgreSQL | **28/28 lolos** |
| Database terputus / pemulihan | **13/13 pemeriksaan lolos** |
| PDF valid + penyimpanan/pencarian vector fallback | **5/5 lolos** |
| Delapan halaman, desktop 1440px dan mobile 390px | **16 pemeriksaan; tidak ada overflow horizontal atau error JavaScript** |
| Interaksi UI lengkap | **5/5 lolos** |
| Audit npm dependency final | **0 kerentanan dilaporkan pada saat pemeriksaan** |
| Syntax skrip setup PowerShell | Lolos parsing |

## Kasus yang diuji

- Menu angka dan variasi nomor/menu/opsi.
- Pertanyaan kasus pribadi mengarah ke panitia.
- Follow-up memory otomatis tanpa history dikirim frontend.
- Pergantian konteks perempuan → laki-laki mempertahankan subjek seragam.
- Biaya asrama/pendaftaran tidak dijawab menggunakan angka biaya seragam.
- Kutipan Gemini palsu dan ID evidence yang tidak dikenal ditolak validator.
- Chunking mempertahankan metadata halaman dan batas ukuran.
- Cosine similarity serta isolasi embedding lintas model.
- Filter WhatsApp untuk pesan sendiri, grup, broadcast, kosong, lama, terlalu panjang dan media.
- Formatter dan pemecahan balasan panjang.
- Penulisan journal bersamaan tanpa lost update; JSON rusak tidak ditimpa.
- Login valid/tidak valid, cookie HttpOnly, endpoint tanpa login, dan origin berbahaya.
- Knowledge CRUD dan entri draft yang tidak digunakan bot.
- Tiket, transisi status, balasan simulator, request ID idempotent, dan jeda bot saat panitia menangani.
- Upload/index JSON, DOCX, PDF teks valid, serta PDF malformed.
- Pencarian dokumen tanpa Gemini menghasilkan kutipan sumber yang persis.
- Analytics mengikuti event tersimpan dan memisahkan simulator dari WhatsApp.
- PostgreSQL berhenti: Knowledge cache tetap menjawab, memory tetap bekerja, tiket tersimpan di fallback, analytics tidak dipalsukan.
- PostgreSQL hidup kembali: readiness pulih, outbox tersinkron, tiket/riwayat tetap ada, analytics kembali tersedia, pengulangan sync tidak menggandakan data.
- Interaksi browser: tambah Knowledge, pertanyaan simulator, eskalasi, balasan tiket simulator, dan buka/tutup navigasi mobile.

Pemulihan database memiliki cooldown/retry; status tidak harus langsung ONLINE pada request pertama setelah PostgreSQL restart.

## Belum diverifikasi secara live

- Scan QR nomor WhatsApp pengguna, pengiriman/penerimaan pesan nyata, reconnect dan pemulihan LocalAuth setelah restart dengan sesi pengguna.
- Generate dan embedding Gemini dengan API key milik pengguna; belum ada key yang disediakan. Jalur tanpa key dan validator telah diuji.
- SQL pgvector/HNSW pada ekstensi pgvector aktif dan Docker Compose berjalan. PostgreSQL native uji belum memiliki ekstensi. Jalur PostgreSQL JSON embedding + cosine diuji menggunakan vector fixture.
- Isi dokumen SPMB asli pengguna; file DOCX asli belum dilampirkan.
- Laptop lomba RAM 16 GB dan kondisi jaringan lokasi lomba.

## Catatan dependency

Override dependency turunan diterapkan untuk `@puppeteer/browsers`, `deepmerge-ts`, dan `effect`. Setelah itu Prisma generate, import whatsapp-web.js, browser Edge headless, unit tests, TypeScript, build dan audit kembali diperiksa. Uji sesi WhatsApp nyata tetap perlu dilakukan karena website WhatsApp dapat berubah.

## Cuplikan tampilan

`preview-dashboard.png` dan `preview-mobile.png` menunjukkan data hasil pengujian simulator, bukan metrik penggunaan sekolah. Data fixture tidak disertakan sebagai seed.

