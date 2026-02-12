/**
 * Shared utilities for text processing across engines
 */
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

// Simple caching fetch wrapper
export async function cachedFetch(url: string): Promise<Response> {
    const cacheName = 'readread-model-cache-v1';
    const cache = await caches.open(cacheName);
    
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
        return cachedResponse;
    }

    const response = await fetch(url);
    if (response.ok) {
        cache.put(url, response.clone());
    }
    return response;
}