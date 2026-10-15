import path from "path";
import fs from "fs/promises";

export function resolveSafeOutputPath(
    baseOutDir: string,
    virtualPath: string,
): string {
    let cleanPath = virtualPath.replace(
        /^(webpack:\/\/\/|webpack:\/\/|file:\/\/\/)/,
        "",
    );

    cleanPath = decodeURIComponent(cleanPath);

    const normalizedTarget = path
        .normalize(cleanPath)
        .replace(/^(\.\.[\/\\])+/, "");

    const absoluteBase = path.resolve(baseOutDir);
    const absoluteTarget = path.resolve(absoluteBase, normalizedTarget);

    if (!absoluteTarget.startsWith(absoluteBase + path.sep)) {
        throw new Error(
            `[SECURITY] Path traversal attempt blocked: ${virtualPath}`,
        );
    }

    return absoluteTarget;
}

export async function writeArtifactSafely(
    baseOutDir: string,
    virtualPath: string,
    content: string,
): Promise<void> {
    const safePath = resolveSafeOutputPath(baseOutDir, virtualPath);
    await fs.mkdir(path.dirname(safePath), { recursive: true });
    await fs.writeFile(safePath, content, "utf-8");
}
