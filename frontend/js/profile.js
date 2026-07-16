(function () {
  const ACTION_LABELS = {
    'user.login': 'Logged in',
    'user.register': 'Created account',
    'user.update_profile': 'Updated profile',
    'file.upload': 'Uploaded a file',
    'file.download': 'Downloaded a file',
    'file.delete': 'Deleted a file',
    'file.rename': 'Renamed a file',
    'file.move': 'Moved a file',
    'folder.create': 'Created a folder',
    'share.create': 'Shared a file',
    'share.revoke': 'Revoked a share',
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function loadProfile(user) {
    document.getElementById('fullName').value = user.full_name;
    document.getElementById('emailDisplay').value = user.email;
  }

  async function loadUsageRing() {
    const usage = await DVApi.get('/files/usage');
    const pct = Math.min(100, Math.round((usage.usedBytes / (usage.quotaMb * 1024 * 1024)) * 100));
    document.getElementById('ring-pct').textContent = pct + '%';
    document.getElementById('usage-detail').textContent = `${DVLayout.formatBytes(usage.usedBytes)} of ${DVLayout.formatBytes(usage.quotaMb * 1024 * 1024)}`;
    DVCharts.drawDonut(document.getElementById('usage-ring'), [
      { value: pct, color: '#b98b2a' },
      { value: 100 - pct, color: 'rgba(150,150,150,0.15)' },
    ], { thickness: 12 });

    document.getElementById('sidebar-storage-bar').style.width = pct + '%';
    document.getElementById('sidebar-storage-text').textContent = pct + '%';
  }

  async function loadActivity() {
    const { logs } = await DVApi.get('/audit/mine');
    const el = document.getElementById('my-activity');
    if (!logs.length) {
      el.innerHTML = '<p class="text-sm text-faint">No activity recorded yet.</p>';
      return;
    }
    el.innerHTML = logs
      .slice(0, 10)
      .map(
        (log) => `
      <div class="activity-item">
        <span class="activity-dot"></span>
        <div>
          <b class="text-sm">${ACTION_LABELS[log.action] || escapeHtml(log.action)}</b>
          <div class="when">${DVLayout.timeAgo(log.created_at)}</div>
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
      DVToast.success('Password updated');
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
