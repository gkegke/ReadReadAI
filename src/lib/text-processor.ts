/**
 * Text processing utilities using native Web APIs.
 */

// Simple hash function for text (DJB2 variant)
export function hashText(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function generateAssetSignature(text: string, voiceId: string, speed: number, modelId: string): string {
    const raw = `${hashText(text)}|${voiceId}|${speed.toFixed(2)}|${modelId}`;
    return hashText(raw);
}

/**
 * Split text into chunks using native Intl.Segmenter.
 * This ensures sentence boundaries are respected without external dependencies.
 */
export function chunkText(text: string, targetChunkSize = 1000): string[] {
  const normalizedText = text.replace(/\r\n/g, '\n').trim();
  if (!normalizedText) return [];

  // Use native sentence segmenter
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
  const segments = Array.from(segmenter.segment(normalizedText));
  
  const chunks: string[] = [];
  let currentChunk = "";

  for (const segment of segments) {
    const sentence = segment.segment;
    
    // If adding this sentence exceeds chunk size, push current and start new
    if ((currentChunk.length + sentence.length) > targetChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}