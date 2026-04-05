/**
 * Shared utilities for text processing and networking across engines.
 */
import ky from 'ky';
import { logger } from '../../../shared/services/Logger';

/**
 * Standardized Fetcher for AI Models and Assets.
 * [Implements retries and timeouts for large binary assets
 * which are prone to failure on mobile/unstable connections.
 */
export const assetClient = ky.create({
    timeout: 60000, // 60s for large model chunks
    retry: {
        limit: 3,
        methods: ['get'],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
        backoffLimit: 3000
    },
    hooks: {
        beforeRetry: [
            async ({ request, retryCount }) => {
                logger.warn('Network', `Retrying asset download (${retryCount}/3): ${request.url}`);
            }
        ]
    }
});

/**
 * Caches and retrieves binary assets using the browser Cache API.
 * Leverages 'ky' for the underlying request logic.
 */
export async function cachedFetch(url: string): Promise<Response> {
    const cacheName = 'readread-model-cache-v1';
    const cache = await caches.open(cacheName);

    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
        return cachedResponse;
    }

    // Use ky for the request to get robust retry/timeout logic
    const response = await assetClient.get(url);

    // We must clone the response before putting it in cache and returning it
    if (response.ok) {
        cache.put(url, response.clone());
    }
    return response;
}

export function cleanTextForTTS(text: string): string {
    if (!text) return '';

    // Remove emojis using Unicode ranges
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE0F}]|[\u{200D}]/gu;

    return text.replace(emojiRegex, '')
        .replace(/\b\/\b/, ' slash ')
        .replace(/[\/\\()¯]/g, '')
        .replace(/["“”]/g, '')
        .replace(/\s—/g, '.')
        .replace(/\b_\b/g, ' ')
        .replace(/\b-\b/g, ' ')
        .replace(/[^\u0000-\u024F]/g, '') // Remove non-Latin
        .trim();
}
