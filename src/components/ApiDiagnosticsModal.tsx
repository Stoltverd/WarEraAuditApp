import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';
import {
  ApiDiagnosticLog,
  getDiagnosticLogs,
  clearDiagnosticLogs,
  testWarEraApiConnection,
} from '../services/apiService';

interface ApiDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onOpenKeyModal: () => void;
}

export const ApiDiagnosticsModal: React.FC<ApiDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onOpenKeyModal,
}) => {
  const [logs, setLogs] = useState<ApiDiagnosticLog[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    publicOk: boolean;
    authOk: boolean;
    publicStatus: number;
    authStatus: number;
    message: string;
    authResponseBody?: any;
    testedKeyPreview: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLogs(getDiagnosticLogs());

    const handleLogged = () => {
      setLogs(getDiagnosticLogs());
    };

    window.addEventListener('warera:diagnostic-logged', handleLogged);
    return () => {
      window.removeEventListener('warera:diagnostic-logged', handleLogged);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testWarEraApiConnection(apiKey);
      setTestResult(res);
      setLogs(getDiagnosticLogs());
    } finally {
      setIsTesting(false);
    }
  };

  const handleClear = () => {
    clearDiagnosticLogs();
    setLogs([]);
    setSelectedLogId(null);
  };

  const maskedKey = apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : 'None configured';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm overflow-y-auto flex min-h-full items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-3xl p-4 sm:p-6 shadow-2xl my-auto animate-in zoom-in-95 duration-150 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">War Era API Diagnostics Inspector</h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  api2.warera.io
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real-time outbound header tracking, tRPC procedure auditor, and token health
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Key Status Card */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            {apiKey ? (
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Token:</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300">
                  {maskedKey}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {apiKey
                  ? 'Transmitted via X-API-Key and Authorization: Bearer on every outbound query.'
                  : 'No token set. Endpoints requiring player authentication will be rejected upstream.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRunTest}
              disabled={isTesting}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition disabled:opacity-50 shadow-md shadow-amber-500/20 active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testing API...' : 'Test Connection'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenKeyModal}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition border border-slate-700"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Edit Key</span>
            </button>
          </div>
        </div>

        {/* Live Test Result Banner */}
        {testResult && (
          <div
            className={`mt-3 p-3.5 rounded-2xl border text-xs animate-in fade-in shrink-0 ${
              testResult.authOk
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {testResult.authOk ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-extrabold flex items-center gap-2">
                    <span>{testResult.message}</span>
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/40 border border-white/10">
                      HTTP {testResult.authStatus || testResult.publicStatus}
                    </span>
                  </div>
                  <div className="text-[11px] opacity-80 mt-1 space-y-0.5">
                    <div>Public Endpoint (getAllCountries): {testResult.publicOk ? '🟢 Reachable (200 OK)' : '🔴 Unreachable'}</div>
                    <div>Authenticated Endpoint (inventory.getInventory): {testResult.authOk ? '🟢 Verified Authorized' : `🔴 Rejected (HTTP ${testResult.authStatus})`}</div>
                  </div>
                  {testResult.authResponseBody && (
                    <div className="mt-2 p-2 rounded-lg bg-black/60 font-mono text-[10px] text-slate-300 overflow-x-auto max-h-24">
                      {JSON.stringify(testResult.authResponseBody, null, 2)}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Logs Table Controls */}
        <div className="mt-4 flex items-center justify-between pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Live API Outbound Request Log
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
              {logs.length} requests
            </span>
          </div>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Log</span>
            </button>
          )}
        </div>

        {/* Logs List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px] max-h-[360px]">
          {logs.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800/80">
              <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-400">No outbound API requests recorded in this session</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Make an audit query or click "Test Connection" above to capture live network traces.
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const isSelected = selectedLogId === log.id;
              const isSuccess = log.status >= 200 && log.status < 300;
              const isUnauthorized = log.status === 401;
              const isRateLimited = log.status === 429;

              let statusBg = 'bg-slate-800 text-slate-300';
              if (isSuccess) statusBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
              else if (isUnauthorized) statusBg = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
              else if (isRateLimited) statusBg = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
              else if (log.status === 0) statusBg = 'bg-red-900/40 text-red-300 border-red-700/50';

              return (
                <div
                  key={log.id}
                  className={`rounded-xl border transition overflow-hidden text-xs ${
                    isSelected ? 'bg-slate-800/90 border-amber-500/40 shadow-md' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedLogId(isSelected ? null : log.id)}
                    className="w-full p-2.5 text-left flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 truncate min-w-0">
                      {isSelected ? (
                        <ChevronDown className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">{log.timestamp}</span>
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${statusBg}`}>
                        {log.status === 0 ? 'FAIL' : `HTTP ${log.status}`}
                      </span>
                      <span className="font-bold text-slate-200 truncate font-mono text-[11px]">{log.endpoint}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {log.hasApiKey ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                          Key Attached
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-mono">
                          No Key
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-500">{log.durationMs}ms</span>
                    </div>
                  </button>

                  {/* Expanded Detail Panel */}
                  {isSelected && (
                    <div className="p-3 bg-slate-900/90 border-t border-slate-800 space-y-2 text-[11px] animate-in fade-in">
                      <div>
                        <span className="text-slate-400 font-bold block mb-0.5">Target Request URL:</span>
                        <code className="text-amber-300 font-mono break-all bg-black/40 px-2 py-1 rounded block">
                          {log.url}
                        </code>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-400 font-bold block mb-0.5">Headers Sent:</span>
                          <pre className="bg-black/40 p-2 rounded text-[10px] text-slate-300 font-mono overflow-x-auto">
                            {JSON.stringify(log.headersSent, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block mb-0.5">Diagnostic State:</span>
                          <div className="bg-black/40 p-2 rounded text-[10px] text-slate-300 font-mono space-y-1">
                            <div>Status: {log.status} ({log.statusText})</div>
                            <div>Execution Latency: {log.durationMs}ms</div>
                            <div>Key Mask: {log.apiKeyPreview}</div>
                            {log.error && <div className="text-rose-400 font-bold">Error: {log.error}</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <span>Documentation:</span>
            <a
              href="https://api2.warera.io/docs/"
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:underline flex items-center gap-1 font-mono"
            >
              api2.warera.io/docs
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
