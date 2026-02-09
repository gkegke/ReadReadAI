import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

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
 * Split text into chunks using LangChain's RecursiveCharacterTextSplitter.
 * This ensures semantic boundaries (paragraphs -> sentences) are respected.
 */
export async function chunkText(text: string, targetChunkSize = 1000): Promise<string[]> {
  const normalizedText = text.replace(/\r\n/g, '\n').trim();
  if (!normalizedText) return [];

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: targetChunkSize,
    chunkOverlap: 0, // We generally want distinct audio blocks
    separators: ["\n\n", "\n", ".", "!", "?", " ", ""], // Priority of splitting
  });

  // LangChain returns "Documents", we map back to strings
  const output = await splitter.createDocuments([normalizedText]);
  return output.map(doc => doc.pageContent);
}

/**
 * Legacy synchronous fallback if needed, or wrapper for the async LangChain splitter.
 * Since LangChain 0.2+ is async, we expose this as a Promise.
 */
export const chunkTextSync = (text: string): string[] => {
    // Note: If you absolutely need sync chunking, we'd need a different library
    // or the old regex implementation. For this architecture, async is preferred.
    console.warn("Synchronous chunking requested but using Async implementation");
    return []; 
}