/**
 * Theme handling. `applyStoredTheme()` runs synchronously as early as
 * possible (called inline in <head> on every page) so the correct theme is
 * set before first paint -- no flash of the wrong theme.
 */
(function () {
  const KEY = 'dv_theme';

  function applyStoredTheme() {
    const stored = localStorage.getItem(KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    return theme;
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(KEY, next);
    document.dispatchEvent(new CustomEvent('dv:themechange', { detail: { theme: next } }));
    return next;
  }

  function initThemeToggle(selector = '[data-theme-toggle]') {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener('click', () => toggleTheme());
    });
  }

  window.DVTheme = { applyStoredTheme, toggleTheme, initThemeToggle };
  applyStoredTheme();
})();
