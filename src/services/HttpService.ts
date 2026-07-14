import axios, { AxiosError, type AxiosResponse } from 'axios';
import StorageService from './StorageService';

export default class HttpService {
    public baseUrl = "";
    public instance;

    constructor() {
        this.baseUrl = import.meta.env.VITE_API_BASE_URL;
        this.instance = axios.create({
            baseURL: this.baseUrl,
            timeout: 30000,
        });

        // Add response interceptor to handle 401 errors — treat as "session expired"
        // for authenticated requests, but leave auth endpoints alone so the caller
        // (login/register/password) can surface the real error to the user.
        this.instance.interceptors.response.use(
            (response: AxiosResponse) => response,
            (error: AxiosError) => {
                if (error.response?.status === 401) {
                    const url = (error.config?.url || '').replace(/^\/+/, '');
                    const isAuthEndpoint = /^(login|register(\/|$)|password\/(forgot|reset))/.test(url);
                    if (!isAuthEndpoint) {
                        const storage = new StorageService();
                        storage.clear();
                        window.location.href = '/login';
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    get defaultHeaders() {
        const storage = new StorageService();
        const token = storage.getToken();
        
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }

    async request(method: string, url: string, data = null, customHeaders = {}) {
        const headers = {...this.defaultHeaders, ...customHeaders};
        
        const config = {
            method,
            url,
            headers,
            data,
        };

        if (data) {
            config.data = data;
        }

        try {
            const response = await this.instance(config);
            return response;
        } catch (error) {
            console.error("HttpService error:", error);
            throw error;
        }
    }

    get(url: string, customHeaders = {}) {
        return this.request('get', url, null, customHeaders);
    }

    post(url: string, data: any, customHeaders = {}) {
        return this.request('post', url, data, customHeaders);
    }

    put(url: string, data: any, customHeaders = {}) {
        return this.request('put', url, data, customHeaders);
    }

    delete(url: string, customHeaders = {}) {
        return this.request('delete', url, null, customHeaders);
    }

    async postFormData(url: string, formData: FormData) {
        const storage = new StorageService();
        const token = storage.getToken();
        
        const headers: Record<string, string> = {
            'Content-Type': 'multipart/form-data',
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const config = {
            method: 'post',
            url,
            headers,
            data: formData,
        };

        try {
            const response = await this.instance(config);
            return response;
        } catch (error) {
            console.error("HttpService error:", error);
            throw error;
        }
    }
}
