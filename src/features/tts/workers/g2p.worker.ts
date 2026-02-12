import ESpeakNg from 'espeak-ng';

let modulePromise: Promise<any> | null = null;

function getModule(): Promise<any> {
    if (modulePromise) return modulePromise;

    const ModuleConfig = {
        locateFile: (path: string) => {
            if (path.endsWith('.wasm')) return '/wasm/espeak-ng.wasm';
            return path;
        },
        noInitialRun: true,
        print: () => {}, // Silence stdout
        printErr: (text: string) => {
            if (!text.includes('Aborted')) console.warn(`[espeak-err] ${text}`);
        }
    };

    // @ts-ignore
    modulePromise = ESpeakNg(ModuleConfig);
    return modulePromise!;
}

/**
 * Correctly invokes Emscripten _main by allocating a C-style argv array
 */
async function runEspeak(text: string, lang: string): Promise<string> {
    const mod = await getModule();
    const id = Math.random().toString(36).substring(7);
    const outputFilename = `/tmp/out_${id}`;
    
    // Arguments for espeak-ng
    const args = ['espeak-ng', '--ipa=3', '-v', lang, '-q', '--phonout', outputFilename, text];

    // 1. Prepare Arguments in WASM Memory
    const argc = args.length;
    const argv = mod._malloc(argc * 4); // 4 bytes per pointer (32-bit WASM)

    const argPointers: number[] = [];
    args.forEach((arg, i) => {
        const ptr = mod._malloc(arg.length + 1);
        mod.writeAsciiToMemory(arg, ptr);
        mod.setValue(argv + i * 4, ptr, 'i32');
        argPointers.push(ptr);
    });

    try {
        // 2. Ensure virtual filesystem structure
        if (!mod.FS.analyzePath('/tmp').exists) {
            mod.FS.mkdir('/tmp');
        }

        // 3. Execute main
        mod._main(argc, argv);

        // 4. Read results
        if (mod.FS.analyzePath(outputFilename).exists) {
            const raw = mod.FS.readFile(outputFilename, { encoding: 'utf8' });
            mod.FS.unlink(outputFilename);
            return raw.trim().replace(/\n/g, ' ');
        } else {
            throw new Error("G2P: No output file generated.");
        }
    } finally {
        // 5. Cleanup memory to avoid leaks
        argPointers.forEach(ptr => mod._free(ptr));
        mod._free(argv);
    }
}

self.onmessage = async (e: MessageEvent) => {
    const { id, text, lang = 'en-us' } = e.data;
    if (!text) return;

    try {
        const phonemes = await runEspeak(text, lang);
        postMessage({ id, phonemes });
    } catch (err) {
        console.error(`[G2P Worker] Execution error`, err);
        // Fallback: simplified clean text
        const fallback = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        postMessage({ id, phonemes: fallback });
    }
};

postMessage({ type: 'READY' });