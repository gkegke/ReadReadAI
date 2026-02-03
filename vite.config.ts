import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react()
  ],
  assetsInclude: ['**/*.wasm'], // Explicitly include wasm as an asset
  optimizeDeps: {
    exclude: ['onnxruntime-web', 'phonemizer']
  },
  worker: {
    format: 'es',
    plugins: () => [react()]
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
})