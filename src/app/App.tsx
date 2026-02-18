import React, { useEffect, useRef } from 'react'
import { Outlet } from '@tanstack/react-router'
import { useTTSStore } from '../features/tts/store/useTTSStore'
import { ModelStatus } from '../shared/types/tts'
import { useSystemStore } from '../shared/store/useSystemStore'
import { DemoService } from '../shared/services/DemoService'
import { useServices } from '../shared/context/ServiceContext'
import { AlertTriangle } from 'lucide-react'
import { BootScreen } from '../shared/components/ui/BootScreen'

/**
 * App (V2.3 - Global Orchestrator)
 */
const App: React.FC = () => {
  const { tts, g2p, storage, logger } = useServices();
  const { modelStatus, errorMessage } = useTTSStore();
  const { storageMode, activeModelId } = useSystemStore();
  const hasBooted = useRef(false);

  useEffect(() => {
    if (hasBooted.current) return;
    hasBooted.current = true;

    const boot = async () => {
        logger.info('App', 'Initialising Core Systems...');
        try {
            await storage.init();
            await g2p.init(); 
            if (modelStatus === ModelStatus.UNLOADED) await tts.loadModel(activeModelId);
            await DemoService.checkAndCreateDemoProject();
        } catch (err) {
            logger.error('App', 'Critical Boot Failure', err);
        }
    };
    boot();
  }, [tts, g2p, storage, logger, activeModelId, modelStatus]);

  return (
    <>
      <BootScreen />
      
      {/* System Notices Layer */}
      <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none">
          {storageMode === 'memory' && (
              <div className="bg-amber-500 text-white text-[10px] font-bold uppercase p-1 text-center flex items-center justify-center gap-2 pointer-events-auto">
                  <AlertTriangle className="w-3 h-3" /> 
                  Private Window: Audio will not persist
              </div>
          )}
          {errorMessage && (
              <div className="bg-destructive text-destructive-foreground text-xs p-1 text-center font-bold animate-in fade-in pointer-events-auto">
                  {errorMessage}
              </div>
          )}
      </div>

      <Outlet />
    </>
  )
}

export default App;