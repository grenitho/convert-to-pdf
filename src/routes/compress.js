const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { fileTypeFromFile } = require('file-type');
const { compressPdf } = require('../services/compressor');
const { cleanupFiles } = require('../middleware/cleanup');

const router = express.Router();

// Multer setup untuk single file
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.env.UPLOAD_DIR || './tmp/uploads');
    },
    filename: (req, file, cb) => {
        // Sanitize filename & buat unik untuk mencegah collision
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'compress-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 40 * 1024 * 1024, // 40MB per file
        files: 1 // Hanya 1 file per request
    },
    fileFilter: (req, file, cb) => {
        // Filter awal berdasarkan ekstensi dan mimetype
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed for compression.'));
        }
    }
});

// Endpoint POST /api/compress
router.post('/compress', upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const inputPath = file.path;
    // Output ke folder converted agar cron job existing bisa membersihkannya
    const outputDir = process.env.CONVERTED_DIR || './tmp/converted';
    const outputPath = path.join(outputDir, file.filename.replace('compress-', 'compressed-') + '.pdf');

    try {
        // Validasi Magic Bytes (Keamanan ketat)
        const type = await fileTypeFromFile(inputPath);
        if (!type || type.mime !== 'application/pdf') {
            cleanupFiles([inputPath]);
            return res.status(400).json({ error: 'Uploaded file is not a valid PDF.' });
        }

        // Proses kompresi via Ghostscript
        await compressPdf(inputPath, outputPath);

        // Cek apakah file output berhasil dibuat
        if (!fs.existsSync(outputPath)) {
            throw new Error('Compression failed to produce output file.');
        }

        // Set headers untuk download
        const originalName = path.basename(file.originalname, path.extname(file.originalname));
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${originalName}-compressed.pdf"`,
        });

        // Stream file ke client
        const stream = fs.createReadStream(outputPath);
        stream.pipe(res);

        // Auto-cleanup file setelah download selesai atau jika ada error stream
        stream.on('end', () => {
            cleanupFiles([inputPath, outputPath]);
        });
        stream.on('error', () => {
            cleanupFiles([inputPath, outputPath]);
        });

    } catch (error) {
        console.error('[Compress Error]:', error.message);
        
        // Cleanup file jika terjadi error
        cleanupFiles([inputPath, outputPath]);

        const statusCode = error.message.includes('not a valid PDF') ? 400 : 500;
        res.status(statusCode).json({ error: error.message });
    }
});

module.exports = router;