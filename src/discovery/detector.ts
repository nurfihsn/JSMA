export async function findAndDownloadSourceMap(jsUrl: string, customHeaders: Record<string, string> = {}): Promise<string> {

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
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
            const base64Data = mapReference.replace('data:application/json;base64,', '');
            return Buffer.from(base64Data, 'base64').toString('utf-8');
        }

        const mapUrl = new URL(mapReference, jsUrl).href;
        return downloadMap(mapUrl, headers);
    }

    const fallbackUrls = [
        jsUrl + '.map',
        jsUrl.replace(/\.js$/, '.map'),
        jsUrl.replace(/\.min\.js$/, '.min.map'),
        jsUrl.replace(/\.js$/, '.js.map')
    ];

    const uniqueFallbacks = [...new Set(fallbackUrls)];

    for (const url of uniqueFallbacks) {
        if (url === jsUrl) continue;
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