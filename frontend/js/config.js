/**
 * Central runtime config. Change API_BASE_URL if the backend isn't running
 * on the same host/port as this frontend (e.g. served from a CDN while the
 * API lives elsewhere).
 */
window.DOCUVAULT_CONFIG = {
  API_BASE_URL: window.localStorage.getItem('dv_api_base') || 'http://localhost:4000/api',
  TOKEN_STORAGE_KEY: 'dv_access_token',
  USER_STORAGE_KEY: 'dv_user',
  THEME_STORAGE_KEY: 'dv_theme',
};
