import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-white">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {this.props.fallbackTitle || 'Audit View Recovered'}
                </h3>
                <p className="text-xs text-slate-400">
                  A rendering fault was prevented from crashing the application.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 break-words mb-5">
              {this.state.error?.message || 'Unknown runtime error'}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Dismiss &amp; Close
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
