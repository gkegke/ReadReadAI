import React, { useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { StudioHeader } from '../../../features/studio/components/StudioHeader';
import { PlayerControls } from '../../../features/studio/components/PlayerControls';
import { ChapterOutline } from '../../../features/studio/components/ChapterOutline';
import { GlobalCommandPalette } from '../../../features/studio/components/GlobalCommandPalette';
import { AppErrorBoundary } from '../AppErrorBoundary';
import { usePlaybackEngine } from '../../../features/studio/hooks/usePlaybackEngine';
import { useKeyboardShortcuts } from '../../../features/studio/hooks/useKeyboardShortcuts';

/**
 * [ARCHITECTURE] StudioLayout (Epic 4 Version)
 * topology: Header + Canvas + Outline + Global Keyboard Orchestrator.
 */
export const StudioLayout: React.FC = () => {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  
  // Activate the "DJ" lookahead engine
  usePlaybackEngine();

  // Activate "Power User" Keyboard Shortcuts
  useKeyboardShortcuts(() => setIsCommandOpen(true));

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
      <AppErrorBoundary name="StudioHeader">
        <StudioHeader />
      </AppErrorBoundary>

      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        <main className="flex-1 min-w-0 relative overflow-hidden">
          <AppErrorBoundary name="StudioCanvas">
            <Outlet />
          </AppErrorBoundary>
        </main>

        <AppErrorBoundary name="ChapterOutline">
          <ChapterOutline />
        </AppErrorBoundary>
      </div>

      <AppErrorBoundary name="StudioPlayer">
        <PlayerControls />
      </AppErrorBoundary>

      {/* Shared Studio Command Palette */}
      <GlobalCommandPalette open={isCommandOpen} setOpen={setIsCommandOpen} />
    </div>
  );
};