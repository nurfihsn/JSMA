export async function findAndDownloadSourceMap(jsUrl: string, customHeaders: Record<string, string> = {}): Promise<string> {
    console.log(`[i] Fetching target: ${jsUrl}`);

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) JS-SourceMap-Archaeologist/0.1',
        ...customHeaders
    };

    const jsResponse = await fetch(jsUrl, { headers });

    if (!jsResponse.ok) {
        throw new Error(`Failed to fetch JS file. HTTP ${jsResponse.status}`);
    }

    const jsContent = await jsResponse.text();

    const sourceMapRegex = /(?:\/\/[@#][ \t]+sourceMappingURL=([^\s'"]+))/;
    const match = jsContent.match(sourceMapRegex);

    if (match) {
        const mapReference = match[1];

        if (mapReference.startsWith('data:application/json;base64,')) {
            console.log(`[+] Found Inline Base64 Source Map!`);
            const base64Data = mapReference.replace('data:application/json;base64,', '');
            return Buffer.from(base64Data, 'base64').toString('utf-8');
        }

        const mapUrl = new URL(mapReference, jsUrl).href;
        console.log(`[+] Found Source Map reference: ${mapUrl}`);
        return downloadMap(mapUrl, headers);
    }

    console.log(`[!] No sourceMappingURL found in file. Trying smart fallbacks...`);

    const fallbackUrls = [
        jsUrl + '.map',
        jsUrl.replace(/\.js$/, '.map'),
        jsUrl.replace(/\.min\.js$/, '.min.map'),
        jsUrl.replace(/\.js$/, '.js.map')
    ];

    const uniqueFallbacks = [...new Set(fallbackUrls)];

    for (const url of uniqueFallbacks) {
        if (url === jsUrl) continue;
        console.log(`[i] Trying fallback: ${url}`);
        try {
            return await downloadMap(url, headers);
        } catch (e) {

        }
    }

    throw new Error(`Could not find a valid Source Map after trying multiple fallbacks.`);
}

async function downloadMap(mapUrl: string, headers: Record<string, string>): Promise<string> {
    const mapResponse = await fetch(mapUrl, { headers });

    if (!mapResponse.ok) {
        throw new Error(`HTTP ${mapResponse.status}`);
    }

    const contentType = mapResponse.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
        throw new Error(`Target returned HTML instead of Source Map`);
    }

    return await mapResponse.text();
}