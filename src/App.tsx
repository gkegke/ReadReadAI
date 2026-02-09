import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { StudioHeader } from './components/StudioHeader'
import { useProjectStore } from './store/useProjectStore'
import { useProjects } from './hooks/useQueries'
import { ttsService } from './services/TTSService'
import { DemoService } from './services/DemoService'
import { useTTSStore } from './store/useTTSStore'
import { useSystemStore } from './store/useSystemStore'
import { ModelStatus } from './types/tts'
import { AlertTriangle } from 'lucide-react'
import { Timeline } from './components/Timeline'
import { PlayerControls } from './components/PlayerControls'
import { usePlaybackEngine } from './hooks/usePlaybackEngine'
import { storage } from './services/storage'

function App() {
  const { activeProjectId } = useProjectStore();
  const { data: projects } = useProjects();
  const activeProject = projects?.find(p => p.id === activeProjectId);
  
  const { modelStatus, errorMessage } = useTTSStore();
  const { storageMode, activeModelId } = useSystemStore();

  usePlaybackEngine();

  useEffect(() => {
    // Standard PWA/Theme setup
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
    
    // Initialize Core Services
    storage.init();
    
    if (modelStatus === ModelStatus.UNLOADED) {
      ttsService.loadModel(activeModelId);
    }

    DemoService.checkAndCreateDemoProject();
  }, []);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <StudioHeader />

        {storageMode === 'memory' && (
            <div className="bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase tracking-widest px-4 py-1 flex items-center justify-center gap-2 border-b border-amber-500/20">
                <AlertTriangle className="w-3 h-3" />
                Ephemeral Mode: Audio will not persist after refresh
            </div>
        )}

        {errorMessage && (
            <div className="bg-destructive text-destructive-foreground text-xs p-2 text-center font-bold">
                ENGINE ERROR: {errorMessage}
            </div>
        )}

        <div className="flex-1 min-h-0">
            {activeProject ? (
                 <Timeline />
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground animate-in fade-in duration-700">
                    <div className="text-4xl mb-4">🎙️</div>
                    <h2 className="text-xl font-medium text-foreground">Ready to record?</h2>
                    <p className="max-w-xs text-center mt-2 text-sm">Select a project from the sidebar to start generating AI voiceovers.</p>
                </div>
            )}
        </div>

        <PlayerControls />
      </main>
    </div>
  )
}

export default App