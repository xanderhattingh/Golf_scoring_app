import axios from 'axios';

export default class HttpService {
    public baseUrl = "";
    public instance;

    constructor() {
        this.baseUrl = import.meta.env.VITE_API_BASE_URL;
        console.log(this.baseUrl);
        this.instance = axios.create({baseURL: this.baseUrl});
    }

    get defaultHeaders() {
        const ls = JSON.parse(localStorage.getItem("Golf_Scoring_User"));
        const headers = {
            'Authorization': "Bearer " + ls?.authorisation?.token,
            'Content-Type': 'application/json',
            'Allow-Credentials': 'true',
        }
        return headers;
    }

    async request(method, url, data = null, customHeaders = {}) {
        const headers = {...this.defaultHeaders, ...customHeaders};
        const source = axios.CancelToken.source();

        const config = {
            method,
            url,
            headers,
            data,
            cancelToken: source.token
        };

        if (data) {
            config.data = data;
        }

        return {
            request: this.instance(config),
            cancel: source.cancel
        };
    }

    get(url, customHeaders = {}) {
        return this.request('get', url, null, customHeaders);
    }

    post(url, data, customHeaders = {}) {
        return this.request('post', url, data, customHeaders);
    }

    put(url, data, customHeaders = {}) {
        return this.request('put', url, data, customHeaders);
    }

    delete(url, customHeaders = {}) {
        return this.request('delete', url, null, customHeaders);
    }

    postFormData(url, formData: FormData) {
        const ls = JSON.parse(localStorage.getItem("Golf_Scoring_User"));
        const headers = {
            'Authorization': "Bearer " + ls?.authorisation?.token,
            'Content-Type': 'multipart/form-data',
            'Allow-Credentials': 'true',
        };
        const source = axios.CancelToken.source();

        const config = {
            method: 'post',
            url,
            headers,
            data: formData,
            cancelToken: source.token
        };

        return {
            request: this.instance(config),
            cancel: source.cancel
        };
    }
}

