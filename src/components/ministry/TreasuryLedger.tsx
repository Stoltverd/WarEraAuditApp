import React, { useState } from 'react';
import {
  NationalTransaction,
  NationalTransactionCategory,
  TransactionDirection,
} from '../../types/ministry';
import { WareraCountry } from '../../types/warera';
import {
  exportNationalTransactionsToCsv,
  parseNationalTransactionsCsv,
} from '../../services/ministryService';
import { fetchNationalTransfers } from '../../services/apiService';
import {
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Download,
  Upload,
  Trash2,
  Calendar,
  FileSpreadsheet,
  Globe,
  FileText,
  Search,
  Check,
  AlertCircle,
  X,
  RefreshCw,
  Loader2,
  Edit3,
} from 'lucide-react';

interface TreasuryLedgerProps {
  countryName: string;
  countryId: string;
  countries: WareraCountry[];
  transactions: NationalTransaction[];
  apiKey?: string;
  onAddTransaction: (tx: NationalTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onImportTransactions: (txs: NationalTransaction[]) => void;
}

export const TreasuryLedger: React.FC<TreasuryLedgerProps> = ({
  countryName,
  countryId,
  countries,
  transactions,
  apiKey,
  onAddTransaction,
  onDeleteTransaction,
  onImportTransactions,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<NationalTransaction | null>(null);
  const [search, setSearch] = useState('');
  const [filterDirection, setFilterDirection] = useState<'all' | 'sent' | 'received'>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | '24h' | '7d' | '30d'>('all');
  const [isSyncingApi, setIsSyncingApi] = useState(false);
  const [syncApiMessage, setSyncApiMessage] = useState<string | null>(null);

  // New Transaction Form State
  const [targetCountryId, setTargetCountryId] = useState('');
  const [direction, setDirection] = useState<TransactionDirection>('sent');
  const [category, setCategory] = useState<NationalTransactionCategory>('alianza');
  const [amountBtc, setAmountBtc] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNote, setReferenceNote] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const formatBtc = (val: number) => {
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });
  };

  // Filtered transactions
  const filtered = transactions.filter((t) => {
    if (filterDirection !== 'all' && t.direction !== filterDirection) return false;
    if (periodFilter !== 'all') {
      const txMs = new Date(t.date || t.createdAt).getTime();
      const nowMs = Date.now();
      const maxAgeMs = (periodFilter === '24h' ? 1 : periodFilter === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000;
      if (nowMs - txMs > maxAgeMs) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.targetCountryName.toLowerCase().includes(q) ||
        t.sourceCountryName.toLowerCase().includes(q) ||
        t.referenceNote.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate totals
  const totalSent = filtered
    .filter((t) => t.direction === 'sent')
    .reduce((acc, t) => acc + t.amountBtc, 0);

  const totalReceived = filtered
    .filter((t) => t.direction === 'received')
    .reduce((acc, t) => acc + t.amountBtc, 0);

  const netBalance = totalReceived - totalSent;

  // Update single category directly
  const handleUpdateCategory = (id: string, newCategory: NationalTransactionCategory) => {
    const updated = transactions.map((t) => (t.id === id ? { ...t, category: newCategory } : t));
    onImportTransactions(updated);
  };

  // Update reference note directly
  const handleUpdateNote = (id: string, newNote: string) => {
    const updated = transactions.map((t) => (t.id === id ? { ...t, referenceNote: newNote } : t));
    onImportTransactions(updated);
  };

  // Save changes from Edit Modal
  const handleSaveEditTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const targetC = countries.find((c) => c._id === editingTx.targetCountryId);
    const resolvedTargetName = targetC?.name || editingTx.targetCountryName || 'Foreign Nation';
    const isSent = editingTx.direction === 'sent';
    const finalTx: NationalTransaction = {
      ...editingTx,
      sourceCountryName: isSent ? countryName : resolvedTargetName,
      sourceCountryId: isSent ? countryId : (targetC?._id || editingTx.targetCountryId),
      targetCountryName: isSent ? resolvedTargetName : countryName,
      targetCountryId: isSent ? (targetC?._id || editingTx.targetCountryId) : countryId,
    };
    const updated = transactions.map((t) => (t.id === finalTx.id ? finalTx : t));
    onImportTransactions(updated);
    setEditingTx(null);
  };

  // Handle Form Submission
  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.max(0, parseFloat(amountBtc) || 0);
    if (!parsedAmount) return;

    const targetCountry = countries.find((c) => c._id === targetCountryId);
    const targetName = targetCountry?.name || 'Foreign Nation';

    const newTx: NationalTransaction = {
      id: `nat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceCountryId: direction === 'sent' ? countryId : targetCountryId,
      sourceCountryName: direction === 'sent' ? countryName : targetName,
      targetCountryId: direction === 'sent' ? targetCountryId : countryId,
      targetCountryName: direction === 'sent' ? targetName : countryName,
      direction,
      category,
      amountBtc: parsedAmount,
      date: txDate,
      referenceNote: referenceNote.trim(),
      createdAt: new Date().toISOString(),
    };

    onAddTransaction(newTx);
    setIsAddOpen(false);
    setAmountBtc('');
    setReferenceNote('');
  };

  // Export to CSV
  const handleExportCsv = () => {
    const csv = exportNationalTransactionsToCsv(transactions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${countryName}_National_Treasury_Transfers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sync state transfers from War Era API
  const handleSyncApi = async () => {
    if (!apiKey || !apiKey.trim()) {
      setSyncApiMessage('Please connect your War Era API Token in the header to auto-sync country transfers.');
      setTimeout(() => setSyncApiMessage(null), 4500);
      return;
    }

    setIsSyncingApi(true);
    setSyncApiMessage(null);
    try {
      const apiTxs = await fetchNationalTransfers(countryId, apiKey, countryName, countries);
      if (apiTxs.length > 0) {
        onImportTransactions(apiTxs);
        setSyncApiMessage(`Successfully imported ${apiTxs.length} country transfers from War Era API!`);
      } else {
        setSyncApiMessage('No country transfers found in recent API records for this nation.');
      }
    } catch (err: any) {
      setSyncApiMessage(`API sync error: ${err?.message || 'Failed to connect'}`);
    } finally {
      setIsSyncingApi(false);
      setTimeout(() => setSyncApiMessage(null), 4500);
    }
  };

  // Import CSV / JSON File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let imported: NationalTransaction[] = [];
        if (file.name.endsWith('.json')) {
          imported = JSON.parse(text);
        } else {
          imported = parseNationalTransactionsCsv(text);
        }

        if (Array.isArray(imported) && imported.length > 0) {
          onImportTransactions(imported);
          setImportStatus(`Successfully imported ${imported.length} national transactions!`);
          setTimeout(() => setImportStatus(null), 4000);
        } else {
          setImportStatus('No valid transactions found in file.');
          setTimeout(() => setImportStatus(null), 4000);
        }
      } catch (err: any) {
        setImportStatus(`Import error: ${err.message || 'Invalid format'}`);
        setTimeout(() => setImportStatus(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards: Sent, Received, Net Bilateral Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5 text-red-400" /> Outgoing State Transfers
          </div>
          <div className="text-2xl font-black font-mono text-red-400">
            {formatBtc(totalSent)} <span className="text-xs text-red-500 font-bold">BTC</span>
          </div>
          <div className="text-slate-500 text-[11px] mt-1">Paid to allies, mercenaries & treaties</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" /> Incoming Foreign Funds
          </div>
          <div className="text-2xl font-black font-mono text-emerald-300">
            {formatBtc(totalReceived)} <span className="text-xs text-emerald-500 font-bold">BTC</span>
          </div>
          <div className="text-slate-500 text-[11px] mt-1">Received from allies, aid & reparations</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-400" /> Net Inter-State Position
          </div>
          <div className={`text-2xl font-black font-mono ${netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {netBalance >= 0 ? '+' : ''}{formatBtc(netBalance)} <span className="text-xs font-bold text-amber-400">BTC</span>
          </div>
          <div className="text-slate-500 text-[11px] mt-1">Net sovereign liquidity impact for {countryName}</div>
        </div>
      </div>

      {/* Action Bar: Add, Export Excel, Import, Filters */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" /> Log State Transfer
          </button>

          {/* Sync Transfers from API */}
          <button
            type="button"
            onClick={handleSyncApi}
            disabled={isSyncingApi}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition active:scale-95 ${
              isSyncingApi
                ? 'bg-amber-600/30 text-amber-300 border-amber-500/40 cursor-wait'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Auto-ingest state transfers directly from War Era API"
          >
            {isSyncingApi ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <RefreshCw className="w-4 h-4 text-cyan-400" />
            )}
            <span>{isSyncingApi ? 'Syncing...' : 'Sync Transfers from API'}</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
            title="Download CSV spreadsheet compatible with Excel, Google Sheets, and LibreOffice"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Export CSV
          </button>

          {/* Import CSV */}
          <label className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95">
            <Upload className="w-4 h-4 text-amber-400" /> Import CSV
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Period, Direction & Search Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-2">Period:</span>
            {(['all', '30d', '7d', '24h'] as const).map((pKey) => (
              <button
                key={pKey}
                type="button"
                onClick={() => setPeriodFilter(pKey)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  periodFilter === pKey
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {pKey === 'all' ? 'All-Time' : pKey === '30d' ? '30 Days' : pKey === '7d' ? '7 Days' : '24 Hours'}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search nation or note..."
              className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value as any)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Directions</option>
            <option value="sent">Outgoing (Sent)</option>
            <option value="received">Incoming (Received)</option>
          </select>
        </div>
      </div>

      {/* Import Status Alert */}
      {importStatus && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{importStatus}</span>
        </div>
      )}

      {/* API Sync Notification Banner */}
      {syncApiMessage && (
        <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-xs text-cyan-300 flex items-center gap-2 animate-in fade-in duration-150">
          <RefreshCw className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{syncApiMessage}</span>
        </div>
      )}

      {/* Transactions Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl scrollbar-thin scrollbar-thumb-slate-700">
        <table className="w-full min-w-[850px] text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3.5 px-4">Date</th>
              <th className="py-3.5 px-4">From (Origin Nation)</th>
              <th className="py-3.5 px-4 text-center">Direction Flow</th>
              <th className="py-3.5 px-4">To (Destination Nation)</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4 text-right">Amount (BTC)</th>
              <th className="py-3.5 px-4">Reference Note / Treaty</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 font-mono">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500 text-xs font-sans">
                  No inter-state transactions recorded for this period ({periodFilter === 'all' ? 'All-Time' : periodFilter === '30d' ? 'Last 30 Days' : periodFilter === '7d' ? 'Last 7 Days' : 'Last 24 Hours'}). Click &quot;Log State Transfer&quot; or &quot;Sync Transfers from API&quot;.
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const isSent = t.direction === 'sent';

                // Robust country resolution using ID dictionary, stored names, and note detection (e.g. Malaysia / Malasya)
                const noteText = (t.referenceNote || '').toLowerCase();
                let detectedAllyFromNote = '';
                if (noteText.includes('malasya') || noteText.includes('malaysia')) {
                  detectedAllyFromNote = 'Malaysia';
                } else {
                  const matchC = countries.find((c) => c.name && c._id !== countryId && noteText.includes(c.name.toLowerCase()));
                  if (matchC) detectedAllyFromNote = matchC.name;
                }

                const targetById = t.targetCountryId ? countries.find((c) => c._id === t.targetCountryId)?.name : null;
                const sourceById = t.sourceCountryId ? countries.find((c) => c._id === t.sourceCountryId)?.name : null;

                const validTargetName =
                  (t.targetCountryName && t.targetCountryName !== 'Foreign Ally' && t.targetCountryName !== 'Foreign Nation' && t.targetCountryName !== 'Target')
                    ? t.targetCountryName
                    : (targetById || detectedAllyFromNote || (isSent ? 'Malaysia' : countryName));

                const validSourceName =
                  (t.sourceCountryName && t.sourceCountryName !== 'Foreign Ally' && t.sourceCountryName !== 'Foreign Nation' && t.sourceCountryName !== 'Source')
                    ? t.sourceCountryName
                    : (sourceById || (isSent ? countryName : (detectedAllyFromNote || 'Foreign Ally')));

                const fromCountry = isSent ? countryName : (validSourceName || 'Foreign Ally');
                const toCountry = isSent ? (validTargetName || 'Foreign Ally') : countryName;

                return (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 text-slate-400 font-sans whitespace-nowrap">{t.date}</td>
                    
                    {/* Origin Nation */}
                    <td className="py-3.5 px-4 font-sans font-bold">
                      <span className={`px-2 py-0.5 rounded-lg border text-xs inline-flex items-center gap-1.5 ${
                        fromCountry === countryName
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-slate-800 text-slate-200 border-slate-700'
                      }`}>
                        <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{fromCountry}</span>
                      </span>
                    </td>

                    {/* Direction Flow Badge */}
                    <td className="py-3.5 px-4 text-center font-sans">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                        isSent
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {isSent ? (
                          <>
                            <ArrowUpRight className="w-3 h-3 text-red-400" />
                            <span>OUTGOING ➔</span>
                          </>
                        ) : (
                          <>
                            <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
                            <span>➔ INCOMING</span>
                          </>
                        )}
                      </span>
                    </td>

                    {/* Destination Nation */}
                    <td className="py-3.5 px-4 font-sans font-bold">
                      <span className={`px-2 py-0.5 rounded-lg border text-xs inline-flex items-center gap-1.5 ${
                        toCountry === countryName
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-200 border-slate-700'
                      }`}>
                        <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{toCountry}</span>
                      </span>
                    </td>

                    {/* Category (Help, Joke, Alliance, Pact) */}
                    <td className="py-3.5 px-4 font-sans">
                      <select
                        value={t.category}
                        onChange={(e) => handleUpdateCategory(t.id, e.target.value as any)}
                        className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                        title="Change transaction category"
                      >
                        <option value="ayuda">🤝 Help</option>
                        <option value="broma">🎭 Joke</option>
                        <option value="alianza">🛡️ Alliance</option>
                        <option value="pacto">📜 Pact</option>
                        <option value="alliance-pact">🛡️ Alliance / Pact</option>
                        <option value="foreign-aid">🌍 Foreign Aid</option>
                        <option value="other">📦 Other</option>
                      </select>
                    </td>

                    {/* Amount */}
                    <td className={`py-3.5 px-4 text-right font-black ${isSent ? 'text-red-400' : 'text-emerald-400'}`}>
                      {isSent ? '-' : '+'}{formatBtc(t.amountBtc)} BTC
                    </td>

                    {/* Reference Note - User-Editable */}
                    <td className="py-3.5 px-4 font-sans text-slate-300 min-w-[200px]">
                      <input
                        type="text"
                        defaultValue={t.referenceNote || ''}
                        placeholder="Add note..."
                        onBlur={(e) => {
                          if (e.target.value !== t.referenceNote) {
                            handleUpdateNote(t.id, e.target.value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        className="w-full bg-slate-950/70 hover:bg-slate-950 focus:bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-amber-500 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none transition font-sans"
                        title="Click to edit reference note directly"
                      />
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingTx(t)}
                          className="px-2.5 py-1 rounded-lg text-amber-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition text-[11px] font-bold inline-flex items-center gap-1"
                          title="Edit transfer details"
                        >
                          <Edit3 className="w-3 h-3 text-amber-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(t.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Add New Inter-State Transaction */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" /> Log Inter-State Transfer
              </h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNew} className="mt-4 space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Counterparty Nation</label>
                <select
                  value={targetCountryId}
                  onChange={(e) => setTargetCountryId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select Partner/Rival Nation...</option>
                  {countries
                    .filter((c) => c._id !== countryId)
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Direction</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="sent">Outgoing (Sent by {countryName})</option>
                    <option value="received">Incoming (Received by {countryName})</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="ayuda">🤝 Ayuda</option>
                    <option value="broma">🎭 Broma</option>
                    <option value="alianza">🛡️ Alianza</option>
                    <option value="pacto">📜 Pacto</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Monto (BTC)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={amountBtc}
                    onChange={(e) => setAmountBtc(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nota de Referencia / Motivo</label>
                <input
                  type="text"
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  placeholder="e.g. Préstamo militar o acuerdo bilateral"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl transition shadow-md"
                >
                  Guardar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Transferencia Inter-Estatal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" /> Editar Transferencia Inter-Estatal
              </h3>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTx} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Counterparty Nation (Destination or Source)</label>
                <select
                  value={editingTx.targetCountryId || ''}
                  onChange={(e) => {
                    const cId = e.target.value;
                    const cMatch = countries.find((c) => c._id === cId);
                    setEditingTx({
                      ...editingTx,
                      targetCountryId: cId,
                      targetCountryName: cMatch?.name || editingTx.targetCountryName,
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 cursor-pointer font-bold"
                >
                  <option value="">{editingTx.targetCountryName || '-- Select Counterparty Nation --'}</option>
                  {countries
                    .filter((c) => c._id !== countryId)
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Currently recorded: <strong className="text-amber-300">{editingTx.targetCountryName || 'Unassigned'}</strong>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Flow Direction</label>
                  <select
                    value={editingTx.direction}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        direction: e.target.value as TransactionDirection,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="sent">Outgoing ({countryName} ➔ Destination)</option>
                    <option value="received">Incoming (Counterparty ➔ {countryName})</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Category</label>
                  <select
                    value={editingTx.category}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        category: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="ayuda">🤝 Help</option>
                    <option value="broma">🎭 Joke</option>
                    <option value="alianza">🛡️ Alliance</option>
                    <option value="pacto">📜 Pact</option>
                    <option value="alliance-pact">🛡️ Alliance / Pact</option>
                    <option value="foreign-aid">🌍 Foreign Aid</option>
                    <option value="other">📦 Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Amount (BTC)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={editingTx.amountBtc}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        amountBtc: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editingTx.date}
                    onChange={(e) =>
                      setEditingTx({
                        ...editingTx,
                        date: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Reference Note / Treaty Reason</label>
                <input
                  type="text"
                  value={editingTx.referenceNote || ''}
                  onChange={(e) =>
                    setEditingTx({
                      ...editingTx,
                      referenceNote: e.target.value,
                    })
                  }
                  placeholder="Details regarding treaty, mutual defense, alliance, or joke transfer"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl transition shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
