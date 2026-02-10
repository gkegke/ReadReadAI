/**
 * G2P Worker
 * Uses the official espeak-ng WASM build (embedded data version).
 */
import ESpeakNg from 'espeak-ng';

let espeakInstance: any = null;
let isInitializing = false;

async function getEspeak() {
    if (espeakInstance) return espeakInstance;
    if (isInitializing) {
        while (!espeakInstance) await new Promise(r => setTimeout(r, 50));
        return espeakInstance;
    }

    isInitializing = true;
    try {
        console.log("[G2P Worker] Initializing espeak-ng WASM (Data Embedded)...");
        
        // The ianmarmour/espeak-ng build is a modularized Emscripten loader.
        // It embeds the espeak-ng-data into the binary.
        const instance = await ESpeakNg();
        
        // Test call to ensure VFS is ready
        instance.FS.mkdir('/tmp');
        
        espeakInstance = instance;
        console.log("[G2P Worker] espeak-ng is ready.");
        return espeakInstance;
    } catch (e) {
        console.error("[G2P Worker] Failed to init espeak-ng:", e);
        isInitializing = false;
        throw e;
    }
}

self.onmessage = async (e: MessageEvent) => {
    const { id, text, lang = 'en-us' } = e.data;
    
    try {
        const espeak = await getEspeak();

        // Execution logic:
        // We use the CLI-style arguments supported by the emscripten build
        // --ipa=3: Output IPA phonemes
        // -q: Quiet mode
        // --phonout: Write to a virtual file
        const outputFilename = `out_${id}`;
        
        espeak.ccall(
            'main', 'number', 
            ['number', 'array'], 
            [5, ['espeak-ng', '--ipa=3', '-v', lang, '-q', '--phonout', outputFilename, text]]
        );

        const phonemes = espeak.FS.readFile(outputFilename, { encoding: 'utf8' });
        espeak.FS.unlink(outputFilename); // Cleanup VFS

        // Normalize: espeak-ng adds newlines and sometimes leading spaces
        const result = phonemes.trim().replace(/\n/g, ' ');

        postMessage({ id, phonemes: result });
    } catch (err) {
        console.warn("[G2P Worker] Error, falling back to basic normalization", err);
        // Fallback: Basic clean text for models that handle it
        const fallback = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        postMessage({ id, phonemes: fallback });
    }
};

postMessage({ type: 'READY' });