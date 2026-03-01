import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/**
 * Text Processing Service (V3)
 * Focused on Prosody-First chunking for TTS using LangChain.
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
 * Uses RecursiveCharacterTextSplitter to handle hierarchy (Paragraph -> Sentence -> Clause).
 * This ensures chunks end at "Breath Groups," avoiding mechanical cadence.
 */
// [CRITICAL FIX] Decreased max chunk size to 400 to prevent exceeding the 512 token
// sequence length limits typical of edge/web ONNX models.
export async function chunkText(text: string, maxChunkSize = 400): Promise<string[]> {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    // Industry standard splitter configuration
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: maxChunkSize,
        chunkOverlap: 0, // No overlap for TTS to prevent repeat reading
        separators: ["\n\n", "\n", ".", "?", "!", ";", ",", " ", ""],
    });

    const output = await splitter.createDocuments([normalized]);
    
    // Clean up results and filter out empty strings
    return output
        .map(doc => doc.pageContent.trim())
        .filter(content => content.length > 0);
}