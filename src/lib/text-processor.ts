/**
 * Text processing utilities.
 */

// Simple hash function for text (DJB2 variant)
export function hashText(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// EPIC 1: Generate a unique signature for audio assets
// Used to find if we already have a generated file for these exact parameters
export function generateAssetSignature(text: string, voiceId: string, speed: number, modelId: string): string {
    const raw = `${hashText(text)}|${voiceId}|${speed.toFixed(2)}|${modelId}`;
    return hashText(raw);
}

/**
 * Split text into chunks respecting sentence boundaries.
 * Uses Intl.Segmenter or fallback.
 */
export function chunkText(text: string, targetChunkSize = 1000): string[] {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  
  if (!normalizedText) return [];

  const chunks: string[] = [];
  let currentBuffer = '';

  const segmenter = typeof Intl.Segmenter !== 'undefined' 
    ? new Intl.Segmenter('en', { granularity: 'sentence' })
    : null;

  if (!segmenter) {
    return fallbackSimpleChunk(normalizedText, targetChunkSize);
  }

  const segments = segmenter.segment(normalizedText);

  for (const { segment } of segments) {
    const cleanSegment = segment.trim();
    if (!cleanSegment) continue;

    if (currentBuffer.length + cleanSegment.length + 1 > targetChunkSize) {
      if (currentBuffer.length > 0) {
        chunks.push(currentBuffer.trim());
        currentBuffer = '';
      }

      if (cleanSegment.length > targetChunkSize) {
        const subChunks = splitGiantSentence(cleanSegment, targetChunkSize);
        chunks.push(...subChunks);
      } else {
        currentBuffer = cleanSegment;
      }

    } else {
      currentBuffer += (currentBuffer ? ' ' : '') + cleanSegment;
    }
  }

  if (currentBuffer) {
    chunks.push(currentBuffer.trim());
  }

  return chunks;
}

function fallbackSimpleChunk(text: string, size: number): string[] {
  const sentences = text.split('. '); 
  const chunks: string[] = [];
  let current = '';
  
  for (const s of sentences) {
    const sentence = s + '.'; 
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