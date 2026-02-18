import React from 'react';
import { Outlet } from '@tanstack/react-router';
import { Sidebar } from '../../../features/library/components/Sidebar';
import { AppErrorBoundary } from '../AppErrorBoundary';

/**
 * [ARCHITECTURE] DashboardLayout
 * topology: Sidebar (Fixed) + Main Viewport.
 * Used for Library, Settings, and high-level management.
 */
export const DashboardLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <AppErrorBoundary name="GlobalSidebar">
        <Sidebar />
      </AppErrorBoundary>
      
      <main className="flex-1 min-w-0 overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
};