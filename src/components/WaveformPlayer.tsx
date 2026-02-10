import React, { useEffect, useRef, useMemo } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useAudioStore } from '../store/useAudioStore';
import { audioPlaybackService } from '../services/AudioPlaybackService';

interface WaveformPlayerProps {
    blob: Blob;
    isActive: boolean;
    chunkId: number;
    onEnded?: () => void;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ blob, isActive, chunkId }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    
    // Subscribe specifically to these values
    const currentTime = useAudioStore(state => state.activeChunkId === chunkId ? state.currentTime : 0);
    const isPlaying = useAudioStore(state => state.activeChunkId === chunkId && state.isPlaying);

    const blobUrl = useMemo(() => URL.createObjectURL(blob), [blob]);

    useEffect(() => {
        if (!containerRef.current) return;

        const ws = WaveSurfer.create({
            container: containerRef.current,
            waveColor: isActive ? '#64748b' : '#94a3b8',
            progressColor: '#3b82f6',
            height: 48,
            barWidth: 2,
            cursorWidth: 0,
            interact: true,
            normalize: true,
            fillParent: true,
        });

        wavesurferRef.current = ws;
        ws.load(blobUrl);

        // Interaction: User clicks waveform -> Seek global engine
        ws.on('interaction', (newTime) => {
            if (isActive) {
                audioPlaybackService.seek(newTime);
            } else {
                // If inactive, start playing this chunk from that spot
                useAudioStore.getState().setActiveChunkId(chunkId);
                useAudioStore.getState().setIsPlaying(true);
                audioPlaybackService.playChunk(chunkId, blob, newTime);
            }
        });

        return () => {
            ws.destroy();
            wavesurferRef.current = null;
        };
    }, [blobUrl, chunkId]); // Removed isActive to prevent re-instantiation flicker

    // React to global time updates (The "Visualizer" aspect)
    useEffect(() => {
        if (!wavesurferRef.current || !isActive) return;
        
        // Optimization: Only update if drift is > 0.1s to avoid canvas thrashing
        const wsTime = wavesurferRef.current.getCurrentTime();
        if (Math.abs(wsTime - currentTime) > 0.1) {
            wavesurferRef.current.setTime(currentTime);
        }
    }, [currentTime, isActive]);

    useEffect(() => {
        return () => URL.revokeObjectURL(blobUrl);
    }, [blobUrl]);

    return (
        <div className={`w-full mt-3 rounded-lg px-2 py-1 transition-colors ${isActive ? 'bg-primary/5' : ''}`}>
            <div ref={containerRef} className="w-full" />
        </div>
    );
};