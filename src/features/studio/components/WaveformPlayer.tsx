import React, { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useAudioStore } from '../../../shared/store/useAudioStore';
import { audioPlaybackService } from '../services/AudioPlaybackService';

interface WaveformPlayerProps {
    blob: Blob;
    isActive: boolean;
    chunkId: number;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ blob, isActive, chunkId }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    
    // Subscribe to specific store slices for high-performance updates
    const currentTime = useAudioStore(state => state.activeChunkId === chunkId ? state.currentTime : 0);

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

        // CRITICAL: Handle the AbortError caused by React Strict Mode or rapid unmounts
        ws.load(blobUrl).catch(err => {
            if (err.name === 'AbortError') {
                // Ignore intentional aborts during component unmount
                return;
            }
            if (!isDestroyed) {
                console.error(`[Waveform] Failed to load audio for chunk ${chunkId}:`, err);
            }
        });

        ws.on('interaction', (newTime) => {
            // Trigger the Web Audio Playback logic
            // Note: We pass the blob so the service can decode it if it's not already in memory
            audioPlaybackService.playChunk(chunkId, blob, newTime);
        });

        return () => {
            isDestroyed = true;
            ws.destroy();
            URL.revokeObjectURL(blobUrl);
            wavesurferRef.current = null;
        };
    }, [blob, chunkId]); // Re-init only if data identity changes

    // Update Visuals (colors) without re-mounting the whole instance
    useEffect(() => {
        if (wavesurferRef.current) {
            wavesurferRef.current.setOptions({
                waveColor: isActive ? '#64748b' : '#94a3b8',
            });
        }
    }, [isActive]);

    // Sync Playhead from Global Audio Context clock
    useEffect(() => {
        const ws = wavesurferRef.current;
        if (!ws || !isActive) return;
        
        const wsTime = ws.getCurrentTime();
        // Use a 100ms epsilon to prevent "fighting" between the store and the visualizer
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