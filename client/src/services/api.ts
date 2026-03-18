import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle global errors (e.g. 401 redirect to login)
    return Promise.reject(error);
  }
);
