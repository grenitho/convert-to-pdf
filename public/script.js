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
const progressContainer = document.getElementById('progressContainer');
const progressPercentage = document.getElementById('progressPercentage');
const progressBarFill = document.getElementById('progressBarFill');
const progressStatus = document.getElementById('progressStatus');
const progressSize = document.getElementById('progressSize');

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
uploadForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Prevent default form submission

    const file = fileInput.files[0];
    if (!file) {
        showMessage('Please select a file first', 'error');
        return;
    }

    // Validasi ukuran file di frontend (sekadar UX, validasi sebenarnya di backend)
    const maxSize = 40 * 1024 * 1024; // 40MB
    if (file.size > maxSize) {
        showMessage(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum 40MB.`, 'error');
        return;
    }

    // Warning untuk file besar (>25MB)
    if (file.size > 25 * 1024 * 1024) {
        showMessage('⚠️ Large file (>25MB) will take longer to convert. Please be patient...', 'info');
        // Jangan return, lanjutkan proses
    }

    // Tampilkan loading state dan progress bar
    setLoadingState(true);
    showProgress();
    updateProgress(0, 'Uploading...');

    // Prepare FormData
    const formData = new FormData();
    formData.append('file', file);

    // Use XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            updateProgress(percentComplete, 'Uploading...');
        }
    });

    // Handle response
    xhr.onload = () => {
        if (xhr.status === 200) {
            // Conversion complete
            updateProgress(100, 'Download starting...');

            // Extract filename from Content-Disposition header
            const contentDisposition = xhr.getResponseHeader('Content-Disposition');
            let filename = 'converted.pdf';

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            // Create blob and trigger download
            const blob = new Blob([xhr.response], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Show success message
            showMessage('File successfully converted and downloaded!', 'success');

            // Save to history
            saveHistory(file.name, filename, file.size);

            // Reset form
            fileInput.value = '';
            fileText.textContent = 'Select File (Max 40MB)';
            fileText.classList.remove('file-selected');
            submitBtn.disabled = true;
            hideFilePreview();

            // Hide progress bar after 1 second
            setTimeout(() => {
                hideProgress();
            }, 1000);

        } else {
            // Error handling
            let errorMessage = 'An error occurred. Please try again.';
            try {
                const errorData = JSON.parse(xhr.responseText);
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `Server error: ${xhr.status}`;
            }
            showMessage(errorMessage, 'error');
            hideProgress();
        }

        // Matikan loading state
        setLoadingState(false);
    };

    // Handle network errors
    xhr.onerror = () => {
        showMessage('Network error. Please check your connection and try again.', 'error');
        hideProgress();
        setLoadingState(false);
    };

    // Handle timeout (optional, 5 minutes)
    xhr.timeout = 300000; // 5 minutes
    xhr.ontimeout = () => {
        showMessage('Conversion timeout. File may be too large or corrupted. Please try again.', 'error');
        hideProgress();
        setLoadingState(false);
    };

    // Open and send request
    xhr.open('POST', '/api/convert', true);
    xhr.responseType = 'blob';
    xhr.send(formData);
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
// 11. Progress Bar Functions
// ==========================================
function showProgress() {
    progressContainer.classList.add('visible');
}

function hideProgress() {
    progressContainer.classList.remove('visible');
    progressBarFill.style.width = '0%';
    progressPercentage.textContent = '0%';
    progressStatus.textContent = 'Preparing...';
    progressSize.textContent = '';
}

function updateProgress(percent, status) {
    const roundedPercent = Math.round(percent);
    progressBarFill.style.width = roundedPercent + '%';
    progressPercentage.textContent = roundedPercent + '%';
    progressStatus.textContent = status;

    // Add animation class
    if (percent > 0 && percent < 100) {
        progressBarFill.classList.add('animating');
    } else {
        progressBarFill.classList.remove('animating');
    }
}

// ==========================================
// 12. PWA: Register Service Worker
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