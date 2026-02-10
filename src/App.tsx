import React, { useEffect } from 'react'
import { Outlet } from '@tanstack/react-router' // Import Outlet
import { Sidebar } from './components/Sidebar'
import { StudioHeader } from './components/StudioHeader'
import { useTTSStore } from './store/useTTSStore'
import { useSystemStore } from './store/useSystemStore'
import { ttsService } from './services/TTSService'
import { DemoService } from './services/DemoService'
import { storage } from './services/storage'
import { g2pService } from './lib/tts/G2PService'
import { PlayerControls } from './components/PlayerControls'
import { ModelStatus } from './types/tts'
import { AlertTriangle } from 'lucide-react'
import { AppErrorBoundary } from './components/AppErrorBoundary'

const App: React.FC = () => {
  const { modelStatus, errorMessage } = useTTSStore();
  const { storageMode, activeModelId } = useSystemStore();

  useEffect(() => {
    const boot = async () => {
        await storage.init();
        await g2pService.init(); 
        if (modelStatus === ModelStatus.UNLOADED) {
            await ttsService.loadModel(activeModelId);
        }
        await DemoService.checkAndCreateDemoProject();
    };
    boot();
  }, []);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <AppErrorBoundary name="MainLayout">
          {/* Header is persistent across routes */}
          <StudioHeader />
        
          {storageMode === 'memory' && (
              <div className="bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase p-1 text-center">
                  <AlertTriangle className="inline w-3 h-3 mr-1" /> Ephemeral Mode (Private Window Detected)
              </div>
          )}

          {errorMessage && (
              <div className="bg-destructive text-destructive-foreground text-xs p-1 text-center">
                  {errorMessage}
              </div>
          )}

          {/* Route Content Rendered Here */}
          <div className="flex-1 min-h-0 relative">
              <Outlet />
          </div>

          <PlayerControls />
        </AppErrorBoundary>
      </main>
    </div>
  )
}

export default App;