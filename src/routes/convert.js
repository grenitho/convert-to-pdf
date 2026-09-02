const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const { upload, validateExtension, validateMagicBytes } = require('../middleware/fileValidation');
const { scheduleCleanup } = require('../middleware/cleanup');
const queue = require('../services/queue');
const { convertToPdf } = require('../services/converter');
const config = require('../config');

/**
 * POST /api/convert
 * Endpoint utama untuk upload file dan convert ke PDF
 */
router.post('/convert',
    // 1. Middleware upload file (multer)
    upload,

    // 2. Middleware validasi ekstensi file
    validateExtension,

    // 3. Middleware validasi magic bytes (file-type)
    validateMagicBytes,

    // 4. Handler utama
    async (req, res, next) => {
        try {
            const inputFile = req.file;

            if (!inputFile) {
                return res.status(400).json({ error: 'Tidak ada file yang diupload' });
            }

            console.log(`[Convert] Menerima file: ${inputFile.originalname} (${inputFile.size} bytes)`);

            // 5. Masukkan ke queue untuk antrian konversi
            const pdfPath = await queue.add(async () => {
                console.log(`[Queue] Memulai konversi: ${inputFile.originalname}`);

                // Panggil converter untuk convert file ke PDF
                const resultPath = await convertToPdf(
                    inputFile.path,
                    config.convertedDir
                );

                console.log(`[Queue] Konversi selesai: ${path.basename(resultPath)}`);
                return resultPath;
            });

            // 6. Simpan path PDF ke request object (untuk cleanup nanti)
            req.convertedPdfPath = pdfPath;

            // 7. Jadwalkan cleanup (hapus file setelah response selesai)
            scheduleCleanup(req, res);

            // 8. Kirim file PDF ke user
            const pdfFileName = path.basename(pdfPath);
            res.download(pdfPath, pdfFileName, (err) => {
                if (err) {
                    console.error('[Convert] Error saat mengirim file PDF:', err);
                }

                // 9. Panggil cleanup langsung di callback (lebih andal daripada event listener)
                // Ini memastikan file dihapus SETELAH response selesai dikirim
                const { cleanupFiles } = require('../middleware/cleanup');
                cleanupFiles(req);
            });

        } catch (error) {
            console.error('[Convert] Error saat konversi:', error);

            // Cleanup file upload jika ada error sebelum scheduleCleanup dipanggil
            if (req.file && req.file.path && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            next(error);
        }
    }
);

/**
 * GET /api/health
 * Endpoint untuk cek status service dan LibreOffice
 */
router.get('/health', (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        queue: {
            size: queue.size,
            pending: queue.pending,
            concurrency: 1
        },
        config: {
            maxFileSize: config.maxFileSize,
            conversionTimeout: config.conversionTimeout,
            nodeEnv: config.nodeEnv
        }
    };

    res.json(health);
});

module.exports = router;