import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { logger } from '../services/Logger';

interface Props { 
    children: ReactNode; 
    name: string; 
    fallback?: ReactNode;
}
interface State { hasError: boolean; error: Error | null; }

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary', `Crash in [${this.props.name}]`, {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
    });
  }

  private handleReset = () => {
      this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center p-6 text-center h-full bg-destructive/5 border border-destructive/10 rounded-lg m-2">
          <AlertCircle className="w-8 h-8 text-destructive mb-3" />
          <h3 className="text-sm font-bold uppercase tracking-tight">Feature Error: {this.props.name}</h3>
          <p className="text-[11px] text-muted-foreground mt-1 mb-4 max-w-xs font-mono">
            {this.state.error?.message.slice(0, 100)}...
          </p>
          <button 
            onClick={this.handleReset}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-1.5 rounded text-xs font-bold hover:bg-secondary/80 transition-all border border-border"
          >
            <RotateCcw className="w-3.5 h-3.5" /> RECOVERY
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}