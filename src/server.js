const express = require('express');
const path = require('path');
const config = require('./config');

const app = express();

// 1. Serve static files dari folder 'public' (Frontend UI)
app.use(express.static(path.join(__dirname, '..', 'public')));

// 2. Middleware untuk parsing JSON (untuk request API non-file)
app.use(express.json());

// 3. Mount API Routes
// CATATAN PENTING: File routes/convert.js akan kita buat di langkah selanjutnya. 
// JANGAN uncomment baris di bawah ini sebelum file routes/convert.js dibuat, 
// karena akan menyebabkan error saat server dijalankan.
app.use('/api', require('./routes/convert'));
app.use('/api', require('./routes/merge'));

// 4. Handler untuk request yang tidak ditemukan (404)
app.use((req, res, next) => {
    // Jika request ke endpoint API, kembalikan JSON 404
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint API tidak ditemukan' });
    }
    // Jika bukan API (misal user akses root /), kembalikan halaman index.html
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 5. Global Error Handler (Menangkap semua error yang tidak tertangkap di middleware/route)
app.use((err, req, res, next) => {
    console.error('[Global Error]', err.stack || err);
    
    // Keamanan: Jangan tampilkan stack trace detail di mode production
    const message = config.nodeEnv === 'production' 
        ? 'Terjadi kesalahan pada server' 
        : err.message;

    res.status(err.status || 500).json({ error: message });
});

// 6. Jalankan Server
app.listen(config.port, () => {
    console.log(`[Server] Backend berjalan di port ${config.port} | Mode: ${config.nodeEnv}`);
});