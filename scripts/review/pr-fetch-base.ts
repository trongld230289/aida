/**
 * @module pr-fetch-base
 * @description Shared HTTPS request logic for Azure DevOps, GitHub, and GitLab PR fetching.
 *
 * Each provider-specific module (`pr-fetch-azure`, `pr-fetch-github`, `pr-fetch-gitlab`)
 * previously duplicated a full HTTPS-request function with only minor differences
 * (auth header format, default Accept header, timeout setting).
 *
 * This module extracts the ~80-line common pattern into a single `makeHttpsRequest`
 * function that accepts a typed options bag for provider-specific behaviour.
 */

import * as https from 'https';
import { toError } from '../core/error-utils';

// ─── Types ───────────────────────────────────────────────────────────

export interface IHttpsRequestOptions {
    /** Full URL to call. */
    url: string;

    /** HTTP method (default: 'GET'). */
    method?: string;

    /** Auth token (sent via `authHeaderFn`). */
    token?: string;

    /**
     * Provider-specific function that returns a header object
     * containing the Authorization (or equivalent) entry.
     *
     * @example Azure:  (t) => ({ Authorization: `Basic ${Buffer.from(':' + t).toString('base64')}` })
     * @example GitHub: (t) => ({ Authorization: `Bearer ${t}` })
     * @example GitLab: (t) => ({ 'PRIVATE-TOKEN': t })
     */
    authHeaderFn?: (token: string) => Record<string, string>;

    /** Extra / custom headers merged on top of `defaultHeaders`. */
    extraHeaders?: Record<string, string>;

    /** Default headers included in every request. */
    defaultHeaders?: Record<string, string>;

    /** Request body (for POST/PUT/PATCH). Will be JSON-stringified. */
    body?: Record<string, unknown> | null;

    /** Request timeout in milliseconds. */
    timeoutMs?: number;

    /**
     * A predicate that inspects the response headers to decide
     * whether the body should be returned as raw text instead of JSON.
     *
     * @example GitHub diff:  (h) => h['content-type']?.includes('diff')
     * @example GitLab diff:  (h) => customHeaders['Accept']?.includes('text/plain')
     */
    isTextResponse?: (headers: Record<string, string>) => boolean;

    /**
     * Provider-specific error messages for common HTTP status codes.
     * Falls through to a generic message if a code is not listed.
     */
    errorMessages?: Partial<Record<number, string>>;
}

export interface IHttpsResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

// ─── Shared request implementation ───────────────────────────────────

/**
 * Make an HTTPS request following the shared PR-fetch pattern:
 *
 * 1. Construct headers (default + auth + custom).
 * 2. Fire an `https.request`.
 * 3. Collect the response body.
 * 4. On 2xx → parse as JSON (or return raw text if `isTextResponse` matches).
 * 5. On error → return a typed error message.
 * 6. Respect configurable timeout.
 */
export async function makeHttpsRequest<T = unknown>(
    opts: IHttpsRequestOptions,
): Promise<IHttpsResponse<T>> {
    return new Promise<IHttpsResponse<T>>((resolve) => {
        const urlObj = new URL(opts.url);
        const method = opts.method ?? 'GET';

        // ── Build headers ────────────────────────────────────────
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'VSCode-AI-Self-Check-Extension',
            ...(opts.defaultHeaders ?? {}),
            ...(opts.extraHeaders ?? {}),
        };

        if (opts.token && opts.token.trim() && opts.authHeaderFn) {
            Object.assign(headers, opts.authHeaderFn(opts.token));
        }

        const requestOptions: https.RequestOptions = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method,
            rejectUnauthorized: false, // Corporate SSL environments
            headers,
        };

        const req = https.request(requestOptions, (res) => {
            let data = '';

            res.on('data', (chunk: Buffer) => {
                data += String(chunk);
            });

            res.on('end', () => {
                try {
                    const statusCode = res.statusCode ?? 0;

                    if (statusCode >= 200 && statusCode < 300) {
                        // Text response path (diffs, plain-text downloads, etc.)
                        if (opts.isTextResponse?.(opts.extraHeaders ?? {})) {
                            resolve({ success: true, data: data as unknown as T });
                            return;
                        }
                        // JSON response path
                        const parsed = JSON.parse(data) as T;
                        resolve({ success: true, data: parsed });
                    } else {
                        // Error path
                        const custom = opts.errorMessages?.[statusCode];
                        if (custom) {
                            resolve({ success: false, error: custom });
                            return;
                        }

                        let errorMsg = `HTTP ${statusCode}`;
                        try {
                            const errorData = JSON.parse(data);
                            const msg = errorData.message ?? errorData.typeKey ?? errorData.error ?? 'Unknown error';
                            errorMsg += `: ${msg}`;
                        } catch {
                            const statusText = res.statusMessage ?? 'Error';
                            errorMsg += `: ${statusText}`;
                        }
                        resolve({ success: false, error: errorMsg });
                    }
                } catch (_parseError: unknown) {
                    const parseError = toError(_parseError);
                    resolve({ success: false, error: `Parse error: ${parseError.message}` });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        if (opts.timeoutMs && opts.timeoutMs > 0) {
            req.setTimeout(opts.timeoutMs, () => {
                req.destroy();
                resolve({ success: false, error: 'Request timeout' });
            });
        }

        if (opts.body) {
            req.write(JSON.stringify(opts.body));
        }

        req.end();
    });
}

// ─── Provider-specific factory helpers ───────────────────────────────

/** Standard error messages for Azure DevOps. */
export const AZURE_ERROR_MESSAGES: Partial<Record<number, string>> = {
    401: 'HTTP 401 Unauthorized - Personal Access Token (PAT) is expired or invalid. Please create a new PAT at Azure DevOps > User Settings > Personal Access Tokens.',
    403: 'HTTP 403 Forbidden - Access denied. Check your PAT permissions (need Code > Read scope).',
    404: 'HTTP 404 Not Found - PR, repository, or project not found. Check the URL.',
};

/** Standard error messages for GitHub. */
export const GITHUB_ERROR_MESSAGES: Partial<Record<number, string>> = {
    401: 'HTTP 401 Unauthorized - Token is expired or invalid. Please create a new token.',
    403: 'HTTP 403 Forbidden - Access denied. Check your token permissions.',
    404: 'HTTP 404 Not Found - PR, repository, or resource not found. Check the URL.',
};

/** Standard error messages for GitLab. */
export const GITLAB_ERROR_MESSAGES: Partial<Record<number, string>> = {
    401: 'HTTP 401 Unauthorized - Token is expired or invalid. Please create a new token.',
    403: 'HTTP 403 Forbidden - Access denied. Check your token permissions.',
    404: 'HTTP 404 Not Found - MR, project, or resource not found. Check the URL.',
};

/** Azure DevOps auth: Basic `:token` (base64). */
export function azureAuthHeader(token: string): Record<string, string> {
    return { Authorization: `Basic ${Buffer.from(':' + token).toString('base64')}` };
}

/** GitHub auth: Bearer token. */
export function githubAuthHeader(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
}

/** GitLab auth: PRIVATE-TOKEN header. */
export function gitlabAuthHeader(token: string): Record<string, string> {
    return { 'PRIVATE-TOKEN': token };
}

// ─── CJS dual export for backward compatibility ──────────────────────
