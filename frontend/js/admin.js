(function () {
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function loadUsers(search = '') {
    const body = document.getElementById('users-body');
    try {
      const { users } = await DVApi.get(`/users?search=${encodeURIComponent(search)}`);
      if (!users.length) {
        body.innerHTML = '<tr><td colspan="6" class="text-sm text-faint">No users found.</td></tr>';
        return;
      }
      body.innerHTML = users
        .map(
          (u) => `
        <tr>
          <td class="file-name-cell">
            <div class="avatar" style="width:28px;height:28px;font-size:0.7rem;">${escapeHtml(u.full_name.charAt(0))}</div>
            ${escapeHtml(u.full_name)}
          </td>
          <td class="text-sm">${escapeHtml(u.email)}</td>
          <td>
            <select class="perm-select" data-role-user="${u.id}">
              <option value="member" ${u.role === 'member' ? 'selected' : ''}>Member</option>
              <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Manager</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </td>
          <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'Active' : 'Disabled'}</span></td>
          <td class="mono text-faint text-sm">${new Date(u.created_at).toLocaleDateString()}</td>
          <td><button class="btn btn-ghost btn-sm" data-toggle-active="${u.id}" data-active="${u.is_active}">${u.is_active ? 'Disable' : 'Enable'}</button></td>
        </tr>`
        )
        .join('');

      body.querySelectorAll('[data-role-user]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          try {
            await DVApi.patch(`/users/${sel.dataset.roleUser}/role`, { role: sel.value });
            DVToast.success('Role updated');
          } catch (err) {
            DVToast.error('Could not update role', err.message);
          }
        });
      });
      body.querySelectorAll('[data-toggle-active]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const isActive = btn.dataset.active === 'true';
          try {
            await DVApi.patch(`/users/${btn.dataset.toggleActive}/active`, { isActive: !isActive });
            DVToast.success(isActive ? 'User disabled' : 'User enabled');
            loadUsers(document.getElementById('user-search').value.trim());
          } catch (err) {
            DVToast.error('Could not update user', err.message);
          }
        });
      });
    } catch (err) {
      body.innerHTML = `<tr><td colspan="6" class="text-sm">Could not load users: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  async function loadAudit() {
    const body = document.getElementById('audit-body');
    try {
      const { logs } = await DVApi.get('/audit?limit=100');
      if (!logs.length) {
        body.innerHTML = '<tr><td colspan="4" class="text-sm text-faint">No audit entries yet.</td></tr>';
        return;
      }
      body.innerHTML = logs
        .map(
          (log) => `
        <tr>
          <td class="text-sm">${escapeHtml(log.actor_name || 'System')}</td>
          <td><span class="badge badge-signal">${escapeHtml(log.action)}</span></td>
          <td class="mono text-faint text-sm">${log.target_type ? `${log.target_type}:${(log.target_id || '').toString().slice(0, 8)}` : '—'}</td>
          <td class="mono text-faint text-sm">${DVLayout.timeAgo(log.created_at)}</td>
        </tr>`
        )
        .join('');
    } catch (err) {
      body.innerHTML = `<tr><td colspan="4" class="text-sm">Could not load audit log: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  document.querySelectorAll('.filter-chip[data-panel]').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-panel]').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const panel = chip.dataset.panel;
      document.getElementById('panel-users').style.display = panel === 'users' ? '' : 'none';
      document.getElementById('panel-audit').style.display = panel === 'audit' ? '' : 'none';
      if (panel === 'audit') loadAudit();
    });
  });

  let searchTimer;
  document.getElementById('user-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadUsers(e.target.value.trim()), 300);
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

    if (user.role !== 'admin' && user.role !== 'manager') {
      document.getElementById('admin-gate').innerHTML = `
        <div class="empty-state">
          <span class="seal" style="margin:0 auto 1rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z"/></svg></span>
          <h3>Restricted area</h3>
          <p class="text-sm">This panel is only available to managers and admins.</p>
        </div>`;
      document.getElementById('loading-screen').classList.add('hide');
      return;
    }

    await Promise.all([loadUsers(), loadSidebarStorage()]);
    document.getElementById('loading-screen').classList.add('hide');
  }

  init();
})();
