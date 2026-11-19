/**
 * DocuVault Frontend Runtime Configuration
 * Automatically routes to the Spring Boot backend on port 8080.
 */
window.DOCUVAULT_CONFIG = {
  API_BASE_URL: window.localStorage.getItem('dv_api_base') || 'http://localhost:8080/api',
  TOKEN_STORAGE_KEY: 'dv_access_token',
  USER_STORAGE_KEY: 'dv_user',
  THEME_STORAGE_KEY: 'dv_theme',
};
