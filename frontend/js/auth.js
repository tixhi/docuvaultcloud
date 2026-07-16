/**
 * Handles login.html and register.html. Detects which form is present on
 * the page and wires it up accordingly.
 */
(function () {
  function redirectIfAuthed() {
    if (DVApi.getToken() && DVApi.getUser()) {
      location.href = 'dashboard.html';
    }
  }

  function setBusy(btn, label, busyText) {
    btn.disabled = true;
    label.textContent = busyText;
  }
  function clearBusy(btn, label, text) {
    btn.disabled = false;
    label.textContent = text;
  }

  function initLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;
    const btn = document.getElementById('submit-btn');
    const label = document.getElementById('submit-label');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      const password = form.password.value;
      setBusy(btn, label, 'Logging in…');
      try {
        const data = await DVApi.post('/auth/login', { email, password });
        DVApi.setToken(data.accessToken);
        DVApi.setUser(data.user);
        DVToast.success('Welcome back', `Logged in as ${data.user.full_name}`);
        setTimeout(() => (location.href = 'dashboard.html'), 400);
      } catch (err) {
        DVToast.error('Login failed', err.message);
        clearBusy(btn, label, 'Log in');
      }
    });

    const demoBtn = document.getElementById('demo-btn');
    demoBtn?.addEventListener('click', () => {
      form.email.value = 'admin@docuvault.local';
      form.password.value = 'Admin@12345';
      DVToast.info('Demo credentials filled', 'Make sure the backend has been seeded (npm run db:seed).');
    });
  }

  function initRegister() {
    const form = document.getElementById('register-form');
    if (!form) return;
    const btn = document.getElementById('submit-btn');
    const label = document.getElementById('submit-label');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = form.fullName.value.trim();
      const email = form.email.value.trim();
      const password = form.password.value;

      if (password.length < 8) {
        DVToast.error('Weak password', 'Use at least 8 characters.');
        return;
      }

      setBusy(btn, label, 'Creating account…');
      try {
        const data = await DVApi.post('/auth/register', { fullName, email, password });
        DVApi.setToken(data.accessToken);
        DVApi.setUser(data.user);
        DVToast.success('Account created', `Welcome to DocuVault, ${data.user.full_name.split(' ')[0]}.`);
        setTimeout(() => (location.href = 'dashboard.html'), 400);
      } catch (err) {
        DVToast.error('Could not create account', err.message);
        clearBusy(btn, label, 'Create account');
      }
    });
  }

  redirectIfAuthed();
  DVTheme.initThemeToggle();
  initLogin();
  initRegister();
})();
