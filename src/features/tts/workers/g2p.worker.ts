import ESpeakNg from 'espeak-ng';

/**
 * G2P Worker (Robust V2)
 * FIX: Replaced unsupported 'callMain' invocation with standard
 * Constructor-Argument pattern supported by the espeak-ng npm package.
 */

interface ESpeakModuleConfig {
    locateFile: (path: string) => string;
    arguments?: string[];
    print?: (msg: string) => void;
    printErr?: (msg: string) => void;
}

// Simple in-memory cache for common words to avoid WASM overhead
const PHONEME_CACHE = new Map<string, string>();

async function runEspeak(text: string, lang: string): Promise<string> {
    const cacheKey = `${lang}:${text}`;
    if (PHONEME_CACHE.has(cacheKey)) return PHONEME_CACHE.get(cacheKey)!;

    const id = Math.random().toString(36).substring(7);
    const outputFilename = `out_${id}.txt`;

    // 1. Configure the module run
    // We instantiate a NEW module for every run. This is the only robust way 
    // to use the standard NPM package which doesn't export reusable 'callMain'.
    const ModuleConfig: ESpeakModuleConfig = {
        locateFile: (path: string) => {
            if (path.endsWith('.wasm')) return '/wasm/espeak-ng.wasm';
            return path;
        },
        // CRITICAL: Pass arguments here to trigger internal main() logic
        arguments: [
            '--ipa=3', 
            '-v', lang, 
            '-q', // Quiet
            '--phonout', outputFilename, 
            `"${text.replace(/"/g, '')}"` // Simple quote sanitization
        ],
        print: () => {}, 
        printErr: (text: string) => {
            if (!text.includes('Aborted') && !text.includes('program exited')) {
                console.warn(`[espeak-log] ${text}`);
            }
        }
    };

    try {
        // @ts-ignore - The typedefs for espeak-ng are often incomplete
        const mod = await ESpeakNg(ModuleConfig);

        // 2. Read the virtual file output
        // The module automatically runs, writes to FS, and then we read it.
        if (mod.FS.analyzePath(outputFilename).exists) {
            const raw = mod.FS.readFile(outputFilename, { encoding: 'utf8' });
            
            // Cleanup virtual file
            mod.FS.unlink(outputFilename);
            
            const result = raw.trim().replace(/\n/g, ' ');
            
            // Cache results (mostly for short phrases)
            if (text.length < 50) PHONEME_CACHE.set(cacheKey, result);
            
            return result;
        } else {
            throw new Error("No output file created by espeak-ng");
        }
    } catch (e) {
        // If it's just an exit code, it might still have worked, but usually it throws.
        console.error("[G2P] WASM Execution Failed", e);
        throw e;
    }
}

/**
 * Fallback: Basic heuristic dictionary for when WASM crashes entirely.
 * Keeps the app usable even if G2P fails.
 */
function basicFallback(text: string): string {
    return text.toLowerCase()
        .replace(/the/g, 'ðə')
        .replace(/to/g, 'tu')
        .replace(/and/g, 'ænd')
        .replace(/ph/g, 'f')
        .replace(/sh/g, 'ʃ')
        .replace(/ch/g, 'tʃ')
        .replace(/th/g, 'θ')
        .replace(/ing/g, 'ɪŋ')
        .split('').join(''); // Spacing for "phoneme-like" appearance
}

self.onmessage = async (e: MessageEvent) => {
    const { id, text, lang = 'en-us' } = e.data;
    if (!text || typeof text !== 'string') return;

    try {
        const phonemes = await runEspeak(text, lang);
        postMessage({ id, phonemes });
    } catch (err) {
        console.warn("[G2P] Fallback Triggered");
        const fallback = basicFallback(text);
        postMessage({ id, phonemes: fallback });
    }
};

postMessage({ type: 'READY' });