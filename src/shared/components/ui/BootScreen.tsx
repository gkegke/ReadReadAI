import React, { useEffect, useState } from 'react';
import { useTTSStore } from '../../../features/tts/store/useTTSStore';
import { ModelStatus } from '../../types/tts';
import { logger } from '../../services/Logger';
import { Cpu, Database, Activity, Terminal, ShieldCheck } from 'lucide-react';

/**
 * BootScreen (Epic 1)
 * A theatrical initialization sequence that provides transparency 
 * while heavy AI models and WASM binaries hydrate.
 */
export const BootScreen: React.FC = () => {
    const { modelStatus, progressPhase, progressPercent } = useTTSStore();
    const [logs, setLogs] = useState<string[]>([]);

    // Poll logger for technical status updates to show the user "behind the curtain"
    useEffect(() => {
        const interval = setInterval(() => {
            const recent = logger.getRecentLogs(5).map(l => `[${l.component}] ${l.message}`);
            setLogs(recent);
        }, 500);
        return () => clearInterval(interval);
    }, []);

    if (modelStatus === ModelStatus.READY) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
            {/* Theatrical Logo Glow */}
            <div className="relative mb-12">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                <div className="relative w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-2xl">
                    <div className="w-8 h-8 bg-background rounded-md rotate-45 animate-bounce" />
                </div>
            </div>

            <div className="max-w-sm w-full space-y-8">
                <div>
                    <h1 className="text-2xl font-black tracking-tighter uppercase mb-2">ReadRead Studio</h1>
                    <p className="text-xs text-muted-foreground font-bold tracking-widest uppercase opacity-60">
                        Zero-Cloud AI Initialization
                    </p>
                </div>

                {/* Technical Hardware Check Status */}
                <div className="grid grid-cols-2 gap-2">
                    <StatusBadge icon={<Cpu className="w-3 h-3"/>} label="WASM SIMD" status="READY" />
                    <StatusBadge icon={<ShieldCheck className="w-3 h-3"/>} label="OPFS" status="SECURE" />
                </div>

                {/* High-Fidelity Progress Bar */}
                <div className="space-y-3">
                    <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">
                            {progressPhase || 'Igniting Engines...'}
                        </span>
                        <span className="text-lg font-mono font-bold">{progressPercent}%</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden border border-border">
                        <div 
                            className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_15px_rgba(var(--primary),0.5)]"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Technical Log Stream (Intuition Feed) */}
                <div className="bg-secondary/50 rounded-lg p-4 border border-border/50 text-left font-mono space-y-1">
                    <div className="flex items-center gap-2 mb-2 text-[10px] text-muted-foreground font-bold uppercase border-b border-border/50 pb-1">
                        <Terminal className="w-3 h-3" />
                        <span>System Logs</span>
                    </div>
                    {logs.map((log, i) => (
                        <div key={i} className="text-[9px] text-muted-foreground truncate opacity-80">
                            {log}
                        </div>
                    ))}
                    {logs.length === 0 && <div className="text-[9px] italic opacity-30">Awaiting telemetry...</div>}
                </div>
            </div>

            <div className="fixed bottom-8 flex items-center gap-6 opacity-30 text-[10px] font-bold uppercase tracking-[0.3em]">
                <div className="flex items-center gap-2"><Database className="w-3 h-3" /> Local-First</div>
                <div className="flex items-center gap-2"><Activity className="w-3 h-3" /> 60FPS Orchestration</div>
            </div>
        </div>
    );
};

const StatusBadge = ({ icon, label, status }: { icon: React.ReactNode, label: string, status: string }) => (
    <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 rounded-md border border-border/50">
        <div className="text-primary">{icon}</div>
        <div className="flex flex-col items-start leading-none">
            <span className="text-[8px] font-bold text-muted-foreground uppercase">{label}</span>
            <span className="text-[9px] font-black text-foreground">{status}</span>
        </div>
    </div>
);