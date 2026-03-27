import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * Pre-configured Axios instance for the NetMon API.
 *
 * Features:
 * - Base URL from env
 * - JWT interceptor (adds Authorization header)
 * - 401 response interceptor triggers token refresh
 * - Timeout of 15s
 */
export const api = axios.create({
    baseURL: API_URL,
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('netmon_access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Handle 401 — attempt token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;

        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;

            try {
                const refreshToken = localStorage.getItem('netmon_refresh_token');
                if (!refreshToken) throw new Error('No refresh token');

                const { data } = await axios.post(`${API_URL}/auth/refresh`, {
                    refreshToken,
                });

                localStorage.setItem('netmon_access_token', data.accessToken);
                localStorage.setItem('netmon_refresh_token', data.refreshToken);
                original.headers.Authorization = `Bearer ${data.accessToken}`;

                return api(original);
            } catch {
                localStorage.removeItem('netmon_access_token');
                localStorage.removeItem('netmon_refresh_token');
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
            }
        }

        return Promise.reject(error);
    },
);
