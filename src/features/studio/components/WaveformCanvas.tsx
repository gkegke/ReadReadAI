import React, { useRef, useEffect } from 'react';

interface WaveformCanvasProps {
    peaks: number[];
    color?: string;
    height?: number;
}

/**
 * Super lightweight canvas renderer for static waveforms.
 * Use this in lists to avoid instantiating WaveSurfer (WebAudio) hundreds of times.
 */
export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({ 
    peaks, 
    color = '#94a3b8', 
    height = 48 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Handle high DPI displays
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, rect.width, height);
        ctx.fillStyle = color;

        const barWidth = 2;
        const gap = 1;
        const barCount = peaks.length;
        const xStep = rect.width / barCount;

        peaks.forEach((peak, i) => {
            const barHeight = peak * height;
            const x = i * xStep;
            const y = (height - barHeight) / 2;
            
            // Draw rounded-ish bars
            ctx.fillRect(x, y, barWidth, barHeight);
        });
    }, [peaks, color, height]);

    return (
        <canvas 
            ref={canvasRef} 
            className="w-full opacity-60 group-hover:opacity-100 transition-opacity" 
            style={{ height: `${height}px` }}
        />
    );
};