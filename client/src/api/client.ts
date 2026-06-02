import axios from 'axios';

function getDeviceFingerprint(): string {

    let fp = localStorage.getItem('device_fingerprint');
    if (!fp) {
        fp = crypto.randomUUID();
        localStorage.setItem('device_fingerprint', fp);
    }
    return fp
}





const apiClient = axios.create({
    baseURL: '/api',
    headers: {
        'Content-type': 'application/json',
    },
});

// inject token in every request
apiClient.interceptors.request.use((config) => {

    const token =
        localStorage.getItem('temp_token') || localStorage.getItem('token');
    if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
    }
    config.headers.set('X-Device-Fingerprint', getDeviceFingerprint());

    return config;
});

// handle errors globally
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {

        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('temp_token');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
)

export default apiClient