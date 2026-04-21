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
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    if (error.response?.data?.error) {
      error.message = error.response.data.detail
        ? `${error.response.data.error} (${error.response.data.detail})`
        : error.response.data.error;
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
};

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats/'),
  getActivity: () => api.get('/dashboard/activity/'),
};

export const calendarAPI = {
  getMonthPosts: (month, year) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return api.get(`/calendar/?month=${month}&year=${year}&tz=${encodeURIComponent(tz)}`);
  },
  getTodayPosts: () => api.get('/calendar/today/'),
};

export const aiAPI = {
  getStatus: () => api.get('/ai-status/'),
  generateContent: (data) => api.post('/generate-content/', data),
  generateImage: (data) => api.post('/generate-image/', data),
  polishContent: (data) => api.post('/polish-content/', data),
  generateVariants: (data) => api.post('/generate-variants/', data),
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
  startOAuth: (token) => api.post(`/invitations/start/${token}/`),
};

export const emailConfigAPI = {
  get: () => api.get('/email-config/'),
  save: (data) => api.post('/email-config/', data),
  remove: () => api.delete('/email-config/'),
};

export default api;
