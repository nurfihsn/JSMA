import { fetch, Agent } from "undici";

interface FetchOptions {
    headers?: Record<string, string>;
    timeoutMs?: number;
    allowInsecureTls?: boolean;
}

export class SafeNetworkClient {
    static async fetchTarget(
        url: string,
        options: FetchOptions = {},
    ): Promise<any> {
        const timeout = options.timeoutMs || 10000;

        const dispatcher = new Agent({
            connect: {
                rejectUnauthorized: !(options.allowInsecureTls === true),
            },
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "JSMA Security Analyzer/1.0",
                    Accept: "*/*",
                    ...options.headers,
                },
                redirect: "follow",
                signal: controller.signal,
                dispatcher: dispatcher,
            });

            const contentLength = response.headers.get("content-length");
            if (contentLength && parseInt(contentLength, 10) > 50 * 1024 * 1024) {
                throw new Error("Response payload exceeds 50MB limit.");
            }

            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
