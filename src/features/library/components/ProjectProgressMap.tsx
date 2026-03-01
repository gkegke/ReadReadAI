import React from 'react';
import { useProjectChunks } from '../../../shared/hooks/useQueries';
import { cn } from '../../../shared/lib/utils';

interface ProjectProgressMapProps {
    projectId: number;
}

export const ProjectProgressMap: React.FC<ProjectProgressMapProps> = ({ projectId }) => {
    const { data: chunks, isLoading } = useProjectChunks(projectId);

    if (isLoading || chunks.length === 0) return null;

    return (
        <div className="px-2 py-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Health Map</span>
                <span className="text-[9px] font-mono text-muted-foreground">
                    {chunks.filter(c => c.status === 'generated').length}/{chunks.length}
                </span>
            </div>
            
            <div className="grid grid-cols-10 gap-1">
                {chunks.map((chunk, i) => (
                    <div 
                        key={chunk.id || i}
                        title={`Chunk ${i + 1}: ${chunk.status}`}
                        className={cn(
                            "w-full aspect-square rounded-[1px] transition-all duration-500",
                            chunk.status === 'generated' ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.3)]" :
                            chunk.status === 'processing' ? "bg-amber-500 animate-pulse" :
                            chunk.status === 'failed_tts' ? "bg-destructive" :
                            "bg-border/30"
                        )}
                    />
                ))}
            </div>

            <div className="mt-2 h-1 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                    className="h-full bg-primary transition-all duration-1000"
                    style={{ width: `${(chunks.filter(c => c.status === 'generated').length / chunks.length) * 100}%` }}
                />
            </div>
        </div>
    );
};