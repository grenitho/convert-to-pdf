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
const deleteTimer = document.getElementById('deleteTimer');
const timerCountdown = document.getElementById('timerCountdown');
let deleteTimerInterval = null;

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
        fileText.textContent = 'Select File (Max 40MB)';
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

            // Start auto delete timer
            startDeleteTimer();

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
        btnText.textContent = 'Converting...';
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
        // Stop previous delete timer if any
        stopDeleteTimer();
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
    stopDeleteTimer();
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
// 12. Auto Delete Timer Logic
// ==========================================
function startDeleteTimer() {
    let timeLeft = 3600; // 60 minutes in seconds (matches cron job)
    deleteTimer.classList.add('visible');

    // Clear any existing interval
    if (deleteTimerInterval) clearInterval(deleteTimerInterval);

    updateTimerDisplay(timeLeft);

    deleteTimerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(deleteTimerInterval);
            deleteTimerInterval = null;
            deleteTimer.classList.remove('visible');
        } else {
            updateTimerDisplay(timeLeft);
        }
    }, 1000);
}

function stopDeleteTimer() {
    if (deleteTimerInterval) {
        clearInterval(deleteTimerInterval);
        deleteTimerInterval = null;
    }
    deleteTimer.classList.remove('visible');
}

function updateTimerDisplay(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerCountdown.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ==========================================
// 13. Tab System & Merge PDF Logic
// ==========================================
const tabBtns = document.querySelectorAll('.tab-btn');
const convertSection = document.getElementById('convertSection');
const mergeSection = document.getElementById('mergeSection');
const compressSection = document.getElementById('compressSection');

// Tab Switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all tabs
        tabBtns.forEach(b => b.classList.remove('active'));
        // Add active to clicked tab
        btn.classList.add('active');

        // Show/hide sections
        const target = btn.getAttribute('data-target');
        if (target === 'convert') {
            convertSection.style.display = 'block';
            mergeSection.style.display = 'none';
            compressSection.style.display = 'none';
        } else if (target === 'merge') {
            convertSection.style.display = 'none';
            mergeSection.style.display = 'block';
            compressSection.style.display = 'none';
        } else {
            convertSection.style.display = 'none';
            mergeSection.style.display = 'none';
            compressSection.style.display = 'block';
        }

        // Clear messages and stop timer when switching tabs
        hideMessage();
        stopDeleteTimer();
    });
});

// Merge PDF Variables
const mergeFileInput = document.getElementById('mergeFileInput');
const mergeFileText = document.getElementById('mergeFileText');
const mergeSubmitBtn = document.getElementById('mergeSubmitBtn');
const mergeFileList = document.getElementById('mergeFileList');
const mergeProgressContainer = document.getElementById('mergeProgressContainer');
const mergeProgressPercentage = document.getElementById('mergeProgressPercentage');
const mergeProgressBarFill = document.getElementById('mergeProgressBarFill');
const mergeProgressStatus = document.getElementById('mergeProgressStatus');
const mergeLoadingSpinner = document.getElementById('mergeLoadingSpinner');
const mergeBtnText = document.getElementById('mergeBtnText');
const mergeForm = document.getElementById('mergeForm');

// Array to hold selected files (easier to manage add/remove than input.files)
let selectedMergeFiles = [];

// Handle Merge File Input Change
mergeFileInput.addEventListener('change', (e) => {
    const newFiles = Array.from(e.target.files);

    // Filter only PDFs
    const pdfFiles = newFiles.filter(f =>
        f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    // Add to array, avoiding duplicates by name+size
    pdfFiles.forEach(file => {
        const isDuplicate = selectedMergeFiles.some(f => f.name === file.name && f.size === file.size);
        if (!isDuplicate) {
            selectedMergeFiles.push(file);
        }
    });

    // Limit to 10 files
    if (selectedMergeFiles.length > 10) {
        showMessage('Maximum 10 files allowed for merging.', 'error');
        selectedMergeFiles = selectedMergeFiles.slice(0, 10);
    }

    updateMergeUI();
});

// Update Merge UI based on selected files
function updateMergeUI() {
    if (selectedMergeFiles.length > 0) {
        mergeFileText.textContent = `${selectedMergeFiles.length} File(s) Selected`;
        mergeFileText.classList.add('file-selected');
        mergeSubmitBtn.disabled = false;
    } else {
        mergeFileText.textContent = 'Choose PDF Files (Max 10 files, 40MB each)';
        mergeFileText.classList.remove('file-selected');
        mergeSubmitBtn.disabled = true;
    }
    renderMergeFileList();
}

// Render the list of selected merge files
function renderMergeFileList() {
    mergeFileList.innerHTML = '';
    selectedMergeFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'merge-file-item';
        item.innerHTML = `
            <span class="merge-file-name">${escapeHtml(file.name)}</span>
            <span class="merge-file-size">${formatFileSize(file.size)}</span>
            <button type="button" class="merge-file-remove" data-index="${index}" aria-label="Remove file">×</button>
        `;
        mergeFileList.appendChild(item);
    });

    // Add event listeners to remove buttons
    document.querySelectorAll('.merge-file-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            selectedMergeFiles.splice(index, 1);
            // Reset input value to allow re-adding the same file if needed
            mergeFileInput.value = '';
            updateMergeUI();
        });
    });
}

// Handle Merge Form Submission
mergeForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (selectedMergeFiles.length < 2) {
        showMessage('Please select at least 2 PDF files to merge.', 'error');
        return;
    }

    // Validate sizes (Max 40MB per file)
    const maxSize = 40 * 1024 * 1024;
    for (const file of selectedMergeFiles) {
        if (file.size > maxSize) {
            showMessage(`File "${file.name}" is too large (Max 40MB).`, 'error');
            return;
        }
    }

    // UI Updates: Loading state
    mergeSubmitBtn.disabled = true;
    mergeBtnText.textContent = 'Merging...';
    mergeLoadingSpinner.style.display = 'inline-block';
    mergeProgressContainer.classList.add('visible');
    mergeProgressStatus.textContent = 'Uploading...';
    mergeProgressBarFill.style.width = '0%';
    mergeProgressPercentage.textContent = '0%';
    hideMessage();

    // Prepare FormData
    const formData = new FormData();
    selectedMergeFiles.forEach(file => {
        formData.append('files', file);
    });

    // Use XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            mergeProgressBarFill.style.width = percent + '%';
            mergeProgressPercentage.textContent = percent + '%';
        }
    });

    // Handle response
    xhr.onload = () => {
        if (xhr.status === 200) {
            mergeProgressStatus.textContent = 'Download starting...';
            mergeProgressBarFill.style.width = '100%';
            mergeProgressPercentage.textContent = '100%';

            // Extract filename
            const contentDisposition = xhr.getResponseHeader('Content-Disposition');
            let filename = 'merged.pdf';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) filename = match[1];
            }

            // Trigger download
            const blob = new Blob([xhr.response], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showMessage('Files successfully merged and downloaded!', 'success');

            // Reset form
            selectedMergeFiles = [];
            mergeFileInput.value = '';
            updateMergeUI();

            // Hide progress after 1.5 seconds
            setTimeout(() => {
                mergeProgressContainer.classList.remove('visible');
                mergeSubmitBtn.disabled = false;
                mergeBtnText.textContent = 'Merge PDFs';
                mergeLoadingSpinner.style.display = 'none';
            }, 1500);

        } else {
            // Error handling
            let errorMsg = 'An error occurred during merging.';
            try {
                const err = JSON.parse(xhr.responseText);
                errorMsg = err.error || errorMsg;
            } catch (e) { }

            showMessage(errorMsg, 'error');
            mergeProgressContainer.classList.remove('visible');
            mergeSubmitBtn.disabled = false;
            mergeBtnText.textContent = 'Merge PDFs';
            mergeLoadingSpinner.style.display = 'none';
        }
    };

    // Handle network errors
    xhr.onerror = () => {
        showMessage('Network error. Please check your connection.', 'error');
        mergeProgressContainer.classList.remove('visible');
        mergeSubmitBtn.disabled = false;
        mergeBtnText.textContent = 'Merge PDFs';
        mergeLoadingSpinner.style.display = 'none';
    };

    // Handle timeout (5 minutes)
    xhr.timeout = 300000;
    xhr.ontimeout = () => {
        showMessage('Merging timeout. Please try again with smaller files.', 'error');
        mergeProgressContainer.classList.remove('visible');
        mergeSubmitBtn.disabled = false;
        mergeBtnText.textContent = 'Merge PDFs';
        mergeLoadingSpinner.style.display = 'none';
    };

    // Send request
    xhr.open('POST', '/api/merge', true);
    xhr.responseType = 'blob';
    xhr.send(formData);
});

// ==========================================
// 14. Compress PDF Logic
// ==========================================
const compressFileInput = document.getElementById('compressFileInput');
const compressFileText = document.getElementById('compressFileText');
const compressSubmitBtn = document.getElementById('compressSubmitBtn');
const compressFilePreview = document.getElementById('compressFilePreview');
const compressPreviewName = document.getElementById('compressPreviewName');
const compressPreviewType = document.getElementById('compressPreviewType');
const compressPreviewSize = document.getElementById('compressPreviewSize');
const compressRemoveFileBtn = document.getElementById('compressRemoveFileBtn');
const compressProgressContainer = document.getElementById('compressProgressContainer');
const compressProgressPercentage = document.getElementById('compressProgressPercentage');
const compressProgressBarFill = document.getElementById('compressProgressBarFill');
const compressProgressStatus = document.getElementById('compressProgressStatus');
const compressLoadingSpinner = document.getElementById('compressLoadingSpinner');
const compressBtnText = document.getElementById('compressBtnText');
const compressForm = document.getElementById('compressForm');

// Handle Compress File Input Change
compressFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        compressFileText.textContent = file.name;
        compressFileText.classList.add('file-selected');
        compressSubmitBtn.disabled = false;

        // Show preview
        compressPreviewName.textContent = file.name;
        compressPreviewType.textContent = getFileTypeLabel(file.type);
        compressPreviewSize.textContent = formatFileSize(file.size);
        compressFilePreview.classList.add('visible');

        hideMessage();
    } else {
        compressFileText.textContent = 'Choose PDF File (Max 40MB)';
        compressFileText.classList.remove('file-selected');
        compressSubmitBtn.disabled = true;
        compressFilePreview.classList.remove('visible');
    }
});

// Compress Remove File
compressRemoveFileBtn.addEventListener('click', () => {
    compressFileInput.value = '';
    compressFileText.textContent = 'Choose PDF File (Max 40MB)';
    compressFileText.classList.remove('file-selected');
    compressSubmitBtn.disabled = true;
    compressFilePreview.classList.remove('visible');
    hideMessage();
});

// Handle Compress Form Submission
compressForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const file = compressFileInput.files[0];
    if (!file) {
        showMessage('Please select a PDF file first.', 'error');
        return;
    }
    if (file.size > 40 * 1024 * 1024) {
        showMessage('File too large (Max 40MB).', 'error');
        return;
    }

    // UI Loading
    compressSubmitBtn.disabled = true;
    compressBtnText.textContent = 'Compressing...';
    compressLoadingSpinner.style.display = 'inline-block';
    compressProgressContainer.classList.add('visible');
    compressProgressStatus.textContent = 'Uploading...';
    compressProgressBarFill.style.width = '0%';
    compressProgressPercentage.textContent = '0%';
    hideMessage();

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            compressProgressBarFill.style.width = percent + '%';
            compressProgressPercentage.textContent = percent + '%';
        }
    });

    xhr.onload = () => {
        if (xhr.status === 200) {
            compressProgressStatus.textContent = 'Download starting...';
            compressProgressBarFill.style.width = '100%';
            compressProgressPercentage.textContent = '100%';

            const contentDisposition = xhr.getResponseHeader('Content-Disposition');
            let filename = 'compressed.pdf';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) filename = match[1];
            }

            const blob = new Blob([xhr.response], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showMessage('File successfully compressed and downloaded!', 'success');

            // Reset
            compressFileInput.value = '';
            compressFileText.textContent = 'Choose PDF File (Max 40MB)';
            compressFileText.classList.remove('file-selected');
            compressSubmitBtn.disabled = true;
            compressFilePreview.classList.remove('visible');

            setTimeout(() => {
                compressProgressContainer.classList.remove('visible');
                compressBtnText.textContent = 'Compress PDF';
                compressLoadingSpinner.style.display = 'none';
            }, 1500);

        } else {
            let errorMsg = 'An error occurred during compression.';
            try {
                const err = JSON.parse(xhr.responseText);
                errorMsg = err.error || errorMsg;
            } catch (e) { }
            showMessage(errorMsg, 'error');
            compressProgressContainer.classList.remove('visible');
            compressSubmitBtn.disabled = false;
            compressBtnText.textContent = 'Compress PDF';
            compressLoadingSpinner.style.display = 'none';
        }
    };

    xhr.onerror = () => {
        showMessage('Network error. Please check your connection.', 'error');
        compressProgressContainer.classList.remove('visible');
        compressSubmitBtn.disabled = false;
        compressBtnText.textContent = 'Compress PDF';
        compressLoadingSpinner.style.display = 'none';
    };

    xhr.timeout = 300000; // 5 minutes
    xhr.ontimeout = () => {
        showMessage('Compression timeout. Please try again.', 'error');
        compressProgressContainer.classList.remove('visible');
        compressSubmitBtn.disabled = false;
        compressBtnText.textContent = 'Compress PDF';
        compressLoadingSpinner.style.display = 'none';
    };

    xhr.open('POST', '/api/compress', true);
    xhr.responseType = 'blob';
    xhr.send(formData);
});

// ==========================================
// 15. PWA: Register Service Worker
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