# Blueprint: Web App "Convert to PDF" (Self-Hosted di VPS)

## 1. Tujuan & Batasan Proyek

**Tujuan:** Web app privat untuk convert file Office (Word, Excel, PowerPoint) dan gambar menjadi PDF, dipakai sendiri + dibagikan ke pasangan/teman dekat (bukan publik).

**Batasan penting:**
- Tanpa limit harian buatan (beda dari tool online gratisan) — limit hanya dari kapasitas VPS.
- Harus ringan RAM (VPS kecil, ~1–2GB RAM).
- Akses dibatasi (tidak publik/terindeks), tapi mudah dibagikan via link.
- Tidak butuh sistem akun/login kompleks.

---

## 2. Rekomendasi Stack (Final)

| Komponen | Pilihan | Alasan |
|---|---|---|
| Engine convert | **LibreOffice headless** | Satu tool untuk semua format Office + gambar, tidak perlu library terpisah per jenis file |
| Backend | **Node.js + Express** | Ringan, mudah handle upload file & subprocess, ekosistem library banyak |
| Queue | **p-queue** (in-process, concurrency=1) | Cukup untuk skala kecil, tidak perlu Redis/Celery yang menambah beban RAM |
| Frontend | **HTML + JS vanilla (1 halaman)** | Tidak perlu build step / framework berat |
| Reverse proxy | **Nginx** | Untuk SSL, basic auth, dan menyembunyikan port backend |
| SSL | **Let's Encrypt (Certbot)** | Gratis, otomatis renew |
| Proses manager | **PM2** | Auto-restart backend kalau crash, mudah lihat log |
| Containerization | **Skip untuk versi awal (bare metal Ubuntu)** | Image Docker untuk LibreOffice+Node bisa 1-1.5GB, terlalu boros untuk storage VPS 10-20GB. Pertimbangkan Docker hanya jika nanti pindah ke VPS dengan storage lebih besar |

> Kalau LLM lain menyarankan Python/Flask, itu juga valid — tapi Node.js dipilih karena lebih ringan untuk I/O-bound task seperti ini (upload/download file, spawn subprocess).

---

## 3. Arsitektur Alur

```
[Browser: pasangan/teman]
        |
        | HTTPS (dengan basic auth)
        v
   [Nginx reverse proxy]
        |
        v
 [Node.js/Express backend]
        |
        |--> Terima file upload (multer)
        |--> Validasi tipe & ukuran file
        |--> Masukkan ke queue (concurrency = 1)
        |--> Panggil: libreoffice --headless --convert-to pdf
        |--> Kirim balik file PDF ke user
        |--> Jadwalkan hapus file (cleanup job)
        v
   [Disk sementara: /tmp/uploads, /tmp/converted]
```

---

## 4. Spesifikasi VPS Minimum

- **RAM:** 1 GB cukup untuk penggunaan personal (2-5 user, tidak convert bersamaan dalam jumlah besar). 2 GB lebih aman kalau file besar (misal PPTX dengan banyak gambar).
- **CPU:** 1 vCPU cukup.
- **Storage:** 10-20 GB (LibreOffice install ~1-2GB, sisanya untuk file sementara).
- **OS:** Ubuntu 22.04/24.04 LTS (paling banyak dukungan paket).
- **Swap:** Aktifkan swap 1-2GB sebagai jaring pengaman kalau RAM VPS pas-pasan (mencegah OOM-kill saat convert file besar).

---

## 5. Struktur Folder Proyek

```
convert-to-pdf-app/
├── src/
│   ├── server.js              # entry point Express
│   ├── routes/
│   │   └── convert.js         # endpoint upload & convert
│   ├── services/
│   │   ├── converter.js       # wrapper subprocess LibreOffice
│   │   └── queue.js           # setup p-queue
│   ├── middleware/
│   │   ├── fileValidation.js  # cek ekstensi, ukuran file
│   │   └── cleanup.js         # hapus file lama otomatis
│   └── config.js              # baca .env
├── public/
│   ├── index.html             # halaman upload
│   ├── style.css
│   └── script.js              # fetch API ke backend
├── tmp/
│   ├── uploads/                # file asli sementara
│   └── converted/              # hasil PDF sementara
├── .env                        # PORT, MAX_FILE_SIZE, dll
├── package.json
├── ecosystem.config.js         # konfigurasi PM2
├── Dockerfile                  # opsional
├── docker-compose.yml          # opsional
└── nginx.conf                  # config reverse proxy + basic auth
```

---

## 6. Detail Implementasi Backend

### 6.1 Endpoint API

| Method | Endpoint | Fungsi |
|---|---|---|
| `POST` | `/api/convert` | Terima 1 file, return file PDF hasil convert |
| `GET` | `/api/health` | Cek apakah service & LibreOffice hidup (untuk monitoring) |

### 6.2 Format Input yang Didukung (whitelist eksplisit)

```
.doc, .docx, .odt, .rtf, .txt   → Word/Text
.xls, .xlsx, .ods, .csv         → Excel
.ppt, .pptx, .odp               → PowerPoint
.jpg, .jpeg, .png, .bmp, .gif   → Gambar
```

Validasi ekstensi + MIME type dari browser **TIDAK CUKUP** — MIME type yang dikirim `multer` dari header HTTP browser sangat mudah dipalsukan (misal `virus.sh` di-rename jadi `virus.docx`, browser akan tetap mengirim MIME type seolah dokumen Word).

**Wajib tambahkan validasi Magic Bytes** menggunakan library `file-type`, yang membaca signature hex asli di awal file:
```javascript
// CATATAN: file-type versi terbaru adalah ESM-only.
// Kalau project pakai CommonJS (require), gunakan dynamic import:
const { fileTypeFromFile } = await import('file-type');

const type = await fileTypeFromFile(req.file.path);
const allowedMimes = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'image/jpeg', 'image/png', 'image/gif', 'image/bmp',
];

if (!type || !allowedMimes.includes(type.mime)) {
    fs.unlinkSync(req.file.path); // hapus file mencurigakan
    return res.status(400).json({ error: 'Tipe file tidak valid atau tidak didukung' });
}
```
Catatan: file `.csv`, `.txt`, `.rtf`, `.odt`, `.ods`, `.odp` sulit dideteksi lewat magic bytes murni (plain text) — untuk tipe ini, validasi ekstensi + isi konten (bukan MIME browser) sudah cukup memadai.

### 6.3 Batas Ukuran File

- Set limit eksplisit di kode, misal **`MAX_FILE_SIZE = 25MB`** (bisa disesuaikan).
- Ini BUKAN untuk membatasi pemakaian seperti tool online gratisan, tapi untuk **mencegah VPS kehabisan RAM/disk** kalau ada file sangat besar (misal PPTX 200MB dengan video di dalamnya).

### 6.4 Perintah Convert (inti dari sistem)

```bash
libreoffice --headless --norestore --convert-to pdf --outdir /path/output /path/input/file.docx
```

Catatan penting untuk LLM yang membangun ini:
- Tambahkan **timeout** (120 detik, bukan 60 — file besar dengan swap aktif butuh waktu lebih lama) pada subprocess — LibreOffice kadang hang pada file korup.
- Jalankan LibreOffice dengan **user profile terisolasi** per proses (`-env:UserInstallation=file:///tmp/lo_profile_<random_id>`) untuk menghindari conflict kalau ada 2 proses nyaris bersamaan.
- Tambahkan flag `--safe-mode` agar LibreOffice skip dialog error/extension yang rusak dan tidak hang menunggu input.
- Tangkap `stderr`/exit code untuk deteksi kegagalan convert, jangan asumsikan selalu sukses.

**PENTING — Zombie Process:** LibreOffice terkenal suka "nyangkut" (proses `soffice.bin` tidak menutup diri) jika menemukan file korup atau font bermasalah. Kalau ini dibiarkan, RAM VPS lama-lama habis oleh proses zombie yang menumpuk. Wajib ditangani di 2 level:

1. **Kill process tree saat timeout** — `spawn()` biasa hanya bisa kill proses langsung, sedangkan `soffice.bin` sering jadi child dari proses lain. Gunakan library `tree-kill` (bukan `process.kill()` biasa) supaya seluruh process tree ikut mati:
   ```javascript
   const { spawn } = require('child_process');
   const treeKill = require('tree-kill');
   const fs = require('fs');

   const loProfile = `/tmp/lo_profile_${Date.now()}_${Math.random().toString(36).substring(7)}`;

   const loProcess = spawn('libreoffice', [
       '--headless', '--norestore', '--safe-mode',
       `-env:UserInstallation=file://${loProfile}`,
       '--convert-to', 'pdf',
       '--outdir', outputDir,
       filePath
   ]);

   const timeout = setTimeout(() => {
       treeKill(loProcess.pid, 'SIGKILL', () => {
           fs.rmSync(loProfile, { recursive: true, force: true });
       });
       reject(new Error('Conversion timeout'));
   }, 120000); // 2 menit
   ```
2. **Cron job penyapu (fallback)** — jaga-jaga kalau ada zombie yang lolos dari penanganan Node.js:
   ```bash
   # crontab, jalan tiap 15 menit
   */15 * * * * pkill -9 -f soffice.bin
   ```
   (Aman dijalankan karena tiap request selalu bikin proses baru dengan profile baru — tidak ada state yang perlu dijaga di proses lama.)

### 6.5 Queue (Concurrency Control)

```js
const PQueue = require('p-queue').default;
const queue = new PQueue({ concurrency: 1 }); // atau 2 kalau RAM VPS ≥2GB
```

Semua request convert masuk lewat queue ini — mencegah 2+ proses LibreOffice jalan bersamaan yang bisa menghabiskan RAM VPS kecil.

### 6.6 Cleanup Otomatis

- Setelah file PDF berhasil dikirim ke user → hapus file asli & hasil convert **segera** (bukan tunggu cron).
- Tambahan: cron job tiap 1 jam untuk hapus sisa file di `/tmp/uploads` & `/tmp/converted` yang lebih tua dari 1 jam (jaga-jaga kalau ada proses gagal tanpa cleanup).

---

## 7. Keamanan (WAJIB, karena akan dibagikan ke orang lain)

1. **Basic Auth di level Nginx** (bukan di aplikasi) — 1 username/password untuk semua yang diberi akses. Contoh generate:
   ```bash
   sudo htpasswd -c /etc/nginx/.htpasswd namauser
   ```
2. **HTTPS wajib** (Let's Encrypt) — supaya file yang diupload tidak bisa disadap di jaringan publik (misal pasangan/teman akses dari WiFi kafe).
3. **Rate limiting sederhana di Nginx** (`limit_req`) — mencegah penyalahgunaan kalau link ter-share tanpa sengaja.
4. **Validasi tipe file ketat** — tolak file executable (.exe, .sh, .php, dll) meski di-rename jadi .docx.
5. **Jangan expose port backend (misal 3000) langsung ke internet** — hanya Nginx yang publik, backend hanya listen di localhost.
6. **Non-root user** untuk menjalankan Node.js & LibreOffice (jangan pakai root).
7. **Blokir akses langsung ke folder `/tmp`** — pastikan konfigurasi Nginx tidak sengaja punya `location` atau `alias` yang mengekspos `/tmp/uploads` atau `/tmp/converted` sebagai static file yang bisa diakses browser.
8. **(Opsional) Strip metadata PDF** — LibreOffice kadang membawa metadata file asli (nama author, software, dll) ke PDF hasil convert. Untuk privasi ekstra, tambahkan post-processing dengan `qpdf` atau `exiftool` untuk menghapus metadata sebelum file dikirim ke user.

---

## 8. Deployment (Langkah Eksekusi untuk LLM Pembangun)

1. Update sistem & install dependencies dasar:
   ```bash
   sudo apt update && sudo apt install -y libreoffice nodejs npm nginx certbot python3-certbot-nginx
   ```
2. **Install font Microsoft Office** (WAJIB, agar file .docx dengan font Calibri/Cambria/Arial tidak berantakan saat jadi PDF). Karena instalasi ini butuh accept EULA, gunakan debconf preseed supaya tidak hang menunggu dialog interaktif:
   ```bash
   echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | sudo debconf-set-selections
   sudo apt install -y ttf-mscorefonts-installer
   sudo fc-cache -f -v
   ```
3. (Opsional, untuk fitur preview thumbnail di masa depan) Install `poppler-utils`:
   ```bash
   sudo apt install -y poppler-utils
   ```
4. Clone/upload kode project ke `/opt/convert-to-pdf-app`.
5. Install dependencies Node (termasuk `p-queue`, `file-type`, `tree-kill`, `multer`): `npm install`.
6. Setup `.env` (PORT, MAX_FILE_SIZE, dll).
7. Jalankan dengan PM2:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```
8. Setup Nginx sebagai reverse proxy ke `localhost:3000`, tambahkan basic auth & SSL. **Jangan lupa `client_max_body_size`** — secara default Nginx menolak upload di atas 1MB (error `413`) sebelum request sempat menyentuh Node.js:
   ```nginx
   server {
       listen 443 ssl;
       server_name convert.namadomainkamu.com;

       client_max_body_size 30M; # beri ruang lebih dari MAX_FILE_SIZE di .env (25MB)

       location / {
           auth_basic "Restricted";
           auth_basic_user_file /etc/nginx/.htpasswd;
           proxy_pass http://localhost:3000;
           proxy_read_timeout 150s; # lebih lama dari timeout convert (120s) di Node.js
       }
   }
   ```
9. Jalankan Certbot untuk SSL:
   ```bash
   sudo certbot --nginx -d convert.namadomainkamu.com
   ```
10. Setup cron cleanup file lama + cron penyapu zombie process LibreOffice (lihat bagian 6.4 dan 6.6).
11. Test end-to-end: upload masing-masing tipe file (docx dengan font Calibri, xlsx, pptx, jpg) dan pastikan hasil PDF benar — termasuk cek apakah font-nya sudah tampil benar, bukan fallback ke DejaVu Sans.

---

## 9. Testing Checklist (untuk kamu cek nanti bersama saya)

- [ ] Convert .docx dengan gambar & tabel di dalamnya → layout tetap rapi di PDF
- [ ] Convert .xlsx dengan banyak kolom → tidak terpotong
- [ ] Convert .pptx dengan banyak slide & gambar besar → tidak timeout/crash
- [ ] Upload file dengan ekstensi disamarkan (misal `virus.exe` → `virus.docx`) → harus ditolak
- [ ] Upload file > batas ukuran → error message jelas, bukan crash server
- [ ] Convert 2 file bersamaan dari 2 device berbeda → tidak membuat RAM VPS penuh (cek `htop`/`free -m` saat testing)
- [ ] File di `/tmp/uploads` & `/tmp/converted` benar-benar terhapus setelah proses selesai
- [ ] Akses tanpa basic auth → ditolak (401)
- [ ] Cek `/api/health` merespons OK dan LibreOffice terdeteksi jalan
- [ ] Upload .docx dengan font Calibri/Cambria → cek hasil PDF, font harus tampil benar (bukan fallback ke DejaVu Sans/font Linux)
- [ ] Upload file korup (misal .docx yang di-edit hex-nya jadi rusak) → proses harus timeout dengan rapi, TIDAK meninggalkan proses `soffice.bin` zombie (cek dengan `ps aux | grep soffice` setelah beberapa kali test)
- [ ] Rename file `.sh`/`.exe` jadi `.docx` lalu upload → harus ditolak oleh validasi magic bytes, bukan lolos ke LibreOffice
- [ ] Upload file besar (~20MB) dari koneksi lambat/HP → pastikan tidak kena error Nginx `413` dan browser tidak timeout duluan sebelum convert selesai
- [ ] Simulasikan swap aktif (convert file besar berturut-turut) → cek `free -m` dan pastikan VPS tidak freeze total

---

## 10. Potensi Pengembangan Lanjutan (opsional, tidak wajib di versi awal)

- Convert banyak file sekaligus (batch/multi-upload) dalam 1 request.
- Preview thumbnail hasil PDF sebelum download.
- Progress bar real-time untuk file besar (via WebSocket/SSE).
- Statistik ringan (jumlah convert per hari) untuk monitoring, tanpa menyimpan isi file.

---

## 11. Catatan untuk LLM yang Akan Membangun Ini

- Prioritaskan **stabilitas & keamanan** di atas fitur tambahan — ini akan diakses orang lain (pasangan/teman), jadi hindari kompleksitas yang tidak perlu.
- Uji dengan file **nyata dari Microsoft Office** (bukan hanya file dummy) karena LibreOffice kadang punya perbedaan rendering minor untuk file kompleks (font, layout).
- Jangan lupa **timeout & error handling** di setiap tahap (upload, convert, cleanup) — jangan biarkan 1 file gagal membuat seluruh service hang.
- Setelah selesai dibangun, siapkan ringkasan: versi Node.js, versi LibreOffice, dan command untuk restart service — supaya bisa dicek ulang di sesi berikutnya.
