import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
          dest: 'pdf-worker'
        }
      ]
    })
  ],
  // CRITICAL: Ensure .wasm files are treated as external assets
  assetsInclude: ['**/*.wasm', '**/*.data'],
  optimizeDeps: {
    // Exclude heavy ML/WASM packages from pre-bundling to prevent VITE from 
    // trying to compile the glue code incorrectly
    exclude: ['onnxruntime-web', 'kokoro-js', 'espeak-ng']
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  worker: {
    format: 'es'
  }
})