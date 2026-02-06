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

export function generateAssetSignature(text: string, voiceId: string, speed: number, modelId: string): string {
    const raw = `${hashText(text)}|${voiceId}|${speed.toFixed(2)}|${modelId}`;
    return hashText(raw);
}

/**
 * Split text into chunks respecting semantic boundaries.
 * Hierarchy: Newlines -> Sentences -> Clauses -> Words
 */
export function chunkText(text: string, targetChunkSize = 1000): string[] {
  const normalizedText = text.replace(/\r\n/g, '\n').trim();
  if (!normalizedText) return [];

  // 1. First pass: Split by logical paragraphs/newlines to preserve document structure
  const paragraphs = normalizedText.split(/\n+/);
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= targetChunkSize) {
      result.push(paragraph);
    } else {
      // 2. Second pass: Split paragraphs into sentences
      result.push(...splitBySentences(paragraph, targetChunkSize));
    }
  }

  // 3. Cleanup: Merge very small chunks with neighbors if possible to avoid audio hiccups
  return mergeSmallChunks(result, targetChunkSize);
}

function splitBySentences(text: string, limit: number): string[] {
  // Use Intl.Segmenter if available (most modern browsers)
  if (typeof Intl.Segmenter !== 'undefined') {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
    const segments = Array.from(segmenter.segment(text)).map(s => s.segment.trim()).filter(Boolean);
    
    return aggregateChunks(segments, limit, splitByClauses);
  } else {
    // Fallback for older environments
    const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
    return aggregateChunks(sentences.map(s => s.trim()), limit, splitByClauses);
  }
}

function splitByClauses(sentence: string, limit: number): string[] {
  // Split by major punctuation marks that indicate pauses
  const clauses = sentence.split(/([,;:—])/).reduce((acc, curr, i, arr) => {
     if (i % 2 === 0) {
         // This is the text part
         let part = curr;
         // If there is a next part (punctuation), attach it
         if (arr[i + 1]) part += arr[i + 1];
         acc.push(part.trim());
     }
     return acc;
  }, [] as string[]).filter(Boolean);

  return aggregateChunks(clauses, limit, splitByWords);
}

function splitByWords(text: string, limit: number): string[] {
    const words = text.split(' ');
    return aggregateChunks(words, limit, (t) => [t.substring(0, limit), t.substring(limit)]); // Hard split fallback
}

// Helper: Aggregates smaller units (sentences/clauses) into chunks up to 'limit'
// If a single unit exceeds limit, calls 'fallbackSplitter' on it
function aggregateChunks(
    units: string[], 
    limit: number, 
    fallbackSplitter: (text: string, limit: number) => string[]
): string[] {
    const chunks: string[] = [];
    let currentBuffer = '';

    for (const unit of units) {
        if (currentBuffer.length + unit.length + 1 > limit) {
            // Buffer full, push it
            if (currentBuffer) {
                chunks.push(currentBuffer.trim());
                currentBuffer = '';
            }

            // Is the unit itself too big?
            if (unit.length > limit) {
                chunks.push(...fallbackSplitter(unit, limit));
            } else {
                currentBuffer = unit;
            }
        } else {
            currentBuffer += (currentBuffer ? ' ' : '') + unit;
        }
    }

    if (currentBuffer) chunks.push(currentBuffer.trim());
    return chunks;
}

function mergeSmallChunks(chunks: string[], limit: number): string[] {
    if (chunks.length < 2) return chunks;
    
    const merged: string[] = [];
    let current = chunks[0];

    for (let i = 1; i < chunks.length; i++) {
        const next = chunks[i];
        if (current.length + next.length + 1 <= limit) {
            current += ' ' + next;
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    return merged;
}