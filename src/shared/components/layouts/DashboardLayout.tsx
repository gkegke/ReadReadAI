import React from 'react';
import { Outlet } from '@tanstack/react-router';
import { AppErrorBoundary } from '../AppErrorBoundary';

export const DashboardLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <main className="flex-1 min-w-0 overflow-hidden relative">
        <AppErrorBoundary name="DashboardView">
          <Outlet />
        </AppErrorBoundary>
      </main>
    </div>
  );
};
