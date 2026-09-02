const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// 1. Konfigurasi Multer untuk menyimpan file sementara di folder uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Pastikan folder uploads ada
        const uploadPath = config.uploadDir;
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Generate nama file unik untuk menghindari collision
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// 2. Inisialisasi Multer dengan limit ukuran file dari config
const upload = multer({
    storage: storage,
    limits: {
        fileSize: config.maxFileSize // Dari .env, default 25MB
    }
});

// 3. Whitelist ekstensi file yang diizinkan
const ALLOWED_EXTENSIONS = [
    // Word/Text
    '.doc', '.docx', '.odt', '.rtf', '.txt',
    // Excel
    '.xls', '.xlsx', '.ods', '.csv',
    // PowerPoint
    '.ppt', '.pptx', '.odp',
    // Gambar
    '.jpg', '.jpeg', '.png', '.bmp', '.gif'
];

// 4. Whitelist MIME types yang valid (untuk validasi magic bytes)
const ALLOWED_MIMES = [
    // Office documents
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
    'application/msword',       // doc
    'application/vnd.ms-excel', // xls
    'application/vnd.ms-powerpoint', // ppt
    // OpenDocument formats
    'application/vnd.oasis.opendocument.text',         // odt
    'application/vnd.oasis.opendocument.spreadsheet',  // ods
    'application/vnd.oasis.opendocument.presentation', // odp
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/bmp',
    // Plain text formats (tidak bisa dideteksi magic bytes, akan divalidasi via ekstensi)
    'text/plain', 'text/csv', 'application/rtf'
];

// 5. Middleware untuk validasi ekstensi file (Express Middleware format)
const validateExtension = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Tidak ada file yang diupload' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        // Hapus file yang sudah ter-upload jika ekstensi tidak valid
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: `Ekstensi file ${ext} tidak diizinkan` });
    }
    
    next();
};

// 6. Middleware untuk validasi magic bytes (setelah file ter-upload)
const validateMagicBytes = async (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Tidak ada file yang diupload' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    // Untuk format plain text (txt, csv, rtf), skip magic bytes validation
    // karena tidak punya signature hex yang konsisten
    const textFormats = ['.txt', '.csv', '.rtf'];
    if (textFormats.includes(ext)) {
        return next();
    }

    try {
        // Dynamic import karena file-type adalah ESM-only
        const { fileTypeFromFile } = await import('file-type');
        const type = await fileTypeFromFile(filePath);

        if (!type) {
            // File tidak terdeteksi tipe-nya, hapus dan tolak
            fs.unlinkSync(filePath);
            return res.status(400).json({ 
                error: 'Tipe file tidak dapat dideteksi. Pastikan file tidak korup.' 
            });
        }

        if (!ALLOWED_MIMES.includes(type.mime)) {
            // MIME type tidak ada di whitelist, hapus dan tolak
            fs.unlinkSync(filePath);
            return res.status(400).json({ 
                error: 'Tipe file tidak valid atau tidak didukung' 
            });
        }

        // Validasi berhasil, lanjut ke route handler
        next();
    } catch (error) {
        console.error('[FileValidation] Error saat validasi magic bytes:', error);
        // Hapus file jika terjadi error
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return res.status(500).json({ error: 'Gagal memvalidasi tipe file' });
    }
};

// 7. Export middleware yang sudah di-chain
module.exports = {
    upload: upload.single('file'), // Menerima 1 file dengan field name 'file'
    validateExtension,
    validateMagicBytes
};