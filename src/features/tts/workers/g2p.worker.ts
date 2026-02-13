import * as Comlink from 'comlink';
import ESpeakNg from 'espeak-ng';

interface ESpeakModuleConfig {
    locateFile: (path: string) => string;
    arguments?: string[];
    print?: (msg: string) => void;
    printErr?: (msg: string) => void;
}

const PHONEME_CACHE = new Map<string, string>();

/**
 * G2P Worker Implementation
 * Exposed via Comlink to simplify main-thread communication.
 */
class G2PWorkerImpl {
    public async phonemize(text: string, lang: string = 'en-us'): Promise<string> {
        if (!text) return '';
        
        const cacheKey = `${lang}:${text}`;
        if (PHONEME_CACHE.has(cacheKey)) return PHONEME_CACHE.get(cacheKey)!;

        const id = Math.random().toString(36).substring(7);
        const outputFilename = `out_${id}.txt`;

        const ModuleConfig: ESpeakModuleConfig = {
            locateFile: (path: string) => {
                if (path.endsWith('.wasm')) return '/wasm/espeak-ng.wasm';
                return path;
            },
            arguments: [
                '--ipa=3', 
                '-v', lang, 
                '-q', 
                '--phonout', outputFilename, 
                `"${text.replace(/"/g, '')}"` 
            ],
            print: () => {}, 
            printErr: (text: string) => {
                if (!text.includes('Aborted') && !text.includes('program exited')) {
                    console.warn(`[espeak-log] ${text}`);
                }
            }
        };

        try {
            // @ts-ignore
            const mod = await ESpeakNg(ModuleConfig);

            if (mod.FS.analyzePath(outputFilename).exists) {
                const raw = mod.FS.readFile(outputFilename, { encoding: 'utf8' });
                mod.FS.unlink(outputFilename);
                
                const result = raw.trim().replace(/\n/g, ' ');
                if (text.length < 50) PHONEME_CACHE.set(cacheKey, result);
                
                return result;
            } else {
                throw new Error("No output file created by espeak-ng");
            }
        } catch (e) {
            console.error("[G2P] WASM Execution Failed, using fallback", e);
            return this.basicFallback(text);
        }
    }

    private basicFallback(text: string): string {
        return text.toLowerCase()
            .replace(/the/g, 'ðə')
            .replace(/to/g, 'tu')
            .replace(/and/g, 'ænd')
            .replace(/ph/g, 'f')
            .replace(/sh/g, 'ʃ')
            .replace(/ch/g, 'tʃ')
            .replace(/th/g, 'θ')
            .replace(/ing/g, 'ɪŋ')
            .split('').join('');
    }
}

Comlink.expose(new G2PWorkerImpl());