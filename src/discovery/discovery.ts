import { SafeNetworkClient } from "../network/client";

export class SourceMapDiscovery {
    /**
     * Finds and securely downloads a Source Map for a given JS URL.
     */
    static async discover(
        jsUrl: string,
        customHeaders: Record<string, string> = {},
        allowInsecureTls: boolean = false,
    ): Promise<string> {
        const jsResponse = await SafeNetworkClient.fetchTarget(jsUrl, {
            headers: customHeaders,
            allowInsecureTls,
        });

        if (!jsResponse.ok) {
            throw new Error(`Failed to fetch JS file. HTTP ${jsResponse.status}`);
        }

        const jsContent = await jsResponse.text();

        const sourceMapRegex = /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+))/;
        const match = jsContent.match(sourceMapRegex);

        if (match) {
            const mapReference = match[1];

            if (mapReference.startsWith("data:application/json;base64,")) {
                const base64Data = mapReference.replace(
                    "data:application/json;base64,",
                    "",
                );
                return Buffer.from(base64Data, "base64").toString("utf-8");
            }

            const mapUrl = new URL(mapReference, jsUrl).href;
            return this.downloadMap(mapUrl, customHeaders, allowInsecureTls);
        }

        const fallbackUrls = [
            jsUrl + ".map", // app.js.map
            jsUrl.replace(/\.js$/, ".map"), // app.map
            jsUrl.replace(/\.min\.js$/, ".min.map"), // app.min.map
            jsUrl.replace(/\.js$/, ".js.map"),
        ];

        const uniqueFallbacks = [...new Set(fallbackUrls)];

        for (const url of uniqueFallbacks) {
            if (url === jsUrl) continue;
            try {
                return await this.downloadMap(url, customHeaders, allowInsecureTls);
            } catch (e) { }
        }

        throw new Error(`Could not find a valid Source Map. Fallbacks exhausted.`);
    }

    private static async downloadMap(
        mapUrl: string,
        headers: Record<string, string>,
        allowInsecureTls: boolean,
    ): Promise<string> {
        const mapResponse = await SafeNetworkClient.fetchTarget(mapUrl, {
            headers,
            allowInsecureTls,
        });

        if (!mapResponse.ok) throw new Error(`HTTP ${mapResponse.status}`);

        const contentType = mapResponse.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
            throw new Error(
                `Target returned HTML instead of Source Map (Possible WAF/404)`,
            );
        }

        return await mapResponse.text();
    }
}
