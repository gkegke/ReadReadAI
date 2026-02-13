import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { router } from './router'
import { ServiceProvider } from '../shared/context/ServiceContext'
import { registerSW } from 'virtual:pwa-register'
import './index.css'

// Initialize the QueryClient with sensible defaults for local development
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

// [PWA] Enhanced Auto-update
const updateSW = registerSW({
  onNeedRefresh() {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-xl z-[9999] flex items-center gap-4 animate-in slide-in-from-bottom-5';
    toast.innerHTML = `
      <div class="flex flex-col">
        <span class="font-bold text-sm">New Update Available</span>
        <span class="text-xs opacity-90">Restart to apply changes?</span>
      </div>
      <button id="pwa-refresh" class="bg-background text-foreground px-3 py-1 rounded text-xs font-bold hover:opacity-90">RELOAD</button>
    `;
    document.body.appendChild(toast);
    
    document.getElementById('pwa-refresh')?.addEventListener('click', () => {
      updateSW(true);
    });
  },
  onOfflineReady() {
    console.log('[PWA] App is ready for offline use.');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
        <ServiceProvider>
            <RouterProvider router={router} />
        </ServiceProvider>
        <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)