import React, { useEffect, useState } from 'react';
import { useTTSStore } from '../../../features/tts/store/useTTSStore';
import { useServices } from '../../context/ServiceContext';
import { ModelStatus } from '../../types/tts';
import { logger } from '../../services/Logger';
import { useSystemStore } from '../../store/useSystemStore';
import { 
    Cpu, 
    Database, 
    Activity, 
    Terminal, 
    ShieldCheck, 
    Zap 
} from 'lucide-react';

/**
 * BootScreen (Epic 1 Update)
 * Incorporates explicit hardware profile choices to prevent device crashing.
 */
export const BootScreen: React.FC = () => {
    const { modelStatus, progressPhase, progressPercent } = useTTSStore();
    const { playback, tts, queue } = useServices();
    
    const [hasInteracted, setHasInteracted] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            const recent = logger.getRecentLogs(5).map(l => `[${l.component}] ${l.message}`);
            setLogs(recent);
        }, 500);
        return () => clearInterval(interval);
    }, []);

    const handleIgnition = async (modelId: string) => {
        useSystemStore.getState().setActiveModelId(modelId);
        setHasInteracted(true);
        
        await playback.hydrate();
        await tts.loadModel(modelId);
        await queue.init(); 
    };

    if (hasInteracted && modelStatus === ModelStatus.READY) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-700 backdrop-blur-md">
            
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
            </div>

            <div className="relative max-w-sm w-full space-y-10 z-10">
                <div className="space-y-4">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150" />
                        <div className="relative w-20 h-20 mx-auto rounded-2xl bg-primary flex items-center justify-center shadow-2xl transition-transform hover:scale-110">
                            <Zap className="w-10 h-10 text-primary-foreground fill-current" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter uppercase mb-1">ReadRead Studio</h1>
                        <p className="text-[10px] text-muted-foreground font-bold tracking-[0.4em] uppercase opacity-70">
                            Zero-Cloud AI Engine
                        </p>
                    </div>
                </div>

                {!hasInteracted ? (
                    /* [EPIC 1] STAGE 1: Explicit User Hardware Choice */
                    <div className="space-y-3 w-full mt-6">
                        <button 
                            onClick={() => handleIgnition('kitten-v0-q8')}
                            className="w-full p-4 bg-secondary/30 hover:bg-primary/20 border border-border hover:border-primary/50 rounded-2xl transition-all flex items-center justify-between group text-left"
                        >
                            <div>
                                <div className="font-black uppercase tracking-widest text-sm group-hover:text-primary transition-colors">Standard Device</div>
                                <div className="text-[10px] text-muted-foreground mt-1 font-bold">Fast & Light TTS (Nano)</div>
                            </div>
                            <Zap className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all" />
                        </button>

                        <button 
                            onClick={() => handleIgnition('kokoro-v1-q8')}
                            className="w-full p-4 bg-secondary/30 hover:bg-primary/20 border border-border hover:border-primary/50 rounded-2xl transition-all flex items-center justify-between group text-left"
                        >
                            <div>
                                <div className="font-black uppercase tracking-widest text-sm group-hover:text-primary transition-colors">High-End Device</div>
                                <div className="text-[10px] text-muted-foreground mt-1 font-bold">Premium Kokoro TTS</div>
                            </div>
                            <Cpu className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all" />
                        </button>
                    </div>
                ) : (
                    /* STAGE 2: Theatrical Hydration */
                    <div className="space-y-8 animate-in zoom-in-95 duration-500">
                        <div className="grid grid-cols-2 gap-3">
                            <StatusBadge icon={<Cpu className="w-3 h-3"/>} label="WASM SIMD" status="HYDRATING" />
                            <StatusBadge icon={<ShieldCheck className="w-3 h-3"/>} label="OPFS" status="SECURE" />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-end">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">
                                    {progressPhase || 'Loading Weights...'}
                                </span>
                                <span className="text-lg font-mono font-bold">{progressPercent}%</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden border border-border">
                                <div 
                                    className="h-full bg-primary transition-all duration-700 ease-out shadow-[0_0_15px_rgba(var(--primary),0.5)]"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>

                        <div className="bg-secondary/40 backdrop-blur-sm rounded-lg p-4 border border-border/40 text-left font-mono space-y-1">
                            <div className="flex items-center gap-2 mb-2 text-[10px] text-muted-foreground font-bold uppercase border-b border-border/50 pb-1">
                                <Terminal className="w-3 h-3" />
                                <span>System Logs</span>
                            </div>
                            {logs.map((log, i) => (
                                <div key={i} className="text-[9px] text-muted-foreground truncate opacity-80 leading-relaxed">
                                    <span className="text-primary mr-2 font-black tracking-tighter">&gt;</span>
                                    {log}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="fixed bottom-10 flex items-center gap-8 opacity-40 text-[9px] font-black uppercase tracking-[0.3em]">
                <div className="flex items-center gap-2"><Database className="w-3 h-3" /> Local Storage</div>
                <div className="flex items-center gap-2"><Activity className="w-3 h-3" /> Client Side</div>
            </div>
        </div>
    );
};

const StatusBadge = ({ icon, label, status }: { icon: React.ReactNode, label: string, status: string }) => (
    <div className="flex items-center gap-3 px-4 py-3 bg-secondary/30 rounded-xl border border-border/50">
        <div className="text-primary">{icon}</div>
        <div className="flex flex-col items-start leading-none">
            <span className="text-[8px] font-bold text-muted-foreground uppercase mb-1">{label}</span>
            <span className="text-[9px] font-black text-foreground tracking-wider uppercase">{status}</span>
        </div>
    </div>
);