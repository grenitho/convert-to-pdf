🗺️ Peta Jalan (Roadmap) Pengembangan ConvertToPDF

Fase 1: Inisialisasi Proyek & Struktur Folder
Membuat direktori utama dan struktur folder/file sesuai standar.
Inisialisasi package.json dan instalasi dependensi awal.
Membuat file konfigurasi dasar (.env, .gitignore).

Fase 2: Backend Core & Middleware
Membuat config.js untuk membaca environment variables.
Membuat server.js (Entry point Express).
Membuat middleware fileValidation.js (Multer limits + Magic Bytes validation dengan file-type).

Fase 3: Engine Konversi & Queue (Jantung Aplikasi)
Membuat queue.js (Setup p-queue dengan concurrency 1).
Membuat converter.js (Wrapper LibreOffice dengan tree-kill, isolated profile, dan timeout 120s).
Membuat cleanup.js (Logika hapus file otomatis pasca-proses).

Fase 4: Frontend (UI/UX Sederhana tapi Solid)
Membuat public/index.html (Form upload yang bersih).
Membuat public/style.css (Styling minimalis, responsif).
Membuat public/script.js (Fetch API dengan handling timeout, loading state, dan error message yang jelas).

Fase 5: Deployment ke VPS (Bare Metal Ubuntu)
Update OS & instalasi dependensi sistem (LibreOffice, Node.js, Nginx, Certbot).
Krusial: Instalasi font Microsoft (ttf-mscorefonts-installer) & verifikasi.
Konfigurasi Nginx (Reverse proxy, Basic Auth, client_max_body_size, SSL).
Setup PM2 untuk auto-restart.
Setup Cron Job (Cleanup file lama + Pembunuh Zombie Process).

Fase 6: Testing & Finalisasi
Menjalankan Testing Checklist (font, file korup, file besar, keamanan).
Serah terima dokumentasi singkat (command restart, cek log, dll).