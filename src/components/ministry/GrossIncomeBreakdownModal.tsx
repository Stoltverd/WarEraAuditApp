import React, { useState } from 'react';
import { CitizenEconomicProfile, MinistryConfig } from '../../types/ministry';
import { WareraUserLite } from '../../types/warera';
import { fetchUserTransactions } from '../../services/apiService';
import { calculatePlayerCashflowSummary, evaluateLeechTier } from '../../services/ministryService';
import { storage } from '../../services/storage';
import {
  X,
  TrendingUp,
  Coins,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownLeft,
  HeartHandshake,
  Building2,
  Package,
  Shield,
  FileText,
  RefreshCw,
  Swords,
  Briefcase,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface GrossIncomeBreakdownModalProps {
  profile: CitizenEconomicProfile | null;
  countryName: string;
  config?: MinistryConfig;
  apiKey?: string;
  onClose: () => void;
  onUpdateProfile?: (updated: CitizenEconomicProfile) => void;
}

export const GrossIncomeBreakdownModal: React.FC<GrossIncomeBreakdownModalProps> = ({
  profile,
  countryName,
  config,
  apiKey,
  onClose,
  onUpdateProfile,
}) => {
  const [isSyncingLedger, setIsSyncingLedger] = useState(false);
  const [localProfile, setLocalProfile] = useState<CitizenEconomicProfile | null>(profile);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  React.useEffect(() => {
    setLocalProfile(profile);
    setSyncStatusMsg(null);
  }, [profile]);

  if (!localProfile) return null;

  const currentProfile = localProfile;
  const cashflow = currentProfile.playerCashflow;
  const periodDays = cashflow?.periodDays || config?.analysisPeriodDays || 7;

  const formatBtc = (val?: number) =>
    (val || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  const wagesEarned = cashflow?.wagesEarnedBtc ?? cashflow?.salariesEarnedBtc ?? 0;
  const wagesCount = cashflow?.wagesCount ?? 0;
  const salesVolume = cashflow?.salesVolumeBtc ?? 0;
  const salesCount = cashflow?.salesCount ?? 0;
  const purchasesVolume = cashflow?.purchasesVolumeBtc ?? 0;
  const purchasesCount = cashflow?.purchasesCount ?? 0;
  const netTradeMargin = cashflow?.netTradeProfitBtc ?? Math.max(0, salesVolume - purchasesVolume);
  const periodDonated = currentProfile.periodDonatedBtc ?? currentProfile.directDonatedBtc ?? 0;
  const grossIncome = currentProfile.grossIncomeBtc ?? Math.max(wagesEarned + netTradeMargin + periodDonated, 20);

  const commoditySales = cashflow?.commoditySalesBtc ?? 0;
  const equipmentSales = cashflow?.equipmentSalesBtc ?? 0;
  const commodityPurchases = cashflow?.commodityPurchasesBtc ?? 0;
  const equipmentPurchases = cashflow?.equipmentPurchasesBtc ?? 0;
  const tipsReceived = cashflow?.tipsReceivedBtc ?? 0;
  const craftingExpenses = cashflow?.craftingExpensesBtc ?? 0;
  const dismantleExpenses = cashflow?.dismantleExpensesBtc ?? 0;
  const caseOpeningExpenses = cashflow?.caseOpeningExpensesBtc ?? 0;
  const applicationFees = cashflow?.applicationFeesBtc ?? 0;
  const netDisposableIncome = cashflow?.netDisposableIncomeBtc ?? Math.max(0, wagesEarned + netTradeMargin + tipsReceived - craftingExpenses - applicationFees);

  const verdict = currentProfile.ministerialVerdict || cashflow?.ministerialVerdict || 'moderate-contributor';
  const verdictReason = currentProfile.ministerialVerdictReason || cashflow?.ministerialVerdictReason || 'Evaluated against national ministerial policy.';

  const liquidBtc = typeof currentProfile.liquidBtc === 'number' ? currentProfile.liquidBtc : 0;
  const companyEquity = currentProfile.companiesWealthBtc || 0;
  const itemStockpile = currentProfile.resourceWealthBtc || 0;
  const equipmentWealth = (currentProfile.equipmentsWealthBtc || 0) + (currentProfile.weaponsWealthBtc || 0);

  const isCombatPolicyActive = Boolean(config?.includeDamageInLeechCalculation);
  const combatDamage = currentProfile.totalCombatDamage || 0;
  const militaryCreditRate = config?.damageConversionRateBtcPer1k ?? 0.08;
  const militaryCredit = typeof currentProfile.damageValueBtc === 'number' ? currentProfile.damageValueBtc : 0;
  const totalSovereignContribution = periodDonated + militaryCredit;

  // On-demand fetch of citizen's live personal transaction ledger (Wages, Item Market, etc.)
  const handleSyncLiveReceipts = async () => {
    if (!apiKey || !apiKey.trim() || isSyncingLedger) return;
    setIsSyncingLedger(true);
    setSyncStatusMsg('Connecting to War Era transaction stream for citizen...');
    try {
      const personalTxs = await fetchUserTransactions(currentProfile.userId, apiKey);
      if (personalTxs.length === 0) {
        setSyncStatusMsg('Queried personal stream: 0 new receipts found for this period.');
      } else {
        // Persist verified receipts into IndexedDB
        await storage.saveUserPersonalTransactions(currentProfile.userId, personalTxs);

        const reconstructedUser: Partial<WareraUserLite> = {
          _id: currentProfile.userId,
          username: currentProfile.username,
          avatarUrl: currentProfile.avatarUrl,
          country: currentProfile.countryId,
          level: currentProfile.level,
          money: currentProfile.liquidBtc,
          stats: {
            wealth: {
              total: currentProfile.wealthBtc,
              money: currentProfile.liquidBtc || 0,
              companies: currentProfile.companiesCount ? currentProfile.companiesCount * 3000 : 0,
            },
          } as any,
        };

        const recalculated = calculatePlayerCashflowSummary(
          currentProfile.userId,
          reconstructedUser as any,
          personalTxs,
          periodDays
        );
        const newWages = recalculated.summary.wagesEarnedBtc;
        const newTrade = recalculated.summary.netTradeProfitBtc;
        const newTips = recalculated.summary.tipsReceivedBtc || 0;
        const totalCashflowIn = newWages + newTrade + newTips;
        const newGross = Math.max(Math.round((totalCashflowIn + periodDonated) * 100) / 100, periodDonated);

        // Re-evaluate leech tier with verified gross income
        const currentWealthBasis = currentProfile.wealthBtc + (currentProfile.resourceWealthBtc || 0);
        const tierEval = evaluateLeechTier(
          currentWealthBasis,
          periodDonated,
          config,
          newGross,
          currentProfile.playstyle,
          currentProfile.totalDonatedBtc,
          currentProfile.resourceWealthBtc,
          currentProfile.totalCombatDamage,
          currentProfile.isHistoricalTopDonor,
          currentProfile.historicalRank,
          currentProfile.isNationalHeavyHitter,
          currentProfile.heavyHitterRank
        );

        const updatedProfile: CitizenEconomicProfile = {
          ...currentProfile,
          playerCashflow: recalculated.summary,
          grossIncomeBtc: newGross,
          contributionRatio: tierEval.ratio,
          leechTier: tierEval.tier,
          damageValueBtc: tierEval.damageValueBtc,
          tierReasonBadge: tierEval.reason || currentProfile.tierReasonBadge,
          ministerialVerdict: recalculated.summary.ministerialVerdict || currentProfile.ministerialVerdict,
          ministerialVerdictReason: recalculated.summary.ministerialVerdictReason || currentProfile.ministerialVerdictReason,
          companiesCount: recalculated.companiesCount,
          activeCompaniesCount: recalculated.activeCompaniesCount,
          auditBaselineStatus: 'audited',
          auditMethodologyNote: `Verified via ${personalTxs.length} live in-game personal receipts.`,
        };

        setLocalProfile(updatedProfile);
        onUpdateProfile?.(updatedProfile);
        setSyncStatusMsg(`Successfully streamed ${personalTxs.length} personal receipts (${recalculated.summary.wagesCount} wage shifts, ${recalculated.summary.salesCount} market orders)!`);
      }
    } catch (err: any) {
      setSyncStatusMsg(`Sync notice: ${err.message || 'Failed to stream personal receipts'}`);
    } finally {
      setIsSyncingLedger(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        {/* Header with prominent Avatar */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-950/80">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-cyan-500/40 overflow-hidden flex items-center justify-center text-xl font-black text-cyan-300 shadow-lg shrink-0 relative bg-gradient-to-br from-slate-800 to-slate-950">
              {currentProfile.avatarUrl ? (
                <img
                  src={currentProfile.avatarUrl}
                  alt={currentProfile.username}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                currentProfile.username.slice(0, 2).toUpperCase()
              )}
              <div className="absolute -bottom-1 -right-1 bg-slate-900 border border-cyan-500/50 px-1 py-0.2 rounded text-[9px] font-mono text-cyan-300 font-bold">
                Lv{currentProfile.level}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-white">{currentProfile.username}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {countryName}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  verdict === 'slacker-evader'
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : verdict === 'subsistence-worker'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : verdict === 'illiquid-asset-rich'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : verdict === 'patriotic-fulfiller'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  {verdict === 'slacker-evader'
                    ? '🚨 Evader / Slacker'
                    : verdict === 'subsistence-worker'
                    ? '🛡️ Subsistence Worker (Exempt)'
                    : verdict === 'illiquid-asset-rich'
                    ? '🔒 Illiquid Combatant'
                    : verdict === 'patriotic-fulfiller'
                    ? '💎 Patriotic Fulfiller'
                    : '🔵 Active Contributor'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Authentic Multi-Stream Cashflow Audit ({periodDays}-Day Ledger Window)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Ministerial Audit Verdict Banner */}
          <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
            verdict === 'slacker-evader'
              ? 'bg-red-950/40 border-red-800/60 text-red-200'
              : verdict === 'subsistence-worker'
              ? 'bg-blue-950/40 border-blue-800/60 text-blue-200'
              : verdict === 'illiquid-asset-rich'
              ? 'bg-purple-950/40 border-purple-800/60 text-purple-200'
              : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
          }`}>
            <div className="mt-0.5 shrink-0 text-base">
              {verdict === 'slacker-evader' ? '⚠️' : verdict === 'subsistence-worker' ? '🛡️' : verdict === 'illiquid-asset-rich' ? '🔒' : '🌟'}
            </div>
            <div className="space-y-0.5">
              <span className="font-bold text-white block">
                Ministerial Audit Verdict: {verdict.toUpperCase().replace('-', ' ')}
              </span>
              <p className="text-[11px] opacity-90 leading-relaxed">
                {verdictReason}
              </p>
            </div>
          </div>

          {/* Top Hero Banner: Total Gross Income vs Net Disposable Cashflow */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-slate-900 border border-cyan-500/30 grid grid-cols-1 sm:grid-cols-2 gap-4 shadow-lg">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>Gross Cash Inflow ({periodDays}D)</span>
              </div>
              <div className="text-2xl font-black font-mono text-cyan-300 mt-1">
                {formatBtc(grossIncome)} <span className="text-xs text-cyan-400 font-bold">BTC</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Total BTC passing into wallet from all wages, sales turnover, and article tips.
              </p>
            </div>

            <div className="sm:border-l sm:border-slate-800 sm:pl-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                <Coins className="w-4 h-4 text-emerald-400" />
                <span>Net Disposable Cashflow</span>
              </div>
              <div className="text-2xl font-black font-mono text-emerald-300 mt-1">
                {formatBtc(netDisposableIncome)} <span className="text-xs text-emerald-400 font-bold">BTC</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Wages + Net Trade Margin + Tips less crafting and operating expenses.
              </p>
            </div>
          </div>

          {/* Sync Live Receipts Notification / Action Bar */}
          {apiKey ? (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <RefreshCw className={`w-4 h-4 text-cyan-400 ${isSyncingLedger ? 'animate-spin' : ''}`} />
                <span className="font-mono text-[11px]">
                  {syncStatusMsg || (wagesCount > 0 ? `Loaded ${wagesCount} verified wage shifts from personal ledger.` : 'Personal receipts pending. Click to stream verified wage slips.')}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSyncLiveReceipts}
                disabled={isSyncingLedger}
                className="px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLedger ? 'animate-spin' : ''}`} />
                {isSyncingLedger ? 'Streaming...' : 'Sync Live Citizen Receipts'}
              </button>
            </div>
          ) : (
            <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-2xl text-[11px] text-amber-300/90 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Connect War Era API token in Settings to stream line-item wage slips directly from the in-game Transac. ledger.</span>
            </div>
          )}

          {/* Core Income Sources Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Step-by-Step Income Streams</span>
            </h4>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Stream 1: Employment Wages */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-emerald-400" /> Employment Wages &amp; Salaries
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {wagesCount} work shifts
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Real salary received from working shifts in domestic &amp; foreign companies (logged in <strong className="text-slate-300">Wage</strong> ledger).
                    {Boolean(currentProfile.worksCount) && (
                      <span className="block text-[10px] text-emerald-400/90 font-mono mt-0.5">
                        Career In-Game Shifts: {currentProfile.worksCount?.toLocaleString()} total shifts completed.
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-black font-mono text-emerald-300">
                    +{formatBtc(wagesEarned)} <span className="text-xs text-emerald-400">BTC</span>
                  </div>
                </div>
              </div>

              {/* Stream 2: Commercial Item & Equipment Market Sales */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4 text-cyan-400" /> Market Sales (Gross Inflow)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {salesCount} filled orders
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Liquid Bitcoin received when citizen acts as the seller (left side of <strong className="text-slate-300">⇄</strong> in <strong className="text-slate-300">Trading</strong> &amp; <strong className="text-slate-300">Item Market</strong>).
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-black font-mono text-cyan-300">
                      +{formatBtc(salesVolume)} <span className="text-xs text-cyan-400">BTC</span>
                    </div>
                  </div>
                </div>

                {(equipmentSales > 0 || commoditySales > 0) && (
                  <div className="flex items-center gap-3 pt-1 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono">
                    {equipmentSales > 0 && (
                      <span className="flex items-center gap-1">
                        🛡️ Equipment Gear: <strong className="text-slate-200">+{formatBtc(equipmentSales)} BTC</strong>
                      </span>
                    )}
                    {commoditySales > 0 && (
                      <span className="flex items-center gap-1">
                        📦 Commodities: <strong className="text-slate-200">+{formatBtc(commoditySales)} BTC</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Stream 3: Operating Expenses (Market Purchases) */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white flex items-center gap-1.5">
                        <ArrowDownLeft className="w-4 h-4 text-rose-400" /> Operating Expenses (Market Purchases)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {purchasesCount} filled orders
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Liquid Bitcoin spent when citizen acts as the buyer (right side of <strong className="text-slate-300">⇄</strong> for gear, pills, food, munitions).
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-black font-mono text-rose-400">
                      -{formatBtc(purchasesVolume)} <span className="text-xs text-rose-500">BTC</span>
                    </div>
                  </div>
                </div>

                {(equipmentPurchases > 0 || commodityPurchases > 0) && (
                  <div className="flex items-center gap-3 pt-1 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono">
                    {equipmentPurchases > 0 && (
                      <span className="flex items-center gap-1">
                        🛡️ Equipment Bought: <strong className="text-rose-300">-{formatBtc(equipmentPurchases)} BTC</strong>
                      </span>
                    )}
                    {commodityPurchases > 0 && (
                      <span className="flex items-center gap-1">
                        📦 Supplies/Ammo: <strong className="text-rose-300">-{formatBtc(commodityPurchases)} BTC</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Stream 4: Net Realized Commercial Margin */}
              <div className="p-3.5 bg-cyan-950/20 border border-cyan-800/40 rounded-2xl flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-cyan-200">
                    <ArrowUpRight className="w-4 h-4 text-cyan-400" /> Net Commercial Profit Margin
                  </div>
                  <p className="text-[11px] text-cyan-300/80">
                    Realized profit: Spread between sales and cost of goods, protected by anti-flipper margin rules.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-black font-mono text-cyan-300">
                    +{formatBtc(netTradeMargin)} <span className="text-xs text-cyan-400">BTC</span>
                  </div>
                </div>
              </div>

              {/* Stream 5: Treasury Donations */}
              <div className="p-3.5 bg-emerald-950/20 border border-emerald-800/40 rounded-2xl space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-200">
                      <HeartHandshake className="w-4 h-4 text-emerald-400" /> Period Treasury Donations
                    </div>
                    <p className="text-[11px] text-emerald-300/80">
                      Direct BTC transfers made to {countryName}&apos;s treasury in this {periodDays}-day window.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-black font-mono text-emerald-300">
                      +{formatBtc(periodDonated)} <span className="text-xs text-emerald-400">BTC</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono">
                  <span>Cumulative Lifetime Ledger:</span>
                  <span className="text-slate-200 font-bold">{formatBtc(currentProfile.totalDonatedBtc)} BTC career total</span>
                </div>
              </div>

              {/* Combat Defense Contribution Card (Always visible when military policy is active or combat damage exists) */}
              {(isCombatPolicyActive || militaryCredit > 0 || combatDamage > 0) && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 border border-red-500/40 space-y-2 shadow-md">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-red-300 uppercase tracking-wider">
                      <Swords className="w-4 h-4 text-red-400" /> Sovereign Combat Defense Credit
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-950/60 text-red-300 border border-red-800/60">
                      {isCombatPolicyActive ? 'Military Policy Active' : 'Frontline Defense'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs font-mono">
                    <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-sans">7-Day Battlefield Damage:</div>
                      <div className="text-base font-black text-white">
                        {combatDamage.toLocaleString()} DMG
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-sans">Converted Military Credit:</div>
                      <div className="text-base font-black text-red-300">
                        +{formatBtc(militaryCredit)} <span className="text-xs text-red-400">BTC</span>
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-sans">Total National Contribution:</div>
                      <div className="text-base font-black text-emerald-300">
                        +{formatBtc(totalSovereignContribution)} <span className="text-xs text-emerald-400">BTC</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans">
                    Combat conversion calibrated at <strong className="text-slate-200">{militaryCreditRate} BTC per 1,000 damage</strong>. Frontline defenders of {countryName} receive sovereign credit toward national contribution quotas.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Visual Arithmetic Formula Box */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Ministerial Audit Arithmetic Breakdown</span>
            </div>
            
            {/* 1. Gross Income Equation */}
            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 font-sans block">1. Gross Economic Capacity Formula:</span>
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs flex flex-wrap items-center justify-center gap-2 text-slate-300 text-center">
                {currentProfile.auditBaselineStatus === 'audited' ? (
                  <>
                    <span>Verified ΔWealth ({formatBtc(Math.max(0, currentProfile.wealthBtc - (currentProfile.pastWealthBtc ?? currentProfile.wealthBtc)))})</span>
                    <span className="text-slate-500">+</span>
                    <span>Period Donations ({formatBtc(periodDonated)})</span>
                    <span className="text-slate-500">=</span>
                    <span className="text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">
                      {formatBtc(grossIncome)} BTC Gross Income
                    </span>
                  </>
                ) : cashflow?.dataSource === 'live-ledger' ? (
                  <>
                    <span>Wages ({formatBtc(wagesEarned)})</span>
                    <span className="text-slate-500">+</span>
                    <span>Net Trade ({formatBtc(netTradeMargin)})</span>
                    <span className="text-slate-500">+</span>
                    <span>Tips ({formatBtc(tipsReceived)})</span>
                    <span className="text-slate-500">+</span>
                    <span>Donations ({formatBtc(periodDonated)})</span>
                    <span className="text-slate-500">=</span>
                    <span className="text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">
                      {formatBtc(grossIncome)} BTC Gross Income
                    </span>
                  </>
                ) : (
                  <>
                    <span>Baseline Turnover ({formatBtc(Math.max(0, grossIncome - periodDonated))})</span>
                    <span className="text-slate-500">+</span>
                    <span>Period Donations ({formatBtc(periodDonated)})</span>
                    <span className="text-slate-500">=</span>
                    <span className="text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">
                      {formatBtc(grossIncome)} BTC Gross Income
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* 2. Sovereign Contribution & Combat Conversion Equation */}
            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 font-sans block">2. Total Sovereign Contribution Formula:</span>
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs flex flex-wrap items-center justify-center gap-2 text-slate-300 text-center">
                <span>Treasury Donations ({formatBtc(periodDonated)})</span>
                <span className="text-slate-500">+</span>
                <span className={militaryCredit > 0 ? 'text-red-400 font-bold' : 'text-slate-400'}>
                  Combat Defense Credit ({formatBtc(militaryCredit)})
                </span>
                <span className="text-slate-500">=</span>
                <span className="text-emerald-300 font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
                  {formatBtc(totalSovereignContribution)} BTC Total Contribution
                </span>
                <span className="text-slate-500">➔</span>
                <span className="text-amber-300 font-bold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                  {grossIncome > 0 ? ((totalSovereignContribution / grossIncome) * 100).toFixed(1) : '0'}% Contribution Ratio
                </span>
              </div>
            </div>
          </div>

          {/* Balance Sheet Capital Assets (Non-Cash Flow) */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <span>Balance Sheet Capital Stock (Asset Portfolio)</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Total Net Worth: {formatBtc(currentProfile.wealthBtc)} BTC
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                  <Coins className="w-3 h-3 text-amber-400" /> Liquid Cash
                </div>
                <div className="text-base font-black text-amber-300 mt-0.5">
                  {formatBtc(liquidBtc)}
                </div>
                <div className="text-[9px] text-slate-500 font-sans mt-0.5">
                  Available in wallet
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-indigo-400" /> Factory Capital
                </div>
                <div className="text-base font-black text-indigo-300 mt-0.5">
                  {formatBtc(companyEquity)}
                </div>
                <div className="text-[9px] text-slate-500 font-sans mt-0.5">
                  {currentProfile.activeCompaniesCount ?? 0} active / {currentProfile.companiesCount ?? 0} owned
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                  <Package className="w-3 h-3 text-cyan-400" /> Commodity Stockpile
                </div>
                <div className="text-base font-black text-cyan-300 mt-0.5">
                  {formatBtc(itemStockpile)}
                </div>
                <div className="text-[9px] text-slate-500 font-sans mt-0.5">
                  Oil, Iron, Food, Ammo
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                  <Shield className="w-3 h-3 text-rose-400" /> Weapons &amp; Gear
                </div>
                <div className="text-base font-black text-rose-300 mt-0.5">
                  {formatBtc(equipmentWealth)}
                </div>
                <div className="text-[9px] text-slate-500 font-sans mt-0.5">
                  Equipped military gear
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono">
            Audit Baseline: <strong className="text-slate-200">{currentProfile.auditBaselineStatus === 'audited' ? '7D Snapshot Verified' : 'Day-1 Cold Baseline'}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
