import React, { useEffect, useState } from 'react';
import { useTTSStore } from '../../../features/tts/store/useTTSStore';
import { useServices } from '../../context/ServiceContext';
import { ModelStatus } from '../../types/tts';
import { logger } from '../../services/Logger';
import { useSystemStore } from '../../store/useSystemStore';
import { Cpu, Database, Activity, Terminal, ShieldCheck, Zap, Sparkles } from 'lucide-react';

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
            <div className="relative max-w-sm w-full space-y-10 z-10">
                <div className="space-y-4">
                    <div className="relative w-20 h-20 mx-auto rounded-2xl bg-primary flex items-center justify-center shadow-2xl">
                        <Zap className="w-10 h-10 text-primary-foreground fill-current" />
                    </div>
                    <div className="px-2">
                        <h1 className="text-3xl font-black tracking-tighter uppercase mb-2">ReadRead Studio</h1>
                        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                            A fully offline, privacy-first AI audio studio that works on everyday devices. <br/>
                        </p>
                    </div>
                </div>

                {!hasInteracted ? (
                    <div className="space-y-3 w-full mt-6">
                        <TierButton 
                            icon={<Zap className="w-4 h-4"/>}
                            title="Performance"
                            desc="Fastest audio generation - best for lower end devices."
                            onClick={() => handleIgnition('kokoro-perf')}
                        />
                        <TierButton 
                            icon={<Activity className="w-4 h-4"/>}
                            title="Balanced"
                            desc="Great fast audio fidelity for modern devices."
                            onClick={() => handleIgnition('kokoro-balanced')}
                        />
                        <TierButton 
                            icon={<Sparkles className="w-4 h-4"/>}
                            title="High Quality"
                            desc="Highest quality - still surprisingly fast for it's class."
                            onClick={() => handleIgnition('kokoro-high')}
                        />
                    </div>
                ) : (
                    <div className="space-y-8 animate-in zoom-in-95 duration-500">
                        <div className="space-y-3">
                            <div className="flex justify-between items-end">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">
                                    {progressPhase || 'Loading Weights...'}
                                </span>
                                <span className="text-lg font-mono font-bold">{progressPercent}%</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-primary transition-all duration-700 ease-out"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground pt-2 font-medium opacity-70 text-center px-4">
                                The AI model is downloading to your device's secure storage. 
                                This only happens once, but may take a moment depending on your connection.
                            </p>
                        </div>

                        <div className="bg-secondary/40 rounded-lg p-4 text-left font-mono space-y-1">
                            {logs.map((log, i) => (
                                <div key={i} className="text-[9px] text-muted-foreground truncate">
                                    <span className="text-primary mr-2 font-black">&gt;</span>{log}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const TierButton = ({ icon, title, desc, onClick }: any) => (
    <button 
        onClick={onClick}
        className="w-full p-4 bg-secondary/30 hover:bg-primary/10 border border-border hover:border-primary/40 rounded-2xl transition-all flex items-center gap-4 text-left group"
    >
        <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors border border-border shadow-sm shrink-0">
            {icon}
        </div>
        <div>
            <div className="font-black uppercase tracking-widest text-xs group-hover:text-primary mb-0.5">{title}</div>
            <div className="text-[10px] text-muted-foreground font-bold leading-tight">{desc}</div>
        </div>
    </button>
)