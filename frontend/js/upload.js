(function () {
  let hasCleared = false;

  async function loadFolders() {
    try {
      const { folders } = await DVApi.get('/folders/contents?folderId=root');
      const select = document.getElementById('folder-select');
      folders.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        select.appendChild(opt);
      });
    } catch {
      /* non-fatal -- root upload still works */
    }
  }

  async function loadSidebarStorage() {
    try {
      const usage = await DVApi.get('/files/usage');
      const pct = Math.min(100, Math.round((usage.usedBytes / (usage.quotaMb * 1024 * 1024)) * 100));
      document.getElementById('sidebar-storage-bar').style.width = pct + '%';
      document.getElementById('sidebar-storage-text').textContent = pct + '%';
    } catch {
      /* ignore */
    }
  }

  function iconSvgFor(type) {
    if (type === 'application/pdf') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg>';
    if (type.startsWith('image/')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/></svg>';
  }

  function clearEmptyState() {
    const list = document.getElementById('upload-list');
    if (!hasCleared) {
      list.innerHTML = '';
      hasCleared = true;
    }
  }

  function addUploadRow(file) {
    clearEmptyState();
    const list = document.getElementById('upload-list');
    const row = document.createElement('div');
    row.className = 'upload-row';
    const id = `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    row.id = id;
    row.innerHTML = `
      <span class="file-icon other" style="flex-shrink:0;">${iconSvgFor(file.type)}</span>
      <div class="flex-1">
        <div class="row" style="justify-content:space-between;">
          <b class="text-sm">${escapeHtml(file.name)}</b>
          <span class="text-xs mono text-faint status">${DVLayout.formatBytes(file.size)}</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:0%;"></div></div>
      </div>
    `;
    list.prepend(row);
    return row;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function uploadFile(file) {
    const row = addUploadRow(file);
    const bar = row.querySelector('.bar-fill');
    const status = row.querySelector('.status');
    const folderId = document.getElementById('folder-select').value || undefined;

    try {
      await DVApi.uploadSmart(file, {
        folderId,
        onProgress: (pct) => {
          bar.style.width = pct + '%';
          status.textContent = `${pct}%`;
        },
      });
      row.classList.add('done');
      bar.style.width = '100%';
      status.textContent = 'Done';
      loadSidebarStorage();
    } catch (err) {
      row.classList.add('error');
      status.textContent = 'Failed';
      DVToast.error(`Could not upload ${file.name}`, err.message);
    }
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    files.forEach(uploadFile);
  }

  function initDropzone() {
    const zone = document.getElementById('dropzone');
    const input = document.getElementById('file-input');

    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      handleFiles(input.files);
      input.value = '';
    });

    ['dragenter', 'dragover'].forEach((evt) =>
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      })
    );
    ['dragleave', 'drop'].forEach((evt) =>
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
      })
    );
    zone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
  }

  document.getElementById('clear-done')?.addEventListener('click', () => {
    document.querySelectorAll('.upload-row.done, .upload-row.error').forEach((el) => el.remove());
    if (!document.getElementById('upload-list').children.length) {
      hasCleared = false;
      document.getElementById('upload-list').innerHTML = `
        <div class="empty-state" style="padding:2.5rem 1rem;">
          <span class="seal seal-sm" style="margin:0 auto 0.8rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3m0 12-4-4m4 4 4-4"/></svg></span>
          <p class="text-sm">Files you upload will appear here with live progress.</p>
        </div>`;
    }
  });

  async function init() {
    const user = DVLayout.initShell();
    if (!user) return;
    await Promise.all([loadFolders(), loadSidebarStorage()]);
    initDropzone();
    document.getElementById('loading-screen').classList.add('hide');
  }

  init();
})();
