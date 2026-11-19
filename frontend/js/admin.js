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
      if (!users || !users.length) {
        body.innerHTML = '<tr><td colspan="6" class="text-sm text-muted" style="text-align:center; padding:2rem;">No users found.</td></tr>';
        return;
      }
      body.innerHTML = users
        .map(
          (u) => `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:0.65rem;">
              <div class="user-avatar" style="width:28px;height:28px;font-size:0.75rem;">${escapeHtml(u.full_name ? u.full_name.charAt(0).toUpperCase() : '?')}</div>
              <span class="font-semibold text-sm">${escapeHtml(u.full_name || 'Unnamed')}</span>
            </div>
          </td>
          <td class="text-sm text-muted mono">${escapeHtml(u.email)}</td>
          <td>
            <select class="form-select" style="width:115px; font-size:0.8rem; padding:0.35rem 0.5rem;" data-role-user="${u.id}">
              <option value="member" ${u.role === 'member' ? 'selected' : ''}>Member</option>
              <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Manager</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </td>
          <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'Active' : 'Disabled'}</span></td>
          <td class="mono text-muted text-sm">${new Date(u.created_at).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-secondary btn-sm" data-toggle-active="${u.id}" data-active="${u.is_active}">
              ${u.is_active ? 'Disable' : 'Enable'}
            </button>
          </td>
        </tr>`
        )
        .join('');

      body.querySelectorAll('[data-role-user]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          try {
            await DVApi.patch(`/users/${sel.dataset.roleUser}/role`, { role: sel.value });
            DVToast.success('Role updated successfully');
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
            DVToast.success(isActive ? 'User disabled' : 'User activated');
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
      if (!logs || !logs.length) {
        body.innerHTML = '<tr><td colspan="4" class="text-sm text-muted" style="text-align:center; padding:2rem;">No system audit entries logged yet.</td></tr>';
        return;
      }
      body.innerHTML = logs
        .map(
          (log) => `
        <tr>
          <td class="text-sm font-semibold">${escapeHtml(log.actor_name || 'System')}</td>
          <td><span class="badge badge-brand mono">${escapeHtml(log.action)}</span></td>
          <td class="mono text-muted text-sm">${log.target_type ? `${log.target_type}:${(log.target_id || '').toString().slice(0, 8)}` : '—'}</td>
          <td class="mono text-muted text-sm">${DVLayout.timeAgo(log.created_at)}</td>
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
        <div style="text-align:center; padding:4rem 1.5rem; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg);">
          <div class="metric-icon" style="margin:0 auto 1.25rem; background:var(--danger-bg); color:var(--danger);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z"/></svg>
          </div>
          <h3>Restricted Administration Area</h3>
          <p class="text-sm" style="max-width:440px; margin:0 auto;">This management panel is only accessible to users with Manager or Admin privileges.</p>
        </div>`;
      document.getElementById('loading-screen').classList.add('hide');
      return;
    }

    await Promise.all([loadUsers(), loadSidebarStorage()]);
    document.getElementById('loading-screen').classList.add('hide');
  }

  init();
})();
