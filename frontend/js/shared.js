(function () {
  let activeTab = 'with-me';

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function permBadge(permission) {
    const map = { view: 'badge-muted', comment: 'badge-signal', edit: 'badge-brass' };
    return `<span class="badge ${map[permission] || 'badge-muted'}">${permission}</span>`;
  }

  async function loadWithMe() {
    const { shares } = await DVApi.get('/shares/with-me');
    const root = document.getElementById('shared-root');
    if (!shares.length) {
      root.innerHTML = emptyState('Nothing has been shared with you yet.');
      return;
    }
    root.innerHTML = shares
      .map(
        (s) => `
      <div class="card card-pad row" style="margin-bottom:0.8rem; gap:1rem;">
        <span class="file-icon doc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M9 13h6M9 17h6M9 9h2"/></svg></span>
        <div class="flex-1">
          <b class="text-sm">${escapeHtml(s.original_name || 'Untitled file')}</b>
          <div class="text-xs text-faint">Shared by ${escapeHtml(s.shared_by_name || 'someone')} · ${DVLayout.timeAgo(s.created_at)}</div>
        </div>
        ${permBadge(s.permission)}
        <button class="btn btn-ghost btn-sm" data-open-file="${s.file_id}">Open</button>
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
      root.innerHTML = emptyState('You haven\u2019t shared anything yet — do it from File Explorer.');
      return;
    }
    root.innerHTML = shares
      .map(
        (s) => `
      <div class="card card-pad row" style="margin-bottom:0.8rem; gap:1rem;">
        <span class="file-icon doc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M9 13h6M9 17h6M9 9h2"/></svg></span>
        <div class="flex-1">
          <b class="text-sm">${escapeHtml(s.original_name || 'Untitled file')}</b>
          <div class="text-xs text-faint">
            ${s.public_token ? 'Public link' : `Shared with ${escapeHtml(s.shared_with_name || s.shared_with_email || 'a user')}`}
            · ${DVLayout.timeAgo(s.created_at)}
          </div>
        </div>
        <select class="perm-select" data-share-id="${s.id}">
          <option value="view" ${s.permission === 'view' ? 'selected' : ''}>Can view</option>
          <option value="comment" ${s.permission === 'comment' ? 'selected' : ''}>Can comment</option>
          <option value="edit" ${s.permission === 'edit' ? 'selected' : ''}>Can edit</option>
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
      <div class="empty-state">
        <span class="seal" style="margin:0 auto 1rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/></svg></span>
        <h3>Nothing to show</h3>
        <p class="text-sm">${message}</p>
      </div>`;
  }

  async function loadTab() {
    document.getElementById('shared-root').innerHTML = '<div class="skeleton" style="height:64px; margin-bottom:0.8rem;"></div><div class="skeleton" style="height:64px;"></div>';
    try {
      if (activeTab === 'with-me') await loadWithMe();
      else await loadByMe();
    } catch (err) {
      document.getElementById('shared-root').innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
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
