import React, { useState, useEffect } from 'react';
import { useServices } from '../../context/ServiceContext';
import { PlayCircle } from 'lucide-react';

/**
 * [EPIC 4] BootScreen / Hydration Barrier
 * Intercepts the first user gesture to unlock the global AudioContext.
 * Prevents Safari/iOS autoplay suspension traps.
 */
export const BootScreen: React.FC = () => {
    const [isHydrated, setIsHydrated] = useState(false);
    const { playback } = useServices();

    const handleBoot = async () => {
        await playback.hydrate();
        setIsHydrated(true);
    };

    // Auto-hide if the context is somehow already running (e.g., hot reloads)
    useEffect(() => {
        if (playback.state !== 'IDLE' && playback.state !== 'ERROR') {
            setIsHydrated(true);
        }
    }, [playback.state]);

    if (isHydrated) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
            <button 
                onClick={handleBoot}
                className="flex flex-col items-center gap-6 hover:scale-105 active:scale-95 transition-all group p-8 rounded-3xl"
            >
                <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center shadow-2xl shadow-primary/20 group-hover:shadow-primary/40 group-hover:ring-4 ring-primary/10 transition-all">
                    <PlayCircle className="w-12 h-12 text-primary-foreground ml-1" />
                </div>
                <div className="text-center">
                    <h1 className="text-3xl font-black tracking-tight uppercase mb-2">Enter Studio</h1>
                    <p className="text-xs text-muted-foreground font-bold tracking-[0.2em] uppercase">Click anywhere to ignite engines</p>
                </div>
            </button>
        </div>
    );
};