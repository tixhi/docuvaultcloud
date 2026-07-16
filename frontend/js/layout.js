/**
 * Shared behavior for every internal (post-login) page: dashboard, upload,
 * explorer, shared, profile, admin. Include after api.js + theme.js + notifications.js.
 */
(function () {
  function requireAuth() {
    const token = DVApi.getToken();
    const user = DVApi.getUser();
    if (!token || !user) {
      location.href = 'login.html';
      return null;
    }
    return user;
  }

  function paintUserChip(user) {
    document.querySelectorAll('[data-user-name]').forEach((el) => (el.textContent = user.full_name));
    document.querySelectorAll('[data-user-email]').forEach((el) => (el.textContent = user.email));
    document.querySelectorAll('[data-user-role]').forEach((el) => (el.textContent = user.role));
    document.querySelectorAll('[data-user-initial]').forEach((el) => {
      el.textContent = (user.full_name || '?').trim().charAt(0).toUpperCase();
    });
    document.querySelectorAll('[data-admin-only]').forEach((el) => {
      el.style.display = user.role === 'admin' || user.role === 'manager' ? '' : 'none';
    });
  }

  function highlightActiveNav() {
    const page = location.pathname.split('/').pop();
    document.querySelectorAll('.nav-link[data-page]').forEach((link) => {
      link.classList.toggle('active', link.dataset.page === page);
    });
  }

  function bindLogout() {
    document.querySelectorAll('[data-logout]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await DVApi.post('/auth/logout');
        } catch {
          /* proceed with client-side logout regardless */
        }
        DVApi.clearSession();
        location.href = 'login.html';
      });
    });
  }

  function bindMobileNav() {
    const toggle = document.querySelector('[data-menu-toggle]');
    const sidebar = document.querySelector('.sidebar');
    if (!toggle || !sidebar) return;
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  function initShell() {
    const user = requireAuth();
    if (!user) return null;
    paintUserChip(user);
    highlightActiveNav();
    bindLogout();
    bindMobileNav();
    DVTheme.initThemeToggle();
    return user;
  }

  window.DVLayout = { requireAuth, paintUserChip, initShell, formatBytes, timeAgo };
})();
