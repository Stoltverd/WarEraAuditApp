import React, { useState, useEffect } from 'react';
import { Key, X, AlertCircle, Check, Trash2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { testWarEraApiConnection } from '../services/apiService';
import { useI18n } from '../i18n/I18nContext';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (newKey: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
}) => {
  const { lang, tx } = useI18n();
  const [inputKey, setInputKey] = useState(apiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{
    success: boolean;
    status: number;
    message: string;
    durationMs?: number;
    itemsCount?: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInputKey(apiKey);
      setSavedSuccess(false);
      setTestFeedback(null);
    }
  }, [isOpen, apiKey]);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!inputKey.trim()) {
      setTestFeedback({
        success: false,
        status: 0,
        message: tx(
          'Please paste your token first before testing.',
          'Por favor pega tu token primero antes de probarlo.'
        ),
      });
      return;
    }

    setIsTesting(true);
    setTestFeedback(null);
    try {
      const res = await testWarEraApiConnection(inputKey.trim());
      setTestFeedback({
        success: res.authOk,
        status: res.authStatus,
        message: res.message,
        durationMs: res.durationMs,
        itemsCount: res.itemsCount,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSaveApiKey(inputKey.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const handleClear = () => {
    setInputKey('');
    onSaveApiKey('');
    setSavedSuccess(false);
    setTestFeedback(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto flex min-h-full items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-2xl my-auto animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {tx('War Era API Token', 'Token API de War Era')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {tx(
                  'Directly powers state warehouses & citizen audits',
                  'Impulsa directamente los almacenes estatales y las auditorías ciudadanas'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tx('Close', 'Cerrar')}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto pr-1 my-4 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            {lang === 'es' ? (
              <>
                Conectar tu token API de War Era habilita la verificación en vivo contra{' '}
                <code className="text-amber-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">
                  https://api2.warera.io
                </code>
                . Ningún dato simulado ocultará claves faltantes o inválidas.
              </>
            ) : (
              <>
                Connecting your War Era API token enables live verification against{' '}
                <code className="text-amber-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">
                  https://api2.warera.io
                </code>
                . No fallback data will mask missing or invalid keys.
              </>
            )}
          </p>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {tx('Your Private API Token', 'Tu Token API Privado')}
              </label>
              {inputKey.trim() && (
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={isTesting}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                >
                  <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? tx('Testing...', 'Probando...') : tx('Test Token', 'Probar Token')}</span>
                </button>
              )}
            </div>
            <input
              type="password"
              placeholder={tx(
                'Paste your War Era API token here...',
                'Pega tu token API de War Era aquí...'
              )}
              value={inputKey}
              onChange={(e) => {
                setInputKey(e.target.value);
                setTestFeedback(null);
              }}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono tracking-wide shadow-inner"
              autoFocus
            />
          </div>

          {/* Test Feedback */}
          {testFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 animate-in fade-in ${
                testFeedback.success
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              {testFeedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div>{testFeedback.message}</div>
                <div className="flex items-center gap-2 mt-1">
                  {testFeedback.status > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-current opacity-80">
                      HTTP {testFeedback.status}
                    </span>
                  )}
                  {testFeedback.durationMs !== undefined && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-current opacity-80">
                      {testFeedback.durationMs}ms
                    </span>
                  )}
                  {testFeedback.itemsCount !== undefined && testFeedback.itemsCount > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-current opacity-80">
                      {`${testFeedback.itemsCount} ${tx('live records', 'registros en vivo')}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {tx(
                  'API Token successfully saved! Updating queries...',
                  '¡Token API guardado con éxito! Actualizando consultas...'
                )}
              </span>
            </div>
          )}

          <div className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 flex items-start gap-3 text-xs text-slate-400">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-slate-200 block mb-0.5">
                {tx('Where do I find my API key?', '¿Dónde encuentro mi clave API?')}
              </span>
              {lang === 'es' ? (
                <>
                  Ve a <strong className="text-white">War Era</strong> &rarr; Perfil / Configuración &rarr;{' '}
                  <strong className="text-white">Acceso API (API Access)</strong>. Tu clave se guarda estrictamente en el almacenamiento local de tu dispositivo y se envía mediante el encabezado{' '}
                  <code className="text-amber-400 bg-slate-900 px-1 rounded font-mono">X-API-Key</code> para los procedimientos autenticados de War Era tRPC.
                </>
              ) : (
                <>
                  Go to <strong className="text-white">War Era</strong> &rarr; Profile / Settings &rarr;{' '}
                  <strong className="text-white">API Access</strong>. Your key is kept strictly in local device storage and sent via <code className="text-amber-400 bg-slate-900 px-1 rounded font-mono">X-API-Key</code> header for authenticated War Era tRPC procedures.
                </>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3.5 border-t border-slate-800 shrink-0">
          {apiKey ? (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-bold transition py-1 px-2 rounded-lg hover:bg-rose-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{tx('Clear Token', 'Borrar Token')}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
            >
              {tx('Cancel', 'Cancelar')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/20 transition active:scale-95"
            >
              {tx('Save & Connect', 'Guardar y Conectar')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
