/**
 * Text Processing Service (V2)
 * Focused on Prosody-First chunking for TTS.
 */

export function hashText(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Semantic Chunking Strategy
 * Hierarchical split: Paragraphs -> Sentences -> Clauses.
 * CRITICAL (Imp: 10/10): This ensures chunks end at "Breath Groups," 
 * avoiding the mechanical cadence caused by character-limit slicing.
 */
export function chunkText(text: string, maxChunkSize = 800): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const finalChunks: string[] = [];
    
    // Level 1: Split into Paragraphs
    const paragraphs = normalized.split(/\n\n+/);

    for (const paragraph of paragraphs) {
        if (paragraph.length <= maxChunkSize) {
            finalChunks.push(paragraph.trim());
        } else {
            // Level 2: Sentence Segmentation
            const sentences = splitIntoSentences(paragraph);
            let currentAccumulator = "";

            for (const sentence of sentences) {
                if ((currentAccumulator.length + sentence.length) <= maxChunkSize) {
                    currentAccumulator += (currentAccumulator ? " " : "") + sentence;
                } else {
                    if (currentAccumulator) finalChunks.push(currentAccumulator.trim());
                    
                    if (sentence.length > maxChunkSize) {
                        // Level 3: Clause-based split (Commas, Semicolons)
                        const clauses = splitIntoClauses(sentence, maxChunkSize);
                        finalChunks.push(...clauses);
                        currentAccumulator = "";
                    } else {
                        currentAccumulator = sentence;
                    }
                }
            }
            if (currentAccumulator) finalChunks.push(currentAccumulator.trim());
        }
    }

    return finalChunks.filter(c => c.length > 0);
}

/** Uses native Intl API for localized sentence boundaries */
function splitIntoSentences(text: string): string[] {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
    return Array.from(segmenter.segment(text)).map(s => s.segment.trim());
}

/** Fallback for extreme cases: splitting long sentences by commas or semicolons */
function splitIntoClauses(text: string, limit: number): string[] {
    // Split by common breath markers
    const parts = text.split(/([,;:]\s+)/);
    const result: string[] = [];
    let current = "";

    for (const part of parts) {
        if ((current.length + part.length) <= limit) {
            current += part;
        } else {
            if (current) result.push(current.trim());
            // Hard cut if a single clause is still too long
            if (part.length > limit) {
                const subParts = part.match(new RegExp(`.{1,${limit}}`, 'g')) || [];
                result.push(...subParts);
                current = "";
            } else {
                current = part;
            }
        }
    }
    if (current) result.push(current.trim());
    return result;
}