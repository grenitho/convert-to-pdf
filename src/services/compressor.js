const { execFile } = require('child_process');

/**
 * Compress a PDF file using Ghostscript.
 * @param {string} inputPath - Absolute path to the input PDF.
 * @param {string} outputPath - Absolute path to the output PDF.
 * @returns {Promise<void>}
 */
function compressPdf(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        // Security: Use execFile with arguments array to prevent Command Injection.
        // Never concatenate strings into the command line.
        const args = [
            '-sDEVICE=pdfwrite',
            '-dCompatibilityLevel=1.4',
            '-dPDFSETTINGS=/ebook', // Good balance: 150dpi, decent quality, smaller size
            '-dNOPAUSE',
            '-dQUIET',
            '-dBATCH',
            `-sOutputFile=${outputPath}`,
            inputPath
        ];

        // Timeout: 60 seconds (60000 ms) to prevent hanging and resource exhaustion
        execFile('gs', args, { timeout: 60000 }, (error, stdout, stderr) => {
            if (error) {
                if (error.killed) {
                    reject(new Error('Compression timeout. The file might be too complex or large.'));
                } else {
                    reject(new Error('Failed to compress PDF. The file might be corrupted.'));
                }
            } else {
                resolve();
            }
        });
    });
}

module.exports = { compressPdf };