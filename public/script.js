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
        fileText.textContent = 'Pilih File (Maks 25MB)';
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
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
        showMessage(`Ukuran file terlalu besar (${(file.size / 1024 / 1024).toFixed(2)}MB). Maksimal 25MB.`, 'error');
        return;
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