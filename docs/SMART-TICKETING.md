# Smart Ticketing TIVAsk

## Alur pesan

1. Pesan baru tetap masuk ke riwayat percakapan umum.
2. Jika pengguna mempunyai tiket aktif, TIVAsk membandingkan pesan baru dengan konteks tiket.
3. `RELATED` ditambahkan ke thread tiket yang sama.
4. `UNCERTAIN` meminta konfirmasi pengguna (`1/ya` atau `2/tidak`).
5. `UNRELATED` tetap diproses sebagai FAQ/RAG normal sehingga bot tidak berhenti hanya karena ada tiket aktif.
6. Pertanyaan yang tidak ditemukan di knowledge base tidak otomatis membuat tiket. Bot meminta pengguna memperjelas pertanyaan dan menawarkan keyword `admin` bila bantuan manusia diperlukan.
7. Ticket baru dibuat hanya untuk eskalasi eksplisit/kasus yang memang diarahkan ke panitia. Ticket aktif dengan konteks sangat mirip digunakan kembali untuk mencegah duplikat.

## Lifecycle tiket

`OPEN -> ASSIGNED -> IN_PROGRESS -> WAITING_USER -> RESOLVED -> CLOSED`

Status dapat disesuaikan dari dashboard. Balasan admin otomatis meng-assign tiket ke akun admin yang sedang login dan mengubah tiket aktif menjadi `IN_PROGRESS`.

## Thread dan quoted reply

Setiap tiket memiliki `TicketMessage` tersendiri. Pesan menyimpan `whatsappMessageId` dan `replyToMessageId`. Admin dapat memilih pesan pengguna lalu menekan **Reply**. Backend mencoba mengirim quoted reply melalui `whatsapp-web.js`. Jika quoted reply tidak dapat dikirim, TIVAsk mengirim fallback teks yang menyebut potongan pesan yang sedang dijawab.

## Unread

Pesan pengguna yang masuk ke thread menaikkan `unreadCount`. Dashboard menampilkan badge `NEW`. Membuka tiket menandainya sebagai sudah dibaca.

## Setelah checkout branch / deploy

Jalankan:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run check
npm test
npm run build
```

Migration baru: `backend/prisma/migrations/202609090001_smart_ticket_threading/migration.sql`.
