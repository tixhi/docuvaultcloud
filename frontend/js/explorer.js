(function () {
  const state = {
    folderId: null, // null = root
    breadcrumbs: [],
    view: localStorage.getItem('dv_view') || 'grid',
    typeFilter: '',
    search: '',
    activeFileId: null,
  };

  const ICONS = {
    pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg>',
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M9 13h6M9 17h6M9 9h2"/></svg>',
    other: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>',
  };

  function iconFor(mime) {
    if (mime === 'application/pdf') return { cls: 'pdf', svg: ICONS.pdf };
    if (mime.startsWith('image/')) return { cls: 'img', svg: ICONS.img };
    if (mime.includes('word') || mime.startsWith('text/')) return { cls: 'doc', svg: ICONS.doc };
    return { cls: 'other', svg: ICONS.other };
  }
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('open');
    });
  });

  // --------------------------------------------------------------------
  // Data loading + rendering
  // --------------------------------------------------------------------
  async function loadContents() {
    const root = document.getElementById('explorer-root');
    root.innerHTML = '<div class="skeleton" style="height:120px; margin-bottom:1rem;"></div>';

    try {
      let folders = [];
      let files = [];
      let breadcrumbs = [];

      if (state.search || state.typeFilter) {
        const params = new URLSearchParams();
        if (state.search) params.set('search', state.search);
        if (state.typeFilter) params.set('type', state.typeFilter);
        const res = await DVApi.get(`/files?${params.toString()}`);
        files = res.files;
      } else {
        const params = new URLSearchParams({ folderId: state.folderId || 'root' });
        const res = await DVApi.get(`/folders/contents?${params.toString()}`);
        folders = res.folders;
        files = res.files;
        breadcrumbs = res.breadcrumbs;
      }

      state.breadcrumbs = breadcrumbs;
      renderBreadcrumbs();
      renderContents(folders, files);
    } catch (err) {
      root.innerHTML = `<div class="empty-state"><p>Could not load files: ${escapeHtml(err.message)}</p></div>`;
    }
  }

  function renderBreadcrumbs() {
    const el = document.getElementById('breadcrumbs');
    const trail = [{ id: 'root', name: 'Vault' }, ...state.breadcrumbs];
    el.innerHTML = trail
      .map((b, i) =>
        i === trail.length - 1
          ? `<span class="text-soft" style="font-weight:600;">${escapeHtml(b.name)}</span>`
          : `<a href="#" data-folder-id="${b.id}">${escapeHtml(b.name)}</a> <span>/</span>`
      )
      .join(' ');
    el.querySelectorAll('a[data-folder-id]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        state.folderId = a.dataset.folderId === 'root' ? null : a.dataset.folderId;
        state.search = '';
        document.getElementById('search-input').value = '';
        loadContents();
      });
    });
  }

  function renderContents(folders, files) {
    const root = document.getElementById('explorer-root');
    if (!folders.length && !files.length) {
      root.innerHTML = `
        <div class="empty-state">
          <span class="seal" style="margin:0 auto 1rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></span>
          <h3>Nothing here yet</h3>
          <p class="text-sm">Try clearing your filters, or <a href="upload.html" style="color:var(--signal); font-weight:600;">upload a file</a>.</p>
        </div>`;
      return;
    }

    if (state.view === 'grid') {
      root.innerHTML = `<div class="grid-cols" style="grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));" id="grid-wrap"></div>`;
      const wrap = document.getElementById('grid-wrap');
      folders.forEach((f) => wrap.appendChild(folderCard(f)));
      files.forEach((f) => wrap.appendChild(fileCard(f)));
    } else {
      root.innerHTML = `
        <table class="ledger">
          <thead><tr><th>Name</th><th>Size</th><th>Modified</th><th></th></tr></thead>
          <tbody id="ledger-body"></tbody>
        </table>`;
      const body = document.getElementById('ledger-body');
      folders.forEach((f) => body.appendChild(folderRow(f)));
      files.forEach((f) => body.appendChild(fileRow(f)));
    }
  }

  function folderCard(folder) {
    const div = document.createElement('div');
    div.className = 'file-card';
    div.innerHTML = `
      <div class="thumb"><span class="file-icon folder" style="width:44px;height:44px;">${ICONS.folder}</span></div>
      <div class="name">${escapeHtml(folder.name)}</div>
      <div class="meta">Folder</div>`;
    div.addEventListener('click', () => {
      state.folderId = folder.id;
      loadContents();
    });
    return div;
  }
  function folderRow(folder) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="file-name-cell"><span class="file-icon folder">${ICONS.folder}</span>${escapeHtml(folder.name)}</td>
      <td class="mono text-faint">—</td>
      <td class="mono text-faint">${DVLayout.timeAgo(folder.updated_at)}</td>
      <td></td>`;
    tr.addEventListener('click', () => {
      state.folderId = folder.id;
      loadContents();
    });
    return tr;
  }

  function fileCard(file) {
    const icon = iconFor(file.mime_type);
    const div = document.createElement('div');
    div.className = 'file-card';
    div.innerHTML = `
      <div class="thumb" data-thumb><span class="file-icon ${icon.cls}" style="width:36px;height:36px;">${icon.svg}</span></div>
      <div class="name">${escapeHtml(file.original_name)}</div>
      <div class="meta">${DVLayout.formatBytes(file.size_bytes)}</div>`;
    div.addEventListener('click', () => openPreview(file));
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openPreview(file);
    });
    if (file.mime_type.startsWith('image/')) loadThumb(file, div.querySelector('[data-thumb]'));
    return div;
  }
  function fileRow(file) {
    const icon = iconFor(file.mime_type);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="file-name-cell"><span class="file-icon ${icon.cls}">${icon.svg}</span>${escapeHtml(file.original_name)}</td>
      <td class="mono text-faint">${DVLayout.formatBytes(file.size_bytes)}</td>
      <td class="mono text-faint">${DVLayout.timeAgo(file.updated_at)}</td>
      <td><button class="btn btn-icon row-actions" title="Actions">⋯</button></td>`;
    tr.addEventListener('click', () => openPreview(file));
    return tr;
  }

  async function loadThumb(file, container) {
    try {
      const url = await DVApi.fetchBlobUrl(file.id);
      container.innerHTML = `<img src="${url}" alt="">`;
    } catch {
      /* keep icon fallback */
    }
  }

  // --------------------------------------------------------------------
  // Preview modal
  // --------------------------------------------------------------------
  async function openPreview(file) {
    state.activeFileId = file.id;
    document.getElementById('preview-name').textContent = file.original_name;
    document.getElementById('preview-meta').textContent = `${DVLayout.formatBytes(file.size_bytes)} · ${file.mime_type}`;
    const body = document.getElementById('preview-body');
    body.innerHTML = '<span class="seal spin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z"/></svg></span>';
    openModal('preview-modal');

    try {
      if (file.mime_type.startsWith('image/')) {
        const url = await DVApi.fetchBlobUrl(file.id);
        body.innerHTML = `<img src="${url}" style="max-width:100%; max-height:60vh; border-radius:8px;">`;
      } else if (file.mime_type === 'application/pdf') {
        const url = await DVApi.fetchBlobUrl(file.id);
        body.innerHTML = `<iframe src="${url}" style="width:100%; height:60vh; border:none; border-radius:8px;"></iframe>`;
      } else {
        const icon = iconFor(file.mime_type);
        body.innerHTML = `
          <div style="text-align:center;">
            <span class="file-icon ${icon.cls}" style="width:64px;height:64px; margin:0 auto 1rem;">${icon.svg}</span>
            <p class="text-sm">No inline preview available for this file type.</p>
          </div>`;
      }
    } catch (err) {
      body.innerHTML = `<p class="text-sm">Could not load preview: ${escapeHtml(err.message)}</p>`;
    }

    setupFileActionBar(file);
  }

  function setupFileActionBar(file) {
    let bar = document.getElementById('preview-actions');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'preview-actions';
      bar.className = 'row gap-1';
      document.getElementById('preview-meta').insertAdjacentElement('afterend', bar);
    }
    bar.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="act-rename">Rename</button>
      <button class="btn btn-ghost btn-sm" id="act-share">Share</button>
      <button class="btn btn-danger btn-sm" id="act-delete">Delete</button>
    `;
    document.getElementById('act-rename').onclick = () => {
      document.getElementById('rename-input').value = file.original_name;
      openModal('rename-modal');
    };
    document.getElementById('act-share').onclick = () => openModal('share-modal');
    document.getElementById('act-delete').onclick = () => openModal('delete-modal');
  }

  document.getElementById('preview-download').addEventListener('click', async () => {
    if (!state.activeFileId) return;
    try {
      const url = await DVApi.fetchBlobUrl(state.activeFileId, { forceDownload: true });
      const a = document.createElement('a');
      a.href = url;
      a.download = document.getElementById('preview-name').textContent;
      a.click();
    } catch (err) {
      DVToast.error('Download failed', err.message);
    }
  });

  // --------------------------------------------------------------------
  // Rename / delete / share / new folder actions
  // --------------------------------------------------------------------
  document.getElementById('rename-confirm').addEventListener('click', async () => {
    const name = document.getElementById('rename-input').value.trim();
    if (!name || !state.activeFileId) return;
    try {
      await DVApi.patch(`/files/${state.activeFileId}/rename`, { name });
      DVToast.success('Renamed', `File renamed to ${name}`);
      closeModal('rename-modal');
      closeModal('preview-modal');
      loadContents();
    } catch (err) {
      DVToast.error('Rename failed', err.message);
    }
  });

  document.getElementById('delete-confirm').addEventListener('click', async () => {
    if (!state.activeFileId) return;
    try {
      await DVApi.del(`/files/${state.activeFileId}`);
      DVToast.success('Moved to trash', 'You can restore it later if needed.');
      closeModal('delete-modal');
      closeModal('preview-modal');
      loadContents();
    } catch (err) {
      DVToast.error('Delete failed', err.message);
    }
  });

  document.getElementById('share-confirm').addEventListener('click', async () => {
    const email = document.getElementById('share-email-input').value.trim();
    const permission = document.getElementById('share-permission-input').value;
    if (!email || !state.activeFileId) return;
    try {
      await DVApi.post('/shares', { fileId: state.activeFileId, email, permission });
      DVToast.success('Shared', `Access granted to ${email}`);
      closeModal('share-modal');
    } catch (err) {
      DVToast.error('Share failed', err.message);
    }
  });

  document.getElementById('share-public-link-btn').addEventListener('click', async () => {
    if (!state.activeFileId) return;
    const permission = document.getElementById('share-permission-input').value;
    try {
      const { share } = await DVApi.post('/shares', { fileId: state.activeFileId, publicLink: true, permission });
      const link = `${location.origin}${location.pathname.replace('explorer.html', '')}shared-link.html?token=${share.public_token}`;
      await navigator.clipboard.writeText(link);
      DVToast.success('Public link copied', 'Anyone with this link can access the file.');
    } catch (err) {
      DVToast.error('Could not create link', err.message);
    }
  });

  document.getElementById('new-folder-btn').addEventListener('click', () => {
    document.getElementById('folder-name-input').value = '';
    openModal('folder-modal');
  });
  document.getElementById('folder-create-confirm').addEventListener('click', async () => {
    const name = document.getElementById('folder-name-input').value.trim();
    if (!name) return;
    try {
      await DVApi.post('/folders', { name, parentId: state.folderId });
      DVToast.success('Folder created', name);
      closeModal('folder-modal');
      loadContents();
    } catch (err) {
      DVToast.error('Could not create folder', err.message);
    }
  });

  // --------------------------------------------------------------------
  // Toolbar: search, filters, view toggle
  // --------------------------------------------------------------------
  let searchTimer;
  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      loadContents();
    }, 300);
  });

  document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.typeFilter = chip.dataset.type;
      loadContents();
    });
  });

  document.querySelectorAll('.view-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-toggle button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.view = btn.dataset.view;
      localStorage.setItem('dv_view', state.view);
      loadContents();
    });
  });

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

  async function init() {
    const user = DVLayout.initShell();
    if (!user) return;

    document.querySelectorAll('.view-toggle button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === state.view);
    });

    // Deep link from dashboard quick search: explorer.html?q=...
    const params = new URLSearchParams(location.search);
    if (params.get('q')) {
      state.search = params.get('q');
      document.getElementById('search-input').value = state.search;
    }

    await Promise.all([loadContents(), loadSidebarStorage()]);
    document.getElementById('loading-screen').classList.add('hide');
  }

  init();
})();
