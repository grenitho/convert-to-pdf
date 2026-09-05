const express = require('express');
const multer = require('multer');
const path = require('path');
const FileType = require('file-type');
const { mergePdfs } = require('../services/merger');
const { cleanupFiles } = require('../middleware/cleanup');

const router = express.Router();

// Multer setup untuk multiple files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.env.UPLOAD_DIR || './tmp/uploads');
    },
    filename: (req, file, cb) => {
        // Sanitize filename & buat unik untuk mencegah collision
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'merge-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 40 * 1024 * 1024, // 40MB per file
        files: 10 // Maksimal 10 file
    },
    fileFilter: (req, file, cb) => {
        // Filter awal berdasarkan ekstensi dan mimetype
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed for merging.'));
        }
    }
});

// Endpoint POST /api/merge
router.post('/merge', upload.array('files', 10), async (req, res) => {
    const uploadedFiles = req.files || [];
    const filePaths = uploadedFiles.map(f => f.path);

    try {
        // Validasi jumlah file
        if (uploadedFiles.length < 2) {
            throw new Error('Please upload at least 2 PDF files to merge.');
        }

        // Validasi Magic Bytes untuk semua file (Keamanan ketat)
        for (const file of uploadedFiles) {
            const type = await FileType.fromFile(file.path);
            if (!type || type.mime !== 'application/pdf') {
                throw new Error(`File "${file.originalname}" is not a valid PDF.`);
            }
        }

        // Proses merge
        const mergedBuffer = await mergePdfs(filePaths);

        // Set headers untuk download
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="merged-${Date.now()}.pdf"`,
            'Content-Length': mergedBuffer.length
        });

        // Kirim file
        res.send(mergedBuffer);

        // Cleanup file uploaded setelah berhasil dikirim
        cleanupFiles(filePaths);

    } catch (error) {
        console.error('[Merge Error]:', error.message);
        
        // Cleanup file jika terjadi error
        if (filePaths.length > 0) {
            cleanupFiles(filePaths);
        }

        const statusCode = error.message.includes('valid PDF') || error.message.includes('at least 2') ? 400 : 500;
        res.status(statusCode).json({ error: error.message });
    }
});

module.exports = router;