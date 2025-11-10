'use client';

import axios from 'axios';
import { getAuth } from 'firebase/auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use(
  async (config) => {
    try {
      const firebaseAuth = getAuth();
      const user = firebaseAuth.currentUser;

      if (user) {
        try {
          const token = await user.getIdToken();
          config.headers.Authorization = `Bearer ${token}`;
        } catch (error) {
          console.error('Failed to fetch Firebase token:', error);
        }
      }
    } catch (error) {
      // Firebase not initialized yet - skip token for now
      // This can happen on initial page load before Firebase is ready
      if (error.code !== 'app/no-app') {
        console.warn('Firebase auth not available:', error.message);
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.warn('Received 401 from API. Ensure user session is valid.');
    }
    return Promise.reject(error);
  },
);

export default api;

