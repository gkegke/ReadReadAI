import type { Chunk } from "../types/schema";

export interface Chapter {
  id: string;
  title: string;
  chunks: Chunk[];
  isVirtual?: boolean;
  startIndex: number;
  endIndex: number;
}

/**
 * [ARCHITECTURE] True Virtual Splitting
 * Breaks down massive documents into manageable logical chunks.
 */
export function deriveChapters(chunks: Chunk[]): Chapter[] {
  const result: Chapter[] = [];
  const MAX_CHUNKS_PER_VIRTUAL_CHAPTER = 100;

  let currentChapter: Chapter = {
    id: "start",
    title: "Main Manuscript",
    chunks: [],
    startIndex: 0,
    endIndex: 0
  };

  let partCounter = 1;

  chunks.forEach((c, index) => {
    if (c.role === "heading") {
      if (currentChapter.chunks.length > 0 || currentChapter.id !== "start") {
        currentChapter.endIndex = index - 1;
        result.push(currentChapter);
      }
      currentChapter = {
        id: String(c.id),
        title: c.textContent,
        chunks: [c],
        startIndex: index,
        endIndex: index
      };
      partCounter = 1;
      return;
    }

    if (currentChapter.chunks.length >= MAX_CHUNKS_PER_VIRTUAL_CHAPTER) {
       currentChapter.endIndex = index - 1;
       result.push(currentChapter);
       partCounter++;
       const baseTitle = currentChapter.title.replace(/ \(Part \d+\)$/, '');
       currentChapter = {
           id: `${currentChapter.id}-part-${partCounter}`,
           title: `${baseTitle} (Part ${partCounter})`,
           chunks: [],
           isVirtual: true,
           startIndex: index,
           endIndex: index
       };
    }
    currentChapter.chunks.push(c);
  });

  if (currentChapter.chunks.length > 0) {
    currentChapter.endIndex = chunks.length - 1;
    result.push(currentChapter);
  }
  return result;
}

/**
 * [CORE LOGIC: PRAGMATIC VISIBILITY]
 * Replaces the buggy IntersectionObserver logic.
 * Rule: Expand chapters by default until we hit a cumulative limit of chunks.
 * This ensures small/medium projects are fully visible, while massive ones
 * are "folded" safely to protect the human from information overload.
 */
export function calculateChapterVisibility(
    chapterId: string,
    index: number,
    allChapters: Chapter[],
    userToggledChapters: Record<string, boolean>,
    chunkLimit = 250 // [HUMAN-FIRST] Approx 20-30 mins of reading time visible by default
): boolean {
    // 1. Manual User Override (The "Power to the User" Principle)
    const manualState = userToggledChapters[chapterId];
    if (manualState !== undefined) return manualState;

    // 2. Cumulative "First N" Logic
    // We count how many chunks precede this chapter.
    let cumulativeChunks = 0;
    for (let i = 0; i < index; i++) {
        cumulativeChunks += allChapters[i].chunks.length;
    }

    // If we haven't hit the limit yet, keep it expanded.
    return cumulativeChunks < chunkLimit;
}
