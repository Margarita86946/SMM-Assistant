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
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      window.location.href = '/login';
      return Promise.reject(error);
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
  getAll: () => api.get('/posts/'),
  getOne: (id) => api.get(`/posts/${id}/`),
  create: (postData) => api.post('/posts/', postData),
  update: (id, postData) => api.put(`/posts/${id}/`, postData),
  delete: (id) => api.delete(`/posts/${id}/`),
};

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats/'),
};

export const calendarAPI = {
  getMonthPosts: (month, year) => api.get(`/calendar/?month=${month}&year=${year}`),
  getTodayPosts: () => api.get('/calendar/today/'),
};

export const aiAPI = {
  generateContent: (data) => api.post('/generate-content/', data),
  generateImage: (prompt, platform = 'instagram') => api.post('/generate-image/', { prompt, platform }),
  polishContent: (data) => api.post('/polish-content/', data),
};

export default api;
