const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

/**
 * Menggabungkan beberapa file PDF menjadi satu.
 * @param {string[]} filePaths - Array berisi path absolut ke file PDF.
 * @returns {Promise<Buffer>} - Buffer berisi PDF yang sudah digabung.
 */
async function mergePdfs(filePaths) {
    const mergedPdf = await PDFDocument.create();

    for (const filePath of filePaths) {
        // Baca file PDF
        const pdfBytes = fs.readFileSync(filePath);
        
        // Load PDF ke pdf-lib
        const pdf = await PDFDocument.load(pdfBytes, { 
            ignoreEncryption: true, // Abaikan PDF yang ter-encrypt (read-only)
            updateMetadata: false 
        });

        // Copy semua halaman dari PDF ini ke PDF gabungan
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    // Simpan sebagai Buffer (Uint8Array)
    const mergedPdfBytes = await mergedPdf.save();
    return Buffer.from(mergedPdfBytes);
}

module.exports = { mergePdfs };