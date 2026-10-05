import React, { useState } from 'react';
import { RankingSummary } from '../types/warera';
import { Download, Copy, Check, FileText, Code, MessageSquare, X } from 'lucide-react';

interface ExportModalProps {
  summary: RankingSummary;
  countryName: string;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  summary,
  countryName,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'discord' | 'csv' | 'json'>('discord');
  const [copied, setCopied] = useState(false);

  // Generate Discord Markdown table
  const generateDiscordMarkdown = () => {
    const header = `🏆 **${countryName.toUpperCase()} — ${summary.timeframe.toUpperCase()} BTC DONATION RANKING**\n` +
      `📅 Period: ${new Date(summary.startDate).toLocaleDateString()} - ${new Date(summary.endDate).toLocaleDateString()}\n` +
      `💰 Total Donated: **${summary.totalAmountDonated.toLocaleString()} BTC** | 👥 Patrons: **${summary.totalDonors}**\n\n` +
      '```\n' +
      'Rank | Citizen                 | BTC Donated  | Records\n' +
      '-----+-------------------------+--------------+--------\n';

    const rows = summary.leaderboard.slice(0, 25).map((d) => {
      const rankStr = String(d.rank).padStart(4, ' ');
      const nameStr = d.username.padEnd(23, ' ').slice(0, 23);
      const btcStr = `${d.totalAmount.toLocaleString()} BTC`.padStart(12, ' ');
      const recStr = String(d.donations.length).padStart(6, ' ');
      return `${rankStr} | ${nameStr} | ${btcStr} | ${recStr}`;
    }).join('\n');

    return header + rows + '\n```\n_Generated via War Era Donation Utility_';
  };

  // Generate CSV text
  const generateCSV = () => {
    const headers = ['Rank', 'Citizen', 'UserID', 'BTCDonated', 'DonationsCount', 'LastDonationDate'];
    const rows = summary.leaderboard.map((d) => [
      d.rank,
      `"${d.username.replace(/"/g, '""')}"`,
      d.userId,
      d.totalAmount,
      d.donations.length,
      `"${d.lastDonationAt}"`,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  };

  // Generate JSON text
  const generateJSON = () => {
    return JSON.stringify(
      {
        country: countryName,
        currency: 'BTC',
        timeframe: summary.timeframe,
        generatedAt: new Date().toISOString(),
        summary: {
          totalAmountDonated: summary.totalAmountDonated,
          totalDonors: summary.totalDonors,
          averageDonationAmount: summary.averageDonationAmount,
        },
        leaderboard: summary.leaderboard.map((d) => ({
          rank: d.rank,
          username: d.username,
          userId: d.userId,
          avatarUrl: d.avatarUrl,
          totalAmountBtc: d.totalAmount,
          donationEvents: d.donations.length,
          lastDonated: d.lastDonationAt,
        })),
      },
      null,
      2
    );
  };

  const getActiveText = () => {
    if (activeTab === 'discord') return generateDiscordMarkdown();
    if (activeTab === 'csv') return generateCSV();
    return generateJSON();
  };

  const handleCopy = () => {
    const text = getActiveText();
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = getActiveText();
    const ext = activeTab === 'csv' ? 'csv' : activeTab === 'json' ? 'json' : 'txt';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warera_${countryName.toLowerCase()}_${summary.timeframe}_donations.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Download className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white">Export BTC Donation Rankings</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 my-4">
          <button
            type="button"
            onClick={() => setActiveTab('discord')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition border ${
              activeTab === 'discord'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Discord / Markdown</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('csv')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition border ${
              activeTab === 'csv'
                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Spreadsheet (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition border ${
              activeTab === 'json'
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>JSON Payload</span>
          </button>
        </div>

        {/* Preview Area */}
        <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-4 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>Preview ({activeTab.toUpperCase()})</span>
            <span>{summary.leaderboard.length} citizens</span>
          </div>
          <textarea
            readOnly
            value={getActiveText()}
            className="w-full flex-1 bg-transparent text-slate-300 font-mono text-xs focus:outline-none resize-none overflow-y-auto leading-relaxed"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
          <div className="text-xs text-slate-500">
            Export ready for Discord government channels or Excel
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition shadow-md shadow-amber-500/20"
            >
              <Download className="w-4 h-4" />
              <span>Download File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
