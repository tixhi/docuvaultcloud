/**
 * Thin fetch wrapper around the DocuVault REST API.
 * - Attaches the access token as a Bearer header.
 * - Automatically retries once after refreshing the access token on 401s
 *   (the refresh token itself lives in an httpOnly cookie set by the server).
 * - `upload()` uses XMLHttpRequest instead of fetch so we can report
 *   real progress events to the Upload Center UI.
 */
(function () {
  const cfg = window.DOCUVAULT_CONFIG;

  function getToken() {
    return localStorage.getItem(cfg.TOKEN_STORAGE_KEY);
  }
  function setToken(token) {
    if (token) localStorage.setItem(cfg.TOKEN_STORAGE_KEY, token);
  }
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(cfg.USER_STORAGE_KEY) || 'null');
    } catch {
      return null;
    }
  }
  function setUser(user) {
    localStorage.setItem(cfg.USER_STORAGE_KEY, JSON.stringify(user));
  }
  function clearSession() {
    localStorage.removeItem(cfg.TOKEN_STORAGE_KEY);
    localStorage.removeItem(cfg.USER_STORAGE_KEY);
  }

  let refreshPromise = null;
  async function refreshToken() {
    if (!refreshPromise) {
      refreshPromise = fetch(`${cfg.API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
        .then(async (res) => {
          if (!res.ok) throw new Error('refresh_failed');
          const data = await res.json();
          setToken(data.accessToken);
          if (data.user) setUser(data.user);
          return data.accessToken;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  }

  async function request(path, { method = 'GET', body, isForm = false, retry = true } = {}) {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${cfg.API_BASE_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });

    if (res.status === 401 && retry) {
      try {
        await refreshToken();
        return request(path, { method, body, isForm, retry: false });
      } catch {
        clearSession();
        if (!location.pathname.endsWith('login.html')) {
          location.href = 'login.html';
        }
        throw new Error('Session expired. Please log in again.');
      }
    }

    let data = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /** XHR-based upload so we can report progress percentages. */
  function upload(path, file, { folderId, onProgress } = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${cfg.API_BASE_URL}${path}`);
      const token = getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.withCredentials = true;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      });

      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          /* ignore parse errors */
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error((data && data.error) || `Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Network error during upload.'));

      const form = new FormData();
      form.append('file', file);
      if (folderId) form.append('folderId', folderId);
      xhr.send(form);
    });
  }

  /** Raw PUT with progress, used to push bytes straight to a presigned S3
   *  URL. No Authorization header -- the URL itself is the credential. */
  function putToPresignedUrl(url, file, { onProgress } = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Direct upload to storage failed (${xhr.status}).`));
      };
      xhr.onerror = () => reject(new Error('Network error during direct upload.'));
      xhr.send(file);
    });
  }

  /** Picks the best upload strategy automatically: tries to get a presigned
   *  S3 URL first (bytes go straight to S3, server never sees them); falls
   *  back to the classic multer-mediated /files/upload endpoint when the
   *  backend is running the local storage driver (presign-upload 400s). */
  async function uploadSmart(file, { folderId, onProgress } = {}) {
    try {
      const presign = await request('/files/presign-upload', {
        method: 'POST',
        body: { fileName: file.name, mimeType: file.type || 'application/octet-stream', folderId },
      });
      await putToPresignedUrl(presign.uploadUrl, file, { onProgress });
      return request('/files/complete-upload', {
        method: 'POST',
        body: {
          key: presign.key,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          folderId,
        },
      });
    } catch (err) {
      if (err.status === 400) {
        // Direct upload isn't available (local storage driver) -- fall back.
        return upload('/files/upload', file, { folderId, onProgress });
      }
      throw err;
    }
  }

  window.DVApi = {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    del: (path) => request(path, { method: 'DELETE' }),
    upload,
    uploadSmart,
    getToken,
    setToken,
    getUser,
    setUser,
    clearSession,
    /** Fetches a file's bytes with the proper auth header and returns a
     *  local object URL suitable for <img src>, <iframe src>, or a real
     *  <a download> click -- direct URLs can't carry Authorization headers.
     *  Transparently follows the server's redirect to a presigned S3 URL
     *  when the backend is running the S3 driver. */
    async fetchBlobUrl(fileId, { forceDownload = false } = {}) {
      const token = getToken();
      const res = await fetch(
        `${cfg.API_BASE_URL}/files/${fileId}/download${forceDownload ? '?download=1' : ''}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' }
      );
      if (!res.ok) throw new Error('Could not load file.');
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
  };
})();

