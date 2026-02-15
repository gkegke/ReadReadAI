import React, { useEffect, useRef } from 'react'
import { Outlet } from '@tanstack/react-router'
import { Sidebar } from '../features/library/components/Sidebar'
import { StudioHeader } from '../features/studio/components/StudioHeader'
import { PlayerControls } from '../features/studio/components/PlayerControls'
import { TimelineSearch } from '../features/studio/components/TimelineSearch' // [EPIC 3]
import { useTTSStore } from '../features/tts/store/useTTSStore'
import { ModelStatus } from '../shared/types/tts'
import { useSystemStore } from '../shared/store/useSystemStore'
import { DemoService } from '../shared/services/DemoService'
import { AppErrorBoundary } from '../shared/components/AppErrorBoundary'
import { useServices } from '../shared/context/ServiceContext'
import { AlertTriangle } from 'lucide-react'

/**
 * App (V2.1 - Root Orchestrator)
 * Manages global service lifecycle and the top-level layout grid.
 */
const App: React.FC = () => {
  const { tts, g2p, storage, logger } = useServices();
  const { modelStatus, errorMessage } = useTTSStore();
  const { storageMode, activeModelId } = useSystemStore();
  const hasBooted = useRef(false);

  // [STABILITY] Boot Sequence
  // Ensures all wasm/worker/storage engines are hot before user interaction
  useEffect(() => {
    if (hasBooted.current) return;
    hasBooted.current = true;

    const boot = async () => {
        logger.info('App', 'Booting Studio Engine...');
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
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* [EPIC 3] Global Command Palette (⌘K) */}
      <TimelineSearch />

      {/* Persistent Left Navigation */}
      <AppErrorBoundary name="Sidebar">
        <Sidebar />
      </AppErrorBoundary>

      {/* Main Studio Viewport */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <AppErrorBoundary name="Header">
          <StudioHeader />
        </AppErrorBoundary>
        
        {/* System Notices */}
        {storageMode === 'memory' && (
            <div className="bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase p-1 text-center border-y border-amber-500/20 flex items-center justify-center gap-2">
                <AlertTriangle className="w-3 h-3" /> 
                Ephemeral Mode (Private Window Detected - Audio will not persist)
            </div>
        )}

        {errorMessage && (
            <div className="bg-destructive text-destructive-foreground text-xs p-1 text-center font-bold animate-in fade-in duration-300">
                {errorMessage}
            </div>
        )}

        <div className="flex-1 min-h-0 relative">
            {/* View Port (StudioPage or DashboardPage) */}
            <AppErrorBoundary name="ViewLayer">
                <Outlet />
            </AppErrorBoundary>
        </div>

        {/* Persistent Footer Controls */}
        <AppErrorBoundary name="PlayerBar">
            <PlayerControls />
        </AppErrorBoundary>
      </main>
    </div>
  )
}

export default App;