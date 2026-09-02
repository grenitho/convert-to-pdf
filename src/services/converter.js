const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const treeKill = require('tree-kill');
const config = require('../config');

// Tentukan nama executable LibreOffice berdasarkan OS
// Windows biasanya menggunakan soffice.exe, Linux menggunakan soffice
const LIBREOFFICE_CMD = process.platform === 'win32' ? 'soffice.exe' : 'soffice';

/**
 * Mengkonversi file ke PDF menggunakan LibreOffice headless.
 * @param {string} inputFilePath - Path absolut ke file yang akan dikonversi.
 * @param {string} outputDir - Path absolut ke folder tujuan PDF.
 * @returns {Promise<string>} - Resolve dengan path file PDF hasil konversi.
 */
function convertToPdf(inputFilePath, outputDir) {
    return new Promise((resolve, reject) => {
        // Argumen untuk LibreOffice Headless
        const args = [
            '--headless',
            '--invisible',
            '--nodefault',
            '--nofirststartwizard',
            '--nolockcheck',
            '--norestore',
            '--convert-to', 'pdf',
            '--outdir', outputDir,
            inputFilePath
        ];

        const child = spawn(LIBREOFFICE_CMD, args);
        let isTimeout = false;
        let stderrData = '';

        // 1. Setup Timeout & Tree-Kill (Pencegahan Zombie Process)
        const timeoutId = setTimeout(() => {
            isTimeout = true;
            if (child.pid) {
                console.warn(`[Converter] Timeout tercapai. Mematikan paksa PID: ${child.pid}`);
                // tree-kill memastikan semua child-process dari LibreOffice juga ikut mati
                treeKill(child.pid, 'SIGKILL', (err) => {
                    if (err) console.error(`[Converter] Error killing process ${child.pid}:`, err);
                });
            }
            reject(new Error('Konversi timeout. LibreOffice tidak merespon (kemungkinan file korup).'));
        }, config.conversionTimeout);

        // 2. Tangkap error output dari LibreOffice
        child.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        // 3. Handle saat proses selesai
        child.on('close', (code) => {
            clearTimeout(timeoutId);

            if (isTimeout) return; // Jika sudah timeout, abaikan event close ini

            if (code !== 0) {
                return reject(new Error(`LibreOffice gagal konversi (Exit code: ${code}). Detail: ${stderrData}`));
            }

            // Tentukan path file PDF hasil konversi
            const baseName = path.basename(inputFilePath, path.extname(inputFilePath));
            const outputPdfPath = path.join(outputDir, `${baseName}.pdf`);

            // Verifikasi file PDF benar-benar tercipta
            if (fs.existsSync(outputPdfPath)) {
                resolve(outputPdfPath);
            } else {
                reject(new Error('File PDF hasil konversi tidak ditemukan di direktori output.'));
            }
        });

        // 4. Handle error jika executable LibreOffice tidak ditemukan
        child.on('error', (err) => {
            clearTimeout(timeoutId);
            if (err.code === 'ENOENT') {
                reject(new Error(`Perintah '${LIBREOFFICE_CMD}' tidak ditemukan. Pastikan LibreOffice sudah diinstal dan terdaftar di PATH sistem.`));
            } else {
                reject(err);
            }
        });
    });
}

module.exports = { convertToPdf };