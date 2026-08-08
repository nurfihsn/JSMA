import { SourceMapConsumer } from 'source-map-js';
import { ExtractedFile } from '../types';
import path from 'path';

export function extractSources(rawSourceMap: string): ExtractedFile[] {
    const parsed = JSON.parse(rawSourceMap);
    const consumer = new SourceMapConsumer(parsed);
    const files: ExtractedFile[] = [];

    consumer.sources.forEach((sourcePath) => {
        const content = consumer.sourceContentFor(sourcePath, true);
        if (content) {

            let cleanPath = sourcePath.replace(/^webpack:\/\/\//, '');
            cleanPath = cleanPath.replace(/^webpack:\/\/.*\//, '');

            cleanPath = path.normalize(cleanPath).replace(/^(\.\.[\/\\])+/, '');

            const isVendor = cleanPath.includes('node_modules') || cleanPath.includes('~');

            files.push({
                path: cleanPath,
                content: content,
                isVendor
            });
        }
    });

    return files;
}