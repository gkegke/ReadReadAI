import React, { useEffect, useRef } from 'react'
import { Outlet } from '@tanstack/react-router'
import { Sidebar } from '../features/library/components/Sidebar'
import { StudioHeader } from '../features/studio/components/StudioHeader'
import { PlayerControls } from '../features/studio/components/PlayerControls'
import { useTTSStore } from '../features/tts/store/useTTSStore'
import { ModelStatus } from '../shared/types/tts'
import { useSystemStore } from '../shared/store/useSystemStore'
import { DemoService } from '../shared/services/DemoService'
import { AppErrorBoundary } from '../shared/components/AppErrorBoundary'
import { useServices } from '../shared/context/ServiceContext'
import { AlertTriangle } from 'lucide-react'

const App: React.FC = () => {
  const { tts, g2p, storage, logger } = useServices();
  const { modelStatus, errorMessage } = useTTSStore();
  const { storageMode, activeModelId } = useSystemStore();
  const hasBooted = useRef(false);

  useEffect(() => {
    if (hasBooted.current) return;
    hasBooted.current = true;

    const boot = async () => {
        logger.info('App', 'Booting Studio Engine...');
        try {
            await storage.init();
            await g2p.init(); 
            
            if (modelStatus === ModelStatus.UNLOADED) {
                await tts.loadModel(activeModelId);
            }
            await DemoService.checkAndCreateDemoProject();
        } catch (err) {
            logger.error('App', 'Critical Boot Failure', err);
        }
    };
    boot();
  }, [tts, g2p, storage, logger, activeModelId, modelStatus]);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <AppErrorBoundary name="MainLayout">
          <StudioHeader />
        
          {storageMode === 'memory' && (
              <div className="bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase p-1 text-center">
                  <AlertTriangle className="inline w-3 h-3 mr-1" /> Ephemeral Mode (Private Window Detected)
              </div>
          )}

          {errorMessage && (
              <div className="bg-destructive text-destructive-foreground text-xs p-1 text-center font-bold">
                  {errorMessage}
              </div>
          )}

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