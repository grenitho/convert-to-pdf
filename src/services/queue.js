const PQueue = require('p-queue').default;

// Concurrency = 1: Hanya 1 proses LibreOffice yang jalan bersamaan.
// Ini WAJIB untuk VPS kecil (1-2GB RAM) karena setiap proses LibreOffice
// bisa memakan 200-500MB RAM. Jika concurrency > 1, VPS bisa OOM-kill.
// Nanti kalau VPS sudah upgrade ke 4GB+ RAM, bisa dinaikkan ke 2.
const queue = new PQueue({ concurrency: 1 });

module.exports = queue;