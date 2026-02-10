import React, { useEffect, useRef } from 'react';
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
    
    // Subscribe to specific store slices for high-performance updates
    const currentTime = useAudioStore(state => state.activeChunkId === chunkId ? state.currentTime : 0);
    const isPlaying = useAudioStore(state => state.activeChunkId === chunkId && state.isPlaying);

    useEffect(() => {
        if (!containerRef.current) return;

        let isDestroyed = false;
        const blobUrl = URL.createObjectURL(blob);

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

        // Load the audio and handle potential failures
        ws.load(blobUrl).catch(err => {
            if (!isDestroyed) {
                console.error(`[Waveform] Failed to load blob for chunk ${chunkId}:`, err);
            }
        });

        ws.on('interaction', (newTime) => {
            if (isActive) {
                audioPlaybackService.seek(newTime);
            } else {
                useAudioStore.getState().setActiveChunkId(chunkId);
                useAudioStore.getState().setIsPlaying(true);
                audioPlaybackService.playChunk(chunkId, blob, newTime);
            }
        });

        return () => {
            isDestroyed = true;
            ws.destroy();
            URL.revokeObjectURL(blobUrl);
            wavesurferRef.current = null;
        };
    }, [blob, chunkId]); // Re-init only if blob or chunk identity changes

    // Update Visuals without re-mounting
    useEffect(() => {
        if (wavesurferRef.current) {
            wavesurferRef.current.setOptions({
                waveColor: isActive ? '#64748b' : '#94a3b8',
            });
        }
    }, [isActive]);

    // Sync Playhead
    useEffect(() => {
        const ws = wavesurferRef.current;
        if (!ws || !isActive) return;
        
        const wsTime = ws.getCurrentTime();
        if (Math.abs(wsTime - currentTime) > 0.1) {
            ws.setTime(currentTime);
        }
    }, [currentTime, isActive]);

    return (
        <div className={`w-full mt-3 rounded-lg px-2 py-1 transition-colors ${isActive ? 'bg-primary/5' : ''}`}>
            <div ref={containerRef} className="w-full" />
        </div>
    );
};