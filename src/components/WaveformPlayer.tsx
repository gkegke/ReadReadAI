import React, { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useAudioStore } from '../store/useAudioStore';

interface WaveformPlayerProps {
    blob: Blob;
    isActive: boolean;
    onEnded: () => void;
}

/**
 * WaveformPlayer
 * Standardized Industry Playback via Wavesurfer.js 7+
 */
export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ blob, isActive, onEnded }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const { isPlaying, playbackSpeed, setTime } = useAudioStore();

    useEffect(() => {
        if (!containerRef.current) return;

        // Initialize WaveSurfer
        const ws = WaveSurfer.create({
            container: containerRef.current,
            waveColor: '#94a3b8',
            progressColor: '#3b82f6',
            cursorColor: '#3b82f6',
            barWidth: 2,
            barGap: 3,
            barRadius: 3,
            height: 48,
            normalize: true,
            interact: true,
            hideScrollbar: true,
            autoScroll: false, 
        });

        wavesurferRef.current = ws;

        const url = URL.createObjectURL(blob);
        ws.load(url);

        // Events
        ws.on('ready', () => {
            ws.setPlaybackRate(playbackSpeed);
            if (isActive && isPlaying) {
                ws.play().catch(e => console.warn("Autoplay blocked:", e));
            }
        });

        ws.on('timeupdate', (t) => {
            if (isActive) {
                setTime(t, ws.getDuration());
            }
        });

        ws.on('finish', () => {
            if (isActive) onEnded();
        });

        ws.on('interaction', () => {
             // If user clicks, and we are active, we might want to ensure playing
             // If we are NOT active, the ChunkItem parent handles the click to set active
        });

        return () => {
            // Strict cleanup to prevent context leaks
            ws.destroy();
            URL.revokeObjectURL(url);
        };
    }, [blob]); // Re-init on audio change

    // Sync Play/Pause
    useEffect(() => {
        const ws = wavesurferRef.current;
        if (!ws) return;

        if (isActive) {
            if (isPlaying && !ws.isPlaying()) ws.play().catch(() => {});
            if (!isPlaying && ws.isPlaying()) ws.pause();
        } else {
            // If we are not active but the blob is loaded (preview mode?), stop it.
            if (ws.isPlaying()) ws.pause();
        }
    }, [isPlaying, isActive]);

    // Sync Speed
    useEffect(() => {
        wavesurferRef.current?.setPlaybackRate(playbackSpeed);
    }, [playbackSpeed]);

    return (
        <div className="w-full mt-3 bg-secondary/20 rounded-lg px-2 py-1">
            <div ref={containerRef} className="w-full" />
        </div>
    );
};