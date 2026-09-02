const fs = require('fs');

/**
 * Menghapus file dari disk secara aman.
 * @param {string} filePath - Path absolut file yang akan dihapus.
 */
function deleteFile(filePath) {
    if (!filePath) return;
    
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[Cleanup] File berhasil dihapus: ${filePath}`);
        }
    } catch (error) {
        // Jika file terkunci (EBUSY), coba lagi setelah 2 detik
        if (error.code === 'EBUSY') {
            console.warn(`[Cleanup] File terkunci, mencoba ulang dalam 2 detik: ${filePath}`);
            setTimeout(() => {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`[Cleanup] File berhasil dihapus (retry): ${filePath}`);
                    }
                } catch (retryError) {
                    console.error(`[Cleanup] Gagal menghapus file setelah retry ${filePath}:`, retryError.message);
                }
            }, 2000);
        } else {
            console.error(`[Cleanup] Gagal menghapus file ${filePath}:`, error.message);
        }
    }
}

/**
 * Langsung menghapus file upload dan file hasil konversi.
 * Bisa dipanggil dari callback res.download() untuk keandalan maksimal.
 * @param {object} req - Express request object.
 */
function cleanupFiles(req) {
    if (req.file && req.file.path) {
        deleteFile(req.file.path);
    }
    if (req.convertedPdfPath) {
        deleteFile(req.convertedPdfPath);
    }
}

/**
 * Menjadwalkan pembersihan file sebagai FALLBACK.
 * Ini adalah jaring pengaman jika callback res.download() tidak terpicu
 * (misal client disconnect di tengah proses).
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
function scheduleCleanup(req, res) {
    let cleaned = false;

    const doCleanup = () => {
        if (cleaned) return; // Cegah cleanup ganda
        cleaned = true;

        // Delay 3 detik untuk memastikan file sudah selesai dikirim
        // dan file lock sudah dilepas oleh OS
        setTimeout(() => {
            cleanupFiles(req);
        }, 3000);
    };

    // Fallback: jika response selesai atau koneksi ditutup
    res.on('finish', doCleanup);
    res.on('close', doCleanup);
}

module.exports = {
    scheduleCleanup,
    cleanupFiles,
    deleteFile
};