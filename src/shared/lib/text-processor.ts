import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export function hashText(str: string, voiceId?: string): string {
  let combined = voiceId ? `${voiceId}:${str}` : str;
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) + combined.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Semantic Chunking Strategy
 */
export async function chunkText(text: string, maxChunkSize = 400): Promise<string[]> {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: maxChunkSize,
        chunkOverlap: 0,
        separators: ["\n\n", "\n", ".", "?", "!", ";", ",", " ", ""],
    });

    const output = await splitter.createDocuments([normalized]);

    return output
        .map(doc => doc.pageContent.trim())
        .filter(content => content.length > 0);
}
