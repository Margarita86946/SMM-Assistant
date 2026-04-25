import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/login/') || url.includes('/register/');
      if (!isAuthEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('token_expires_at');
        localStorage.removeItem('role');
        localStorage.removeItem('activeClientId');
        localStorage.removeItem('notifications_sound');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    if (error.response?.data?.error) {
      error.message = error.response.data.error;
    } else if (error.response?.data) {
      const errors = error.response.data;
      const errorMessages = Object.entries(errors)
        .map(([key, value]) => {
          if (Array.isArray(value)) return value.join(', ');
          return value;
        })
        .join(', ');
      error.message = errorMessages;
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (userData) => api.post('/register/', userData),
  login: (credentials) => api.post('/login/', credentials),
  logout: () => api.post('/logout/'),
};

export const postsAPI = {
  getAll: (params) => api.get('/posts/', { params }),
  getOne: (id) => api.get(`/posts/${id}/`),
  create: (postData) => api.post('/posts/', postData),
  update: (id, postData) => api.put(`/posts/${id}/`, postData),
  delete: (id) => api.delete(`/posts/${id}/`),
  uploadImage: (file) => {
    const form = new FormData();
    form.append('image', file);
    return api.post('/posts/upload-image/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  uploadVideo: (file, onProgress) => {
    const form = new FormData();
    form.append('video', file);
    return api.post('/posts/upload-video/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress ? (e) => onProgress(Math.round((e.loaded * 100) / e.total)) : undefined,
    });
  },
};

export const dashboardAPI = {
  getStats: (clientId) => api.get('/dashboard/stats/', { params: clientId ? { client_id: clientId } : {} }),
  getActivity: (clientId) => api.get('/dashboard/activity/', { params: clientId ? { client_id: clientId } : {} }),
};

export const calendarAPI = {
  getMonthPosts: (month, year, clientId) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const params = { month, year, tz };
    if (clientId) params.client_id = clientId;
    return api.get('/calendar/', { params });
  },
  getTodayPosts: () => api.get('/calendar/today/'),
};

export const aiAPI = {
  getStatus: () => api.get('/ai-status/'),
  generateContent: (data) => api.post('/generate-content/', data),
  generateImage: (data) => api.post('/generate-image/', data),
  polishContent: (data) => api.post('/polish-content/', data),
};

export const brandAPI = {
  get: () => api.get('/brand-profile/'),
  update: (data) => api.put('/brand-profile/', data),
};

export const approvalAPI = {
  submit: (id) => api.post(`/posts/${id}/submit/`),
  approve: (id) => api.post(`/posts/${id}/approve/`),
  reject: (id, note) => api.post(`/posts/${id}/reject/`, { note }),
};

export const profileAPI = {
  get: () => api.get('/profile/'),
  update: (data) => api.patch('/profile/', data),
  changePassword: (data) => api.post('/change-password/', data),
};

export const instagramAPI = {
  getStatus: () => api.get('/auth/instagram/status/'),
  getOAuthUrl: () => api.get('/auth/instagram/'),
  disconnect: (id) => api.delete(`/auth/instagram/disconnect/${id}/`),
  publishNow: (postId) => api.post(`/posts/${postId}/publish-now/`),
};

export const invitationsAPI = {
  list: () => api.get('/invitations/'),
  send: (email) => api.post('/invitations/', { client_email: email }),
  revoke: (id) => api.delete(`/invitations/${id}/`),
  lookup: (token) => api.get(`/invitations/lookup/${token}/`),
};

export const clientsAPI = {
  list: () => api.get('/clients/'),
  remove: (id) => api.delete(`/clients/${id}/`),
};

export const emailConfigAPI = {
  get: () => api.get('/email-config/'),
  save: (data) => api.post('/email-config/', data),
  remove: () => api.delete('/email-config/'),
};

export const notificationsAPI = {
  list: () => api.get('/notifications/'),
  markRead: (id) => api.post(`/notifications/${id}/read/`),
  markAllRead: () => api.post('/notifications/read-all/'),
};

export const analyzerAPI = {
  getAccounts: () => api.get('/analyzer/accounts/'),
  getOverview: (accountId) => api.get(`/analyzer/${accountId}/overview/`),
  getPosts: (accountId, sort = 'date') => api.get(`/analyzer/${accountId}/posts/`, { params: { sort } }),
  getAudience: (accountId) => api.get(`/analyzer/${accountId}/audience/`),
  getAI: (accountId) => api.post(`/analyzer/${accountId}/ai/`),
  refresh: (accountId) => api.post(`/analyzer/${accountId}/refresh/`),
  toggleDemo: (enabled) => api.post('/analyzer/demo-toggle/', { enabled }),
};

export default api;
