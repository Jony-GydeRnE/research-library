(() => {
  const dropZone = document.getElementById('dropZone');
  const dropContent = document.getElementById('dropContent');
  const fileInput = document.getElementById('fileInput');
  const uploadProgress = document.getElementById('uploadProgress');
  const uploadSuccess = document.getElementById('uploadSuccess');
  const uploadError = document.getElementById('uploadError');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const progressLabel = document.getElementById('progressLabel');
  const progressPct = document.getElementById('progressPct');
  const progressFill = document.getElementById('progressFill');
  const progressDetail = document.getElementById('progressDetail');
  const successTitle = document.getElementById('successTitle');
  const successDetail = document.getElementById('successDetail');
  const openBookBtn = document.getElementById('openBookBtn');
  const errorDetail = document.getElementById('errorDetail');

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function showState(state) {
    dropContent.style.display = state === 'idle' ? '' : 'none';
    uploadProgress.style.display = state === 'progress' ? '' : 'none';
    uploadSuccess.style.display = state === 'success' ? '' : 'none';
    uploadError.style.display = state === 'error' ? '' : 'none';
  }

  function reset() {
    showState('idle');
    fileInput.value = '';
    progressFill.style.width = '0%';
    dropZone.classList.remove('drag-over');
  }

  // Drag and drop
  ['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      handleFile(files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFile(fileInput.files[0]);
    }
  });

  document.getElementById('uploadAnotherBtn').addEventListener('click', reset);
  document.getElementById('retryBtn').addEventListener('click', reset);

  async function handleFile(file) {
    showState('progress');
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    progressLabel.textContent = 'Uploading...';
    progressPct.textContent = '0%';
    progressDetail.textContent = '';
    progressFill.style.width = '0%';

    const formData = new FormData();
    formData.append('pdf', file);
    // Pass collectionId if present in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('collectionId')) {
      formData.append('collectionId', urlParams.get('collectionId'));
    }

    try {
      // Upload with XHR for progress tracking
      const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            progressPct.textContent = pct + '%';
            progressFill.style.width = pct + '%';
          }
        };

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(data);
            }
          } catch {
            reject({ error: 'Invalid server response' });
          }
        };

        xhr.onerror = () => reject({ error: 'Network error' });
        xhr.send(formData);
      });

      // Upload complete — now track processing
      progressLabel.textContent = 'Processing...';
      progressDetail.textContent = 'Extracting text from PDF';
      trackProcessing(response.bookId, response.title);

    } catch (err) {
      showState('error');
      errorDetail.textContent = err.error || 'Something went wrong';
    }
  }

  function trackProcessing(bookId, title) {
    const evtSource = new EventSource(`/upload/progress/${bookId}`);

    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.error) {
        evtSource.close();
        showState('error');
        errorDetail.textContent = data.error;
        return;
      }

      const pct = data.progress || 0;
      progressPct.textContent = pct + '%';
      progressFill.style.width = pct + '%';

      if (pct <= 50) {
        progressLabel.textContent = 'Extracting text...';
        progressDetail.textContent = data.pageCount
          ? `Found ${data.pageCount} pages`
          : 'Reading PDF structure';
      } else {
        progressLabel.textContent = 'Generating HTML...';
        progressDetail.textContent = `Building readable pages (${pct}%)`;
      }

      if (data.status === 'ready') {
        evtSource.close();
        showState('success');
        successTitle.textContent = data.title || title || 'Book ready';
        successDetail.textContent = `${data.pageCount || ''} pages processed successfully`;
        openBookBtn.href = `/reader/${bookId}`;
      }

      if (data.status === 'error') {
        evtSource.close();
        showState('error');
        errorDetail.textContent = 'Processing failed. Check the error log.';
      }
    };

    evtSource.onerror = () => {
      evtSource.close();
      // Don't show error — may just be the stream ending
    };
  }
})();
