import ESpeakNg from 'espeak-ng';

// Define the interface for the Emscripten Module Interaction
interface ESpeakModule {
    FS: {
        readFile: (path: string, opts: { encoding: string }) => string;
        unlink: (path: string) => void;
        mkdir: (path: string) => void;
        analyzePath: (path: string) => { exists: boolean };
    };
}

/**
 * CRITICAL
 * Runs espeak-ng in a "One-Shot" mode.
 * The installed WASM build does not export `callMain`, so we cannot reuse the instance.
 * Instead, we instantiate it fresh for every request, pass arguments via config,
 * and extract the result from the virtual filesystem in the postRun hook.
 */
async function runEspeak(text: string, lang: string): Promise<string> {
    const id = Math.random().toString(36).substring(7);
    const outputFilename = `/tmp/out_${id}`;
    
    // Command line arguments for espeak-ng
    // Note: 'arguments' in Emscripten config maps to argv[1]...argv[n]
    const args = ['--ipa=3', '-v', lang, '-q', '--phonout', outputFilename, text];

    return new Promise((resolve, reject) => {
        let result: string | null = null;

        const ModuleConfig = {
            // Pass arguments to the main() function of the C program
            arguments: args,
            
            // Locate the .wasm file explicitly
            locateFile: (path: string) => {
                if (path.endsWith('.wasm')) {
                    return '/wasm/espeak-ng.wasm';
                }
                return path;
            },
            
            // Allow main to run automatically
            noInitialRun: false, 

            // Setup the virtual filesystem before main runs
            preRun: [(module: any) => {
                try {
                    // Ensure /tmp exists
                    if (module.FS && !module.FS.analyzePath('/tmp').exists) {
                         module.FS.mkdir('/tmp');
                    }
                } catch (e) { /* Ignore if it fails, likely exists or not ready */ }
            }],

            // Capture output after main finishes
            postRun: [(module: any) => {
                try {
                    if (module.FS.analyzePath(outputFilename).exists) {
                        const raw = module.FS.readFile(outputFilename, { encoding: 'utf8' });
                        // Clean up
                        module.FS.unlink(outputFilename);
                        result = raw.trim().replace(/\n/g, ' ');
                    }
                } catch (e) {
                    console.warn("[espeak] Failed to read output file", e);
                }
            }],

            print: (text: string) => {
                 if(text.includes('Error')) console.warn("[espeak]", text);
            },
            printErr: (text: string) => {
                 // Suppress the Aborted warning if it's just about the exit status
                 if (!text.includes('Aborted')) console.warn("[espeak-err]", text);
            }
        };

        // Instantiate
        // @ts-ignore
        ESpeakNg(ModuleConfig).then((_module) => {
            // By the time the promise resolves, main() usually has run.
            // However, relying on postRun is safer for data extraction.
            if (result !== null) {
                resolve(result);
            } else {
                // If postRun didn't capture it, try one last check (rare race condition safeguard)
                try {
                    if (_module.FS.analyzePath(outputFilename).exists) {
                        const raw = _module.FS.readFile(outputFilename, { encoding: 'utf8' });
                        resolve(raw.trim().replace(/\n/g, ' '));
                        return;
                    }
                } catch(e) {}
                
                reject(new Error("Phonemization failed: No output generated."));
            }
        }).catch((err: any) => {
            reject(err);
        });
    });
}

self.onmessage = async (e: MessageEvent) => {
    const { id, text, lang = 'en-us' } = e.data;
    if (!text) return;

    try {
        const phonemes = await runEspeak(text, lang);
        postMessage({ id, phonemes });
    } catch (err) {
        console.warn(`[G2P Worker] Failed for "${text.slice(0,15)}...", using fallback.`, err);
        // Fallback: simple normalization to prevent pipeline stall
        const fallback = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        postMessage({ id, phonemes: fallback });
    }
};

postMessage({ type: 'READY' });