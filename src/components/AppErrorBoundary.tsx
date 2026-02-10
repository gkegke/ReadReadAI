import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode; name?: string; }
interface State { hasError: boolean; error: Error | null; }

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[Boundary: ${this.props.name || 'Global'}]`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center h-full bg-destructive/5 border border-destructive/10 rounded-xl m-4">
          <AlertOctagon className="w-12 h-12 text-destructive mb-4" />
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground text-sm max-w-md mb-6 font-mono text-left bg-background p-4 rounded border">
            {this.state.error?.message || "An unexpected error occurred in the Studio engine."}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-lg font-bold hover:opacity-90 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> REBOOT STUDIO
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}