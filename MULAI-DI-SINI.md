# Jalankan TIVAsk malam ini

## 1. Buka folder proyek

Buka folder `tivask` di VS Code. Pilih **Terminal → New Terminal → PowerShell**. Pastikan lokasi terminal berisi `package.json`, `backend`, dan `dashboard`.

## 2. Pastikan PostgreSQL hidup

Gunakan PostgreSQL 18 native yang sudah Anda pasang, port **1234**. Tidak perlu menjalankan Docker bersamaan.

## 3. Jalankan setup

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
```

Isi pertanyaan berikut:
- Host: tekan Enter untuk `127.0.0.1`.
- Port: tekan Enter untuk `1234`.
- Username PostgreSQL: biasanya `postgres`.
- Database: tekan Enter untuk `tivask`. Jika nama itu sudah digunakan proyek lain, pilih `tivask_prototype`.
- Password PostgreSQL: password yang dibuat ketika memasang PostgreSQL.
- Password admin: buat password baru minimal 10 karakter; ini untuk login dashboard.
- API key Gemini: tempel key Anda, atau Enter untuk mengisi nanti di `backend/.env`.

Karakter password/key tidak muncul saat diketik. Ini normal.

Setup akan memasang dependency, membuat database baru bila belum ada, membuat tabel, dan menambahkan identitas sekolah. Pesan bahwa pgvector belum terpasang **tidak menghentikan fungsi dasar prototipe**.

## 4. Start

```powershell
npm.cmd run dev
```

Buka **http://localhost:3001**. Username: **admin**. Password: yang Anda buat pada setup.

## 5. Isi sumber informasi

**Documents → pilih file DOCX → verifikasi sumber → Unggah dokumen.**

Tunggu INDEXED. DOCX dapat langsung dibaca tanpa label per bagian. Dokumen yang belum diverifikasi tidak akan dipakai untuk menjawab.

Untuk pertanyaan yang ingin dijawab tanpa AI, masukkan informasi pada **Knowledge**. Data biaya, jurusan, kuota dan jadwal belum diisi pada paket awal.

Jika ingin menguji memory:
1. Tambahkan entri biaya seragam laki-laki dengan isi resmi dan detail gender Laki-laki.
2. Tambahkan entri biaya seragam perempuan dengan isi resmi dan detail gender Perempuan.
3. Pastikan keduanya terverifikasi.
4. Di Chat Playground, tanya `Berapa biaya seragam?`, lalu `Kalau perempuan?`, lalu `Kalau laki laki?`.

Jika memakai angka contoh untuk latihan, centang **Data simulasi** supaya jawaban diberi label DATA DEMO.

## 6. Hubungkan WhatsApp

**WhatsApp → Hubungkan**, kemudian scan QR melalui menu Perangkat tertaut dari nomor demo.

Kirim `menu` menggunakan nomor WhatsApp lain. Bot mengabaikan pesan dari akunnya sendiri.

Untuk menguji tiket:
- Kirim `Saya ingin bicara dengan panitia`.
- Buka Tickets, pilih tiket, tulis dan kirim balasan.
- Status menjadi IN_PROGRESS; bot menahan jawaban otomatis sampai tiket diselesaikan.
- Setelah selesai, ubah status menjadi RESOLVED.

## 7. Mode yang lebih ringan untuk laptop lomba

Hentikan server development dengan Ctrl+C, lalu:

```powershell
npm.cmd run build
npm.cmd start
```

Buka **http://localhost:3000**. Dashboard dan API berjalan dalam satu proses Node.

## Kalau ada kendala

- **Tidak bisa login**: akun admin belum disiapkan atau password tidak cocok. Jalankan ulang setup setelah menghentikan server.
- **Database OFFLINE**: periksa service PostgreSQL, port dan password.
- **Schema MISSING**: jalankan `npm.cmd run db:migrate`, lalu `npm.cmd run db:seed`.
- **Gemini NOT_CONFIGURED**: isi API key di `backend/.env`, restart server.
- **RAG LEXICAL**: pencarian teks tetap bisa digunakan. Isi key dan index ulang untuk embedding.
- **Chrome/Edge tidak ditemukan**: isi `CHROME_EXECUTABLE_PATH` dalam `backend/.env` dengan lokasi executable browser.
- **Port 3000/3001 sedang dipakai**: hentikan proses TIVAsk sebelumnya; jangan membuka dua server bersamaan.
- **Prisma EPERM saat generate**: hentikan backend terlebih dahulu, lalu ulangi.
- **Tidak ada informasi**: sumber belum diunggah/disetujui, atau pertanyaan tidak tercakup. Bot membuat tiket.
- **WhatsApp belum bisa dikirim**: pastikan status CONNECTED dan koneksi internet tersedia.

Paket belum terhubung ke akun WhatsApp Anda dan belum berisi key Gemini atau dokumen resmi Anda.

