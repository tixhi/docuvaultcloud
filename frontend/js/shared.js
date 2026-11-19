(function () {
  let activeTab = 'with-me';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function permBadge(permission) {
    const map = { view: 'badge-info', comment: 'badge-warning', edit: 'badge-brand' };
    return `<span class="badge ${map[permission] || 'badge-info'}">${permission}</span>`;
  }

  async function loadWithMe() {
    const { shares } = await DVApi.get('/shares/with-me');
    const root = document.getElementById('shared-root');
    if (!shares.length) {
      root.innerHTML = emptyState('No documents have been shared with you yet.');
      return;
    }
    root.innerHTML = shares
      .map(
        (s) => `
      <div class="card" style="margin-bottom:0.85rem; padding:1.2rem; display:flex; align-items:center; gap:1rem;">
        <span class="file-icon doc" style="width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:var(--bg-sunken); border-radius:var(--radius-sm); color:var(--brand); flex-shrink:0;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M9 13h6M9 17h6M9 9h2"/></svg>
        </span>
        <div style="flex:1; min-width:0;">
          <b class="text-sm" style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(s.original_name || 'Untitled file')}</b>
          <div class="text-xs text-muted mono">Shared by ${escapeHtml(s.shared_by_name || 'Team member')} &bull; ${DVLayout.timeAgo(s.created_at)}</div>
        </div>
        ${permBadge(s.permission)}
        <button class="btn btn-secondary btn-sm" data-open-file="${s.file_id}">Open</button>
      </div>`
      )
      .join('');

    root.querySelectorAll('[data-open-file]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const url = await DVApi.fetchBlobUrl(btn.dataset.openFile);
          window.open(url, '_blank');
        } catch (err) {
          DVToast.error('Could not open file', err.message);
        }
      });
    });
  }

  async function loadByMe() {
    const { shares } = await DVApi.get('/shares/by-me');
    const root = document.getElementById('shared-root');
    if (!shares.length) {
      root.innerHTML = emptyState('You have not shared any documents yet. Use the share option in File Explorer to grant access.');
      return;
    }
    root.innerHTML = shares
      .map(
        (s) => `
      <div class="card" style="margin-bottom:0.85rem; padding:1.2rem; display:flex; align-items:center; gap:1rem;">
        <span class="file-icon doc" style="width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:var(--bg-sunken); border-radius:var(--radius-sm); color:var(--brand); flex-shrink:0;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M9 13h6M9 17h6M9 9h2"/></svg>
        </span>
        <div style="flex:1; min-width:0;">
          <b class="text-sm" style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(s.original_name || 'Untitled file')}</b>
          <div class="text-xs text-muted mono">
            ${s.public_token ? 'Public Link' : `Shared with ${escapeHtml(s.shared_with_name || s.shared_with_email || 'user')}`}
            &bull; ${DVLayout.timeAgo(s.created_at)}
          </div>
        </div>
        <select class="form-select" style="width:130px; font-size:0.82rem; padding:0.4rem 0.6rem;" data-share-id="${s.id}">
          <option value="view" ${s.permission === 'view' ? 'selected' : ''}>Can View</option>
          <option value="comment" ${s.permission === 'comment' ? 'selected' : ''}>Can Comment</option>
          <option value="edit" ${s.permission === 'edit' ? 'selected' : ''}>Can Edit</option>
        </select>
        <button class="btn btn-danger btn-sm" data-revoke="${s.id}">Revoke</button>
      </div>`
      )
      .join('');

    root.querySelectorAll('[data-share-id]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        try {
          await DVApi.patch(`/shares/${sel.dataset.shareId}/permission`, { permission: sel.value });
          DVToast.success('Permission updated');
        } catch (err) {
          DVToast.error('Could not update permission', err.message);
        }
      });
    });
    root.querySelectorAll('[data-revoke]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await DVApi.del(`/shares/${btn.dataset.revoke}`);
          DVToast.success('Share revoked');
          loadByMe();
        } catch (err) {
          DVToast.error('Could not revoke share', err.message);
        }
      });
    });
  }

  function emptyState(message) {
    return `
      <div style="text-align:center; padding:4rem 1.5rem; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg);">
        <div class="metric-icon" style="margin:0 auto 1.25rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/></svg>
        </div>
        <h3>No Shares Found</h3>
        <p class="text-sm" style="max-width:440px; margin:0 auto;">${message}</p>
      </div>`;
  }

  async function loadTab() {
    document.getElementById('shared-root').innerHTML = '<div style="height:64px; background:var(--bg-sunken); border-radius:var(--radius-md); margin-bottom:0.8rem;"></div>';
    try {
      if (activeTab === 'with-me') await loadWithMe();
      else await loadByMe();
    } catch (err) {
      document.getElementById('shared-root').innerHTML = `<div class="card"><p>${err.message}</p></div>`;
    }
  }

  document.querySelectorAll('.filter-chip[data-tab]').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-tab]').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      activeTab = chip.dataset.tab;
      loadTab();
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
    await Promise.all([loadTab(), loadSidebarStorage()]);
    document.getElementById('loading-screen').classList.add('hide');
  }

  init();
})();
