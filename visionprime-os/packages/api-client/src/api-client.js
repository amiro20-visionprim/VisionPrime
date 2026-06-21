"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = exports.ApiClientError = void 0;
class ApiClientError extends Error {
    constructor(error) {
        super(error.message);
        this.name = "ApiClientError";
        this.code = error.code;
        this.details = error.details;
    }
}
exports.ApiClientError = ApiClientError;
class ApiClient {
    constructor(config) {
        this.config = config;
    }
    async get(path) {
        return this.request(path, { method: "GET" });
    }
    async post(path, body) {
        return this.request(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    }
    async request(path, init) {
        const response = await fetch(`${this.config.baseUrl}${path}`, init);
        const payload = (await response.json());
        if (!payload.success) {
            throw new ApiClientError(payload.error);
        }
        return payload.data;
    }
}
exports.ApiClient = ApiClient;
