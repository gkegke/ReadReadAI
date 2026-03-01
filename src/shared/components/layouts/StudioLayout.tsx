import React from 'react';
import { Outlet } from '@tanstack/react-router';
import { StudioHeader } from '../../../features/studio/components/StudioHeader';
import { PlayerControls } from '../../../features/studio/components/PlayerControls';
import { ProjectInspector } from '../../../features/studio/components/ProjectInspector';
import { AppErrorBoundary } from '../AppErrorBoundary';
import { usePlaybackEngine } from '../../../features/studio/hooks/usePlaybackEngine';
import { useKeyboardShortcuts } from '../../../features/studio/hooks/useKeyboardShortcuts';

export const StudioLayout: React.FC = () => {
  usePlaybackEngine();
  useKeyboardShortcuts();

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

        <AppErrorBoundary name="ProjectInspector">
          <ProjectInspector />
        </AppErrorBoundary>
      </div>

      <AppErrorBoundary name="StudioPlayer">
        <PlayerControls />
      </AppErrorBoundary>
    </div>
  );
};