import React, { useEffect, useRef } from 'react'
import { Outlet } from '@tanstack/react-router'
import { useTTSStore } from '../features/tts/store/useTTSStore'
import { useSystemStore } from '../shared/store/useSystemStore'
import { DemoService } from '../shared/services/DemoService'
import { StorageQuotaService } from '../shared/services/storage/StorageQuotaService'
import { useServices } from '../shared/context/ServiceContext'
import { AlertTriangle } from 'lucide-react'
import { BootScreen } from '../shared/components/ui/BootScreen'

const App: React.FC = () => {
  const { g2p, storage, logger } = useServices();
  const { errorMessage } = useTTSStore();
  const { storageMode, isStorageFull } = useSystemStore();
  const hasBooted = useRef(false);

  useEffect(() => {
    if (hasBooted.current) return;
    hasBooted.current = true;

    const boot = async () => {
        logger.info('App', 'Initialising Core Systems...');
        try {
            // 1. Initialize Storage Implementation (OPFS vs Memory)
            await storage.init();
            
            // 2. Perform disk-to-db reconciliation
            await StorageQuotaService.reconcileStorage();
            
            // 3. Start the background GC worker
            StorageQuotaService.processOrphanQueue();
            
            // 4. Check initial quota
            await StorageQuotaService.checkAndPurge();
            
            // 5. Initialize Phonemizer
            await g2p.init(); 

            // 6. Setup Demo content if library is empty
            await DemoService.checkAndCreateDemoProject();
        } catch (err) {
            logger.error('App', 'Critical Boot Failure', err);
        }
    };
    boot();
  }, [g2p, storage, logger]);

  return (
    <>
      <BootScreen />
      
      <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none flex flex-col items-center">
          {/* [EPIC 6] Overt Hardware Quota Notification */}
          {isStorageFull && (
              <div className="bg-destructive text-destructive-foreground text-[10px] font-bold uppercase p-1.5 w-full text-center flex items-center justify-center gap-2 pointer-events-auto shadow-md">
                  <AlertTriangle className="w-3 h-3" /> 
                  Device Storage Almost Full. Audio generation paused. Free up space via Studio Preferences.
              </div>
          )}
          {storageMode === 'memory' && (
              <div className="bg-amber-500 text-white text-[10px] font-bold uppercase p-1 text-center w-full flex items-center justify-center gap-2 pointer-events-auto shadow-md">
                  <AlertTriangle className="w-3 h-3" /> 
                  Private Window: Audio will not persist
              </div>
          )}
          {errorMessage && (
              <div className="bg-destructive text-destructive-foreground text-[10px] p-1.5 w-full text-center font-bold animate-in fade-in pointer-events-auto shadow-md">
                  {errorMessage}
              </div>
          )}
      </div>

      <Outlet />
    </>
  )
}

export default App;