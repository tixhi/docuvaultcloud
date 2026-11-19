(function () {
  const ACTION_LABELS = {
    'user.login': 'Logged in to workspace',
    'user.register': 'Created vault account',
    'user.update_profile': 'Updated personal profile',
    'file.upload': 'Uploaded a document',
    'file.download': 'Downloaded a document',
    'file.delete': 'Moved document to trash',
    'file.restore': 'Restored document from trash',
    'file.rename': 'Renamed a document',
    'file.move': 'Moved a document',
    'folder.create': 'Created a new folder',
    'share.create': 'Created document share',
    'share.revoke': 'Revoked document share',
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function loadProfile(user) {
    document.getElementById('fullName').value = user.full_name || '';
    document.getElementById('emailDisplay').value = user.email || '';
  }

  async function loadUsageRing() {
    const usage = await DVApi.get('/files/usage');
    const pct = Math.min(100, Math.round((usage.usedBytes / (usage.quotaMb * 1024 * 1024)) * 100));
    document.getElementById('ring-pct').textContent = pct + '%';
    document.getElementById('usage-detail').textContent = `${DVLayout.formatBytes(usage.usedBytes)} of ${DVLayout.formatBytes(usage.quotaMb * 1024 * 1024)}`;
    DVCharts.drawDonut(document.getElementById('usage-ring'), [
      { value: pct, color: '#6366f1' },
      { value: 100 - pct, color: 'rgba(150,150,150,0.15)' },
    ], { thickness: 12 });

    document.getElementById('sidebar-storage-bar').style.width = pct + '%';
    document.getElementById('sidebar-storage-text').textContent = pct + '%';
  }

  async function loadActivity() {
    const { logs } = await DVApi.get('/audit/mine');
    const el = document.getElementById('my-activity');
    if (!logs || !logs.length) {
      el.innerHTML = '<p class="text-sm text-muted">No personal activity recorded yet.</p>';
      return;
    }
    el.innerHTML = logs
      .slice(0, 10)
      .map(
        (log) => `
      <div style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0; border-bottom:1px solid var(--border);">
        <span style="width:8px; height:8px; border-radius:50%; background:var(--brand); flex-shrink:0;"></span>
        <div style="flex:1;">
          <b class="text-sm" style="display:block;">${ACTION_LABELS[log.action] || escapeHtml(log.action)}</b>
          <div class="text-xs text-muted mono">${DVLayout.timeAgo(log.created_at)}</div>
        </div>
      </div>`
      )
      .join('');
  }

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('fullName').value.trim();
    try {
      const { user } = await DVApi.patch('/users/me', { fullName });
      DVApi.setUser(user);
      DVLayout.paintUserChip(user);
      DVToast.success('Profile updated');
    } catch (err) {
      DVToast.error('Could not update profile', err.message);
    }
  });

  document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    try {
      await DVApi.post('/users/me/password', { currentPassword, newPassword });
      DVToast.success('Password updated successfully');
      e.target.reset();
    } catch (err) {
      DVToast.error('Could not update password', err.message);
    }
  });

  async function init() {
    const user = DVLayout.initShell();
    if (!user) return;
    await loadProfile(user);
    await Promise.all([loadUsageRing(), loadActivity()]);
    document.getElementById('loading-screen').classList.add('hide');
  }

  init();
})();
