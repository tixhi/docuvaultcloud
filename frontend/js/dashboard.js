(function () {
  const CATEGORY_COLORS = {
    images: '#3e7cb1',
    pdf: '#b4453a',
    documents: '#3f8f6f',
    video: '#c98a2e',
    other: '#82869c',
  };
  const CATEGORY_LABELS = {
    images: 'Images',
    pdf: 'PDFs',
    documents: 'Documents',
    video: 'Video',
    other: 'Other',
  };

  const FILE_ICON = {
    pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg>',
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M9 13h6M9 17h6M9 9h2"/></svg>',
    other: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/></svg>',
  };
  function iconFor(mime) {
    if (mime === 'application/pdf') return { cls: 'pdf', svg: FILE_ICON.pdf };
    if (mime.startsWith('image/')) return { cls: 'img', svg: FILE_ICON.img };
    if (mime.includes('word') || mime.startsWith('text/')) return { cls: 'doc', svg: FILE_ICON.doc };
    return { cls: 'other', svg: FILE_ICON.other };
  }

  async function load() {
    const user = DVLayout.initShell();
    if (!user) return;

    try {
      const [usage, sharedIn, sharedOut] = await Promise.all([
        DVApi.get('/files/usage'),
        DVApi.get('/shares/with-me'),
        DVApi.get('/shares/by-me'),
      ]);

      // --- Stat cards ---
      document.getElementById('stat-files').textContent = usage.fileCount;
      const usedBytes = usage.usedBytes;
      const quotaBytes = usage.quotaMb * 1024 * 1024;
      document.getElementById('stat-storage').textContent = DVLayout.formatBytes(usedBytes);
      document.getElementById('stat-storage-quota').textContent = `of ${DVLayout.formatBytes(quotaBytes)} quota`;
      document.getElementById('stat-shared-in').textContent = sharedIn.shares.length;
      document.getElementById('stat-shared-out').textContent = sharedOut.shares.length;

      const pct = Math.min(100, Math.round((usedBytes / quotaBytes) * 100));
      document.getElementById('sidebar-storage-bar').style.width = pct + '%';
      document.getElementById('sidebar-storage-text').textContent = `${pct}%`;
      document.getElementById('donut-total').textContent = pct + '%';

      // --- Donut chart ---
      const segments = usage.byCategory
        .filter((c) => Number(c.total_bytes) > 0)
        .map((c) => ({ value: Number(c.total_bytes), color: CATEGORY_COLORS[c.category] || '#82869c', category: c.category }));
      DVCharts.drawDonut(document.getElementById('donut-chart'), segments);

      const legend = document.getElementById('donut-legend');
      legend.innerHTML = segments.length
        ? segments
            .map(
              (s) => `
        <div class="item">
          <span class="swatch" style="background:${s.color}"></span>
          ${CATEGORY_LABELS[s.category] || s.category}
          <span class="val">${DVLayout.formatBytes(s.value)}</span>
        </div>`
            )
            .join('')
        : '<p class="text-faint text-sm">No files yet — upload something to see the breakdown.</p>';

      // --- Activity feed ---
      const list = document.getElementById('activity-list');
      if (!usage.recent.length) {
        list.innerHTML = `
          <div class="empty-state" style="padding:2rem 1rem;">
            <span class="seal seal-sm" style="margin:0 auto 0.8rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span>
            <p class="text-sm">Nothing here yet. <a href="upload.html" style="color:var(--signal); font-weight:600;">Upload your first file</a>.</p>
          </div>`;
      } else {
        list.innerHTML = usage.recent
          .map((f) => {
            const icon = iconFor(f.mime_type);
            return `
            <div class="activity-item">
              <span class="file-icon ${icon.cls}" style="width:32px;height:32px;">${icon.svg}</span>
              <div class="flex-1">
                <b class="text-sm">${escapeHtml(f.original_name)}</b>
                <div class="when">${DVLayout.formatBytes(f.size_bytes)} · updated ${DVLayout.timeAgo(f.updated_at)}</div>
              </div>
            </div>`;
          })
          .join('');
      }
    } catch (err) {
      DVToast.error('Could not load dashboard', err.message);
    } finally {
      document.getElementById('loading-screen').classList.add('hide');
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Quick search from the topbar jumps to File Explorer with the query.
  document.addEventListener('DOMContentLoaded', () => {
    const search = document.getElementById('topbar-search');
    search?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && search.value.trim()) {
        location.href = `explorer.html?q=${encodeURIComponent(search.value.trim())}`;
      }
    });
  });

  load();
})();
