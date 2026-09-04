// 1. Ambil elemen-elemen DOM yang dibutuhkan
const fileInput = document.getElementById('fileInput');
const fileLabel = document.getElementById('fileLabel');
const fileText = document.getElementById('fileText');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const loadingSpinner = document.getElementById('loadingSpinner');
const uploadForm = document.getElementById('uploadForm');
const messageArea = document.getElementById('messageArea');
const messageText = document.getElementById('messageText');

// 2. Handle saat user memilih file
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];

    if (file) {
        // Update label dengan nama file
        fileText.textContent = file.name;
        fileText.classList.add('file-selected');

        // Enable tombol submit
        submitBtn.disabled = false;

        // Sembunyikan pesan sebelumnya
        hideMessage();
    } else {
        // Reset label jika file dibatalkan
        fileText.textContent = 'Pilih File (Maks 40MB)';
        fileText.classList.remove('file-selected');
        submitBtn.disabled = true;
    }
});

// 3. Handle submit form
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent default form submission

    const file = fileInput.files[0];
    if (!file) {
        showMessage('Silakan pilih file terlebih dahulu', 'error');
        return;
    }

    // Validasi ukuran file di frontend (sekadar UX, validasi sebenarnya di backend)
    const maxSize = 40 * 1024 * 1024; // 40MB
    if (file.size > maxSize) {
        showMessage(`Ukuran file terlalu besar (${(file.size / 1024 / 1024).toFixed(2)}MB). Maksimal 40MB.`, 'error');
        return;
    }

    // Warning untuk file besar (>25MB)
    if (file.size > 25 * 1024 * 1024) {
        showMessage('⚠️ File besar (>25MB) akan membutuhkan waktu lebih lama untuk dikonversi. Mohon bersabar...', 'info');
        // Jangan return, lanjutkan proses
    }

    // Tampilkan loading state
    setLoadingState(true);
    showMessage('Mengupload dan mengkonversi file... Mohon tunggu.', 'info');

    try {
        // Prepare FormData
        const formData = new FormData();
        formData.append('file', file);

        // Kirim request ke backend
        const response = await fetch('/api/convert', {
            method: 'POST',
            body: formData
        });

        // Handle response
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        // Ambil blob dari response
        const blob = await response.blob();

        // Extract filename dari Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'converted.pdf';

        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1];
            }
        }

        // Trigger download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Tampilkan pesan sukses
        showMessage('File berhasil dikonversi dan diunduh!', 'success');

        // Save to history
        saveHistory(file.name, filename, file.size);

        // Reset form
        fileInput.value = '';
        fileText.textContent = 'Pilih File (Maks 25MB)';
        fileText.classList.remove('file-selected');
        submitBtn.disabled = true;

    } catch (error) {
        console.error('[Frontend] Error:', error);

        // Handle timeout error
        if (error.name === 'AbortError') {
            showMessage('Konversi timeout. File mungkin terlalu besar atau korup. Silakan coba lagi.', 'error');
        } else {
            showMessage(error.message || 'Terjadi kesalahan. Silakan coba lagi.', 'error');
        }
    } finally {
        // Matikan loading state
        setLoadingState(false);
    }
});

// 4. Helper: Set loading state
function setLoadingState(isLoading) {
    if (isLoading) {
        submitBtn.disabled = true;
        btnText.textContent = 'Mengkonversi...';
        loadingSpinner.style.display = 'inline-block';
    } else {
        submitBtn.disabled = !fileInput.files[0]; // Enable hanya jika ada file
        btnText.textContent = 'Convert ke PDF';
        loadingSpinner.style.display = 'none';
    }
}

// 5. Helper: Tampilkan pesan
function showMessage(text, type = 'info') {
    messageText.textContent = text;
    messageArea.className = `message-area ${type}`;
    messageArea.style.display = 'block';
}

// 6. Helper: Sembunyikan pesan
function hideMessage() {
    messageArea.style.display = 'none';
}

// ==========================================
// 7. Dark Mode Toggle Logic
// ==========================================
const themeToggle = document.getElementById('themeToggle');

// Cek preferensi tema yang tersimpan, atau gunakan 'light' sebagai default
const savedTheme = localStorage.getItem('theme') || 'light';

// Terapkan tema yang tersimpan saat halaman pertama kali dimuat
if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '☀️'; // Ganti ikon jadi matahari
}

// Event listener saat tombol toggle diklik
themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');

    if (currentTheme === 'dark') {
        // Switch ke Light Mode
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        themeToggle.textContent = '🌙';
    } else {
        // Switch ke Dark Mode
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        themeToggle.textContent = '☀️';
    }
});

// ==========================================
// 8. Offline Mode Indicator Logic
// ==========================================
const offlineIndicator = document.getElementById('offlineIndicator');

// Fungsi untuk update status indicator
function updateOnlineStatus() {
    if (navigator.onLine) {
        // Online: sembunyikan indicator
        offlineIndicator.classList.remove('visible');
    } else {
        // Offline: tampilkan indicator
        offlineIndicator.classList.add('visible');
    }
}

// Cek status awal saat halaman dimuat
updateOnlineStatus();

// Listen untuk event online/offline
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ==========================================
// 9. Download History Logic
// ==========================================
const historyToggle = document.getElementById('historyToggle');
const historyContent = document.getElementById('historyContent');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// Load and render history on page load
renderHistory();

// Toggle history section expand/collapse
historyToggle.addEventListener('click', () => {
    historyToggle.classList.toggle('expanded');
    historyContent.classList.toggle('expanded');
});

// Clear all history
clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all history?')) {
        localStorage.removeItem('conversionHistory');
        renderHistory();
    }
});

// Save conversion to localStorage
function saveHistory(originalName, pdfName, fileSize) {
    const history = JSON.parse(localStorage.getItem('conversionHistory') || '[]');

    const newEntry = {
        originalName: originalName,
        pdfName: pdfName,
        fileSize: fileSize,
        timestamp: new Date().toISOString()
    };

    // Add to beginning of array (newest first)
    history.unshift(newEntry);

    // Keep only last 20 entries to prevent localStorage bloat
    if (history.length > 20) {
        history.splice(20);
    }

    localStorage.setItem('conversionHistory', JSON.stringify(history));

    // Re-render history if section is expanded
    if (historyContent.classList.contains('expanded')) {
        renderHistory();
    }
}

// Render history list from localStorage
function renderHistory() {
    const history = JSON.parse(localStorage.getItem('conversionHistory') || '[]');

    if (history.length === 0) {
        historyList.innerHTML = '<li class="history-empty">No conversion history yet</li>';
        clearHistoryBtn.style.display = 'none';
        return;
    }

    clearHistoryBtn.style.display = 'block';

    historyList.innerHTML = history.map(entry => {
        const date = new Date(entry.timestamp);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const sizeMB = (entry.fileSize / 1024 / 1024).toFixed(2);

        return `
            <li class="history-item">
                <div class="history-item-info">
                    <span class="history-item-name">${escapeHtml(entry.originalName)} → ${escapeHtml(entry.pdfName)}</span>
                    <span class="history-item-date">${formattedDate} • ${sizeMB}MB</span>
                </div>
            </li>
        `;
    }).join('');
}

// Helper: Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// 10. Drag & Drop + File Preview Logic
// ==========================================
const filePreview = document.getElementById('filePreview');
const previewName = document.getElementById('previewName');
const previewType = document.getElementById('previewType');
const previewSize = document.getElementById('previewSize');
const previewImage = document.getElementById('previewImage');
const removeFileBtn = document.getElementById('removeFileBtn');

// Prevent default drag behaviors on document
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop area when dragging over
['dragenter', 'dragover'].forEach(eventName => {
    fileLabel.addEventListener(eventName, () => {
        fileLabel.classList.add('drag-over');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    fileLabel.addEventListener(eventName, () => {
        fileLabel.classList.remove('drag-over');
    }, false);
});

// Handle dropped files
fileLabel.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
        fileInput.files = files;
        fileInput.dispatchEvent(new Event('change'));
    }
});

// Enhanced file input change handler with preview
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];

    if (file) {
        // Update label with file name
        fileText.textContent = file.name;
        fileText.classList.add('file-selected');

        // Enable submit button
        submitBtn.disabled = false;

        // Show file preview
        showFilePreview(file);

        // Hide previous messages
        hideMessage();
    } else {
        // Reset label if file is cancelled
        fileText.textContent = 'Select File (Max 40MB)';
        fileText.classList.remove('file-selected');
        submitBtn.disabled = true;
        hideFilePreview();
    }
});

// Show file preview with details
function showFilePreview(file) {
    // Update preview details
    previewName.textContent = file.name;
    previewType.textContent = getFileTypeLabel(file.type);
    previewSize.textContent = formatFileSize(file.size);

    // Show image preview for image files
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            previewImage.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        previewImage.style.display = 'none';
    }

    // Show preview container
    filePreview.classList.add('visible');
}

// Hide file preview
function hideFilePreview() {
    filePreview.classList.remove('visible');
    previewImage.style.display = 'none';
    previewImage.src = '';
}

// Remove file button handler
removeFileBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileText.textContent = 'Select File (Max 40MB)';
    fileText.classList.remove('file-selected');
    submitBtn.disabled = true;
    hideFilePreview();
    hideMessage();
});

// Helper: Get human-readable file type
function getFileTypeLabel(mimeType) {
    const typeMap = {
        'application/pdf': 'PDF',
        'application/msword': 'Word Document',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
        'application/vnd.oasis.opendocument.text': 'OpenDocument Text',
        'application/rtf': 'Rich Text Format',
        'text/plain': 'Plain Text',
        'application/vnd.ms-excel': 'Excel Spreadsheet',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
        'application/vnd.oasis.opendocument.spreadsheet': 'OpenDocument Spreadsheet',
        'text/csv': 'CSV File',
        'application/vnd.ms-powerpoint': 'PowerPoint Presentation',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint Presentation',
        'application/vnd.oasis.opendocument.presentation': 'OpenDocument Presentation',
        'image/jpeg': 'JPEG Image',
        'image/png': 'PNG Image',
        'image/bmp': 'BMP Image',
        'image/gif': 'GIF Image'
    };

    return typeMap[mimeType] || 'Unknown Type';
}

// Helper: Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// ==========================================
// 11. PWA: Register Service Worker
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('[PWA] Service Worker berhasil didaftarkan dengan scope:', registration.scope);
            })
            .catch((error) => {
                console.warn('[PWA] Gagal mendaftarkan Service Worker:', error);
            });
    });
}