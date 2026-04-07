/**
 * Shared API Utility
 * Handles authenticated requests with device ID headers
 */

const API = {
  /**
   * Makes an authenticated API request
   */
  async request(url, options = {}) {
    const token = localStorage.getItem('token');
    const deviceId = localStorage.getItem('deviceId');

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(deviceId ? { 'X-Device-ID': deviceId } : {}),
      ...(options.headers || {})
    };

    const res = await fetch(url, { ...options, headers });

    // If 401 - session expired or invalidated → redirect to login
   if (res.status === 401) {
  console.warn("Session issue, not logging out immediately");
}

    return res;
  },

  async get(url) {
    return API.request(url, { method: 'GET' });
  },

  async post(url, body) {
    return API.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  async patch(url, body = {}) {
    return API.request(url, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  },

  async delete(url) {
    return API.request(url, { method: 'DELETE' });
  },

  /**
   * Upload with multipart form data
   */
  async upload(url, formData) {
    const token = localStorage.getItem('token');
    const deviceId = localStorage.getItem('deviceId');
    return fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(deviceId ? { 'X-Device-ID': deviceId } : {})
      },
      body: formData
    });
  },

  /**
   * Clears auth data and redirects to login
   */
  logout() {
    // Try to notify server (best effort)
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    window.location.href = '/';
  }
};
