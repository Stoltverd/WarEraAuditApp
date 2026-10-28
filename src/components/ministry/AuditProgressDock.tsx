import React, { useState, useEffect } from 'react';
import { AutoAuditStreamState, auditStreamService } from '../../services/auditStreamService';
import {
  RefreshCw,
  Pause,
  Play,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  FileText,
  CheckCircle2,
  HelpCircle,
  Zap,
} from 'lucide-react';

interface AuditProgressDockProps {
  countryName: string;
  state: AutoAuditStreamState;
  bufferedCount?: number;
  onApplyBufferedUpdates?: () => void;
}

export const AuditProgressDock: React.FC<AuditProgressDockProps> = ({
  countryName,
  state,
  bufferedCount = 0,
  onApplyBufferedUpdates,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showSpeedExplainer, setShowSpeedExplainer] = useState(false);

  useEffect(() => {
    if (state.isRunning || state.failedCount > 0 || bufferedCount > 0) {
      setIsDismissed(false);
    }
  }, [state.isRunning, state.failedCount, bufferedCount]);

  if (isDismissed && bufferedCount === 0) return null;
  if (
    !state.isRunning &&
    state.failedCount === 0 &&
    bufferedCount === 0 &&
    state.pct >= 100 &&
    (!state.activeWorkers || state.activeWorkers.length === 0)
  ) {
    // Quietly hide dock once 100% verified with zero errors and zero unapplied buffered updates
    return null;
  }
  if (!state.isRunning && state.auditedCount === 0 && state.failedCount === 0 && bufferedCount === 0) {
    return null;
  }

  const activeWorkers = state.activeWorkers || [];

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm w-full sm:w-[410px] animate-in slide-in-from-bottom duration-200">
      <div className="bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl shadow-2xl p-3.5 text-white space-y-2.5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                !state.isRunning && bufferedCount > 0
                  ? 'bg-emerald-500/20 border-emerald-400/40'
                  : 'bg-cyan-500/20 border-cyan-400/40'
              }`}
            >
              {!state.isRunning && bufferedCount > 0 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <RefreshCw
                  className={`w-3.5 h-3.5 text-cyan-400 ${
                    state.isRunning && !state.isPaused ? 'animate-spin' : ''
                  }`}
                />
              )}
            </div>
            <div className="truncate">
              <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                <span>
                  {state.isRunning
                    ? `Auditing ${countryName}`
                    : bufferedCount > 0
                    ? `${bufferedCount} Verified Updates Ready`
                    : `Audit Status — ${countryName}`}
                </span>
                <span className="text-[10px] font-mono text-cyan-300 font-normal">
                  ({state.pct}%)
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 truncate">
                {state.auditedCount} / {state.totalTargetCount} citizens verified
                {state.failedCount > 0 ? ` · ${state.failedCount} deferred` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowSpeedExplainer((prev) => !prev)}
              className={`p-1 rounded-lg transition ${
                showSpeedExplainer
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Why per-citizen receipt streaming takes time & how 4-Worker Delta Sync accelerates it"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>

            {state.isRunning && (
              <button
                type="button"
                onClick={() => {
                  if (state.isPaused) {
                    auditStreamService.resume();
                  } else {
                    auditStreamService.pause();
                  }
                }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title={state.isPaused ? 'Resume background audit' : 'Pause background audit'}
              >
                {state.isPaused ? (
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsMinimized((prev) => !prev)}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title={isMinimized ? 'Expand audit dock' : 'Minimize audit dock'}
            >
              {isMinimized ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (state.isRunning) {
                  auditStreamService.stop();
                }
                setIsDismissed(true);
              }}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Dismiss audit dock"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300 rounded-full"
            style={{ width: `${Math.max(2, state.pct)}%` }}
          />
        </div>

        {/* Floating "Apply X Verified Updates" Button — Always Follows User When Scrolling */}
        {bufferedCount > 0 && onApplyBufferedUpdates && (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={onApplyBufferedUpdates}
              className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs font-mono flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
            >
              <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Apply {bufferedCount} Verified Updates to Table</span>
            </button>
          </div>
        )}

        {/* Clickable Speed & API Rate-Limit Explainer */}
        {showSpeedExplainer && (
          <div className="p-2.5 rounded-xl bg-slate-950/95 border border-cyan-500/30 text-[10px] text-slate-300 space-y-1.5 leading-relaxed">
            <div className="font-bold text-cyan-300 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>4-Worker Priority Delta Sync Active</span>
              </span>
              <button
                type="button"
                onClick={() => setShowSpeedExplainer(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <p>
              <strong className="text-white">Why per-citizen queries are required:</strong> The War Era API (<code className="text-cyan-300">transaction.getPaginatedTransactions</code>) only returns personal wages and market trades per <code className="text-cyan-300">userId</code> cursor—it does not expose a bulk country-wide personal ledger endpoint.
            </p>
            <p>
              <strong className="text-white">How we maximize speed safely:</strong> All countries run <strong className="text-emerald-300">4 parallel workers</strong> with <strong className="text-emerald-300">100-receipt page batching</strong>, <strong className="text-emerald-300">Priority-First ordering</strong> (auditing top wealth &amp; potential leeches first), and <strong className="text-emerald-300">Incremental Delta Short-Circuiting</strong> (stopping pagination immediately upon reaching an already-cached receipt ID), paced by a token bucket to prevent HTTP 429 bans.
            </p>
          </div>
        )}

        {/* Expanded Real-Time Multi-Worker Telemetry (Zero Blinking Between Citizens) */}
        {!isMinimized && (
          <div className="space-y-2 pt-0.5 text-[11px] font-sans">
            {activeWorkers.length > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="text-cyan-300 font-bold">
                    Concurrent Workers ({activeWorkers.length} Active):
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>100/page Delta Sync</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {activeWorkers.map((w) => (
                    <div
                      key={w.workerIndex}
                      className="px-2 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-1.5 font-mono text-[10px]"
                    >
                      <div className="truncate flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                        <span className="text-white font-bold truncate" title={w.username}>
                          {w.username}
                        </span>
                      </div>
                      {w.retryAttempt && w.retryAttempt > 1 ? (
                        <span className="text-amber-300 shrink-0 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                          <span>R#{w.retryAttempt}</span>
                        </span>
                      ) : (
                        <span className="text-emerald-400 shrink-0 flex items-center gap-0.5">
                          <FileText className="w-2.5 h-2.5" />
                          <span>{w.receiptCount}</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 text-slate-400 font-mono text-[10px]">
                <span className="truncate">{state.statusMessage}</span>
                <span className="text-slate-400 flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>30m Auto-Sync</span>
                </span>
              </div>
            )}

            {state.failedCount > 0 && !state.isRunning && (
              <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-800">
                <span className="text-[10px] text-amber-300 font-mono">
                  {state.failedCount} citizen(s) timed out on API
                </span>
                <button
                  type="button"
                  onClick={() => auditStreamService.retryFailed()}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold flex items-center gap-1 transition"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry {state.failedCount} Failed</span>
                </button>
              </div>
            )}

            <div className="text-[10px] text-slate-500 leading-tight">
              Priority queue audits top wealth &amp; earners first. Row positions remain locked until you click Apply.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
