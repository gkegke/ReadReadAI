/**
 * Text processing utilities.
 * 
 * Updated for Epic 2: Robust NLP using Intl.Segmenter.
 * This replaces the previous naive regex split logic to correctly handle
 * abbreviations (Mr., Dr., e.g.) and complex punctuation.
 */

// Simple hash function for text (DJB2 variant)
// Used to generate cache keys for audio blobs
export function hashText(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
  }
  return (hash >>> 0).toString(16);
}

/**
 * Split text into chunks respecting sentence boundaries.
 * Uses the browser's native Intl.Segmenter for locale-aware segmentation.
 * 
 * @param text - The full text content
 * @param targetChunkSize - Soft target for chunk size (default 1000 chars)
 */
export function chunkText(text: string, targetChunkSize = 1000): string[] {
  // 1. Normalize Whitespace
  // PDF extraction often leaves hard wraps (\n) inside paragraphs. 
  // We replace them with spaces to allow the segmenter to see the full sentence.
  // We also collapse multiple spaces into one.
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  
  if (!normalizedText) return [];

  const chunks: string[] = [];
  let currentBuffer = '';

  // 2. Initialize Native Segmenter
  // Fallback for very old browsers (though app requires modern features for WASM/OPFS)
  const segmenter = typeof Intl.Segmenter !== 'undefined' 
    ? new Intl.Segmenter('en', { granularity: 'sentence' })
    : null;

  if (!segmenter) {
    console.warn("Intl.Segmenter not supported. Falling back to simple split.");
    return fallbackSimpleChunk(normalizedText, targetChunkSize);
  }

  const segments = segmenter.segment(normalizedText);

  // 3. Iterate Segments
  for (const { segment } of segments) {
    const cleanSegment = segment.trim();
    if (!cleanSegment) continue;

    // Check if adding this sentence exceeds the limit
    if (currentBuffer.length + cleanSegment.length + 1 > targetChunkSize) {
      
      // A. If buffer has content, flush it first
      if (currentBuffer.length > 0) {
        chunks.push(currentBuffer.trim());
        currentBuffer = '';
      }

      // B. Handle the specific case where a SINGLE sentence is larger than the limit.
      // We must split this sentence by words to fit the model's context window.
      if (cleanSegment.length > targetChunkSize) {
        const subChunks = splitGiantSentence(cleanSegment, targetChunkSize);
        chunks.push(...subChunks);
      } else {
        // Otherwise, this sentence fits in a new empty buffer
        currentBuffer = cleanSegment;
      }

    } else {
      // Append to buffer
      currentBuffer += (currentBuffer ? ' ' : '') + cleanSegment;
    }
  }

  // 4. Flush remaining buffer
  if (currentBuffer) {
    chunks.push(currentBuffer.trim());
  }

  return chunks;
}

/**
 * Fallback logic for environments without Intl.Segmenter (unlikely, but safe).
 * Logic mimics the previous implementation.
 */
function fallbackSimpleChunk(text: string, size: number): string[] {
  // Naive split by period, usually fails on "Mr."
  const sentences = text.split('. '); 
  const chunks: string[] = [];
  let current = '';
  
  for (const s of sentences) {
    const sentence = s + '.'; // Add period back
    if (current.length + sentence.length > size) {
        if(current) chunks.push(current.trim());
        current = sentence;
    } else {
        current += ' ' + sentence;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

/**
 * Helper to split a massive sentence (legal text, run-on sentences) 
 * into smaller pieces based on word boundaries.
 */
function splitGiantSentence(sentence: string, limit: number): string[] {
  const words = sentence.split(' ');
  const result: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > limit) {
      if (current) result.push(current.trim());
      current = word;
    } else {
      current += (current ? ' ' : '') + word;
    }
  }
  if (current) result.push(current.trim());
  return result;
}