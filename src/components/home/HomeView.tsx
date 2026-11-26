import { useMemo } from "react";
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  Package,
  TrendingUp,
  Truck,
  Scale,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import type { LoadDetail, UnsoldStock } from "@/hooks/use-load-accounts";
import { formatINR, formatTons, formatDate } from "@/lib/calculations";

interface HomeViewProps {
  loads: LoadDetail[];
  unsoldStock: UnsoldStock | null | undefined;
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  onNewLoadClick: () => void;
  onSelectLoad: (load: LoadDetail) => void;
  onViewAllLoads: () => void;
}

export function HomeView({
  loads,
  unsoldStock,
  isLoading,
  error,
  onRetry,
  onNewLoadClick,
  onSelectLoad,
  onViewAllLoads,
}: HomeViewProps) {
  // Current month string 'YYYY-MM'
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, []);

  const currentMonthName = useMemo(() => {
    return new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }, []);

  // Compute all-time / lifetime totals
  const allTimeStats = useMemo(() => {
    let totalTonsSold = 0;
    let totalLoadsSold = 0;
    let totalAllTimeNetProfit = 0;

    loads.forEach((l) => {
      if (l.sale_date) {
        const tons = l.tons_received ?? l.tons_bought ?? 0;
        totalTonsSold += tons;
        totalLoadsSold += 1;
        if (l.profit !== null) {
          const comm = Math.round(tons * 100 * 100) / 100;
          totalAllTimeNetProfit += l.profit - comm; // Deduct ₹100/t Sardarji commission
        }
      }
    });

    return {
      totalTonsSold,
      totalLoadsSold,
      totalAllTimeNetProfit,
    };
  }, [loads]);

  // Compute this month's stats dynamically from loads
  const currentMonthMetrics = useMemo(() => {
    let salesBeforeGst = 0;
    let tonsSold = 0;
    let loadsSoldCount = 0;
    let grossProfitBeforeGst = 0;
    let netProfitBeforeGst = 0;
    let sardarjiCommission = 0;

    let moneyToReceiveTotal = 0;
    let moneyToReceiveOverdue = 0;
    let moneyToPaySuppliers = 0;
    let moneyToPayAgencies = 0;
    let kantaShortageTons = 0;
    let kantaShortageLoss = 0;

    loads.forEach((l) => {
      // Pending receivables from buyer
      if (l.sale_pending && l.sale_pending > 0) {
        moneyToReceiveTotal += l.sale_pending;
        if (l.is_overdue) {
          moneyToReceiveOverdue += l.sale_pending;
        }
      }

      // Pending payables to supplier
      if (l.purchase_pending > 0) {
        moneyToPaySuppliers += l.purchase_pending;
      }

      // Pending payables to agency
      if (l.freight_pending > 0) {
        moneyToPayAgencies += l.freight_pending;
      }

      // Monthly sales & profit check based on sale_date
      if (l.sale_date && l.sale_date.startsWith(currentMonthKey)) {
        if (l.sale_amount) {
          salesBeforeGst += l.sale_amount;
        }
        if (l.tons_received) {
          tonsSold += l.tons_received;
        }
        if (l.profit !== null) {
          const tons = l.tons_received ?? l.tons_bought ?? 0;
          const comm = Math.round(tons * 100 * 100) / 100;
          grossProfitBeforeGst += l.profit;
          // Sardarji commission is ₹100 per ton on sold weight
          netProfitBeforeGst += l.profit - comm;
          sardarjiCommission += comm;
        }
        loadsSoldCount += 1;

        if (l.tons_bought && l.tons_received) {
          const diff = l.tons_bought - l.tons_received;
          if (diff > 0.005) {
            kantaShortageTons += diff;
            kantaShortageLoss += diff * (l.buy_rate ?? 0);
          }
        }
      }
    });

    return {
      salesBeforeGst,
      tonsSold,
      loadsSoldCount,
      grossProfitBeforeGst,
      netProfitBeforeGst,
      sardarjiCommission,
      moneyToReceiveTotal,
      moneyToReceiveOverdue,
      moneyToPaySuppliers,
      moneyToPayAgencies,
      kantaShortageTons,
      kantaShortageLoss,
    };
  }, [loads, currentMonthKey]);

  if (isLoading) {
    return (
      <div className="space-y-4 px-4 md:px-8 py-6 pb-28 md:pb-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8 pb-28 md:pb-12 max-w-7xl mx-auto">
        <QueryErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  // Brand-new empty database clean state
  if (loads.length === 0) {
    return (
      <div className="px-4 py-16 pb-28 md:pb-12 max-w-lg mx-auto text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
          <Package className="h-8 w-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-foreground">No loads recorded yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Welcome to Aarav Traders. Start tracking truck accounts by creating your first
            consignment.
          </p>
        </div>
        <button
          type="button"
          onClick={onNewLoadClick}
          style={{ background: "linear-gradient(135deg, #0b2545 0%, #0f766e 100%)" }}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold text-white shadow-md transition-transform active:scale-95 hover:brightness-105"
        >
          <Plus className="h-5 w-5" /> New Consignment
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 md:px-8 py-4 md:py-6 pb-28 md:pb-12 max-w-7xl mx-auto w-full">
      {/* Month Eyebrow */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 text-sm">
            {currentMonthName}
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="text-xs text-muted-foreground font-medium">Trading Performance</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 px-3 py-1 rounded-full border border-teal-200 dark:border-teal-800 text-xs shadow-2xs">
            <Scale className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            <span>
              Total Tons Sold:{" "}
              <strong className="text-teal-950 dark:text-teal-100 font-black">
                {formatTons(allTimeStats.totalTonsSold)}
              </strong>{" "}
              (All-Time)
            </span>
          </span>
        </div>
      </div>

      {/* Row 1: Top 4 Executive KPI Cards in Zoho Books / RazorpayX Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Gross Sales (Hero Card: Deep Navy with Teal Glow) */}
        <div
          style={{ background: "linear-gradient(135deg, #0B2545 0%, #134E4A 100%)" }}
          className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg border border-slate-700/40 flex flex-col justify-between space-y-3"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Gross Sales
                </span>
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-teal-200 border border-white/10 whitespace-nowrap">
                {currentMonthName}
              </span>
            </div>

            <div className="pt-1">
              <p className="text-2xl sm:text-3xl font-black tracking-tight text-white tabular-nums drop-shadow-2xs">
                {formatINR(currentMonthMetrics.salesBeforeGst)}
              </p>
              <div className="flex items-center gap-2 pt-1.5 text-xs text-slate-200 font-medium flex-wrap">
                <span className="inline-flex items-center gap-1 font-bold text-teal-300 tabular-nums">
                  <Truck className="h-3.5 w-3.5" /> {formatTons(currentMonthMetrics.tonsSold)}
                </span>
                <span className="text-slate-400">•</span>
                <span className="tabular-nums">
                  {currentMonthMetrics.loadsSoldCount} Loads Sold
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-teal-200 font-bold tabular-nums">
                  All-Time: {formatTons(allTimeStats.totalTonsSold)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Net Trading Profit (White card, after Sardarji Commission) */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Net Trading Profit
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="pt-1">
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatINR(currentMonthMetrics.netProfitBeforeGst)}
            </p>
            <div className="flex flex-col gap-0.5 pt-0.5 text-[11px]">
              <span className="text-muted-foreground font-medium">
                Gross: {formatINR(currentMonthMetrics.grossProfitBeforeGst)} · Comm: -{formatINR(currentMonthMetrics.sardarjiCommission)}
              </span>
              <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300">
                -₹100/bill Sardarji commission deducted
              </span>
            </div>
          </div>
        </div>

        {/* 3. Unsold Stock (White card, subtle blue indicator) */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Unsold Inventory
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="pt-1">
            <p className="text-2xl font-black text-foreground tabular-nums">
              {unsoldStock ? formatTons(unsoldStock.unsold_tons) : "0 t"}
            </p>
            <span className="text-[11px] font-semibold text-muted-foreground block pt-0.5">
              {unsoldStock && unsoldStock.unsold_loads > 0
                ? `${unsoldStock.unsold_loads} Loads in Stock`
                : "Zero unsold inventory"}
            </span>
          </div>
        </div>

        {/* 4. Weighbridge Shortage (White card, subtle amber indicator) */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-amber-600" />
              Weighbridge Shortage
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                currentMonthMetrics.kantaShortageTons > 0
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
              }`}
            >
              {currentMonthMetrics.kantaShortageTons > 0 ? "Shortage Loss" : "Exact Match"}
            </span>
          </div>
          <div className="pt-1">
            {currentMonthMetrics.kantaShortageTons > 0 ? (
              <>
                <p className="text-2xl font-black text-destructive tabular-nums">
                  -{formatINR(currentMonthMetrics.kantaShortageLoss)}
                </p>
                <span className="text-[11px] font-semibold text-muted-foreground block pt-0.5 tabular-nums">
                  Loss: {Math.round(currentMonthMetrics.kantaShortageTons * 1000)} kg (
                  {formatTons(currentMonthMetrics.kantaShortageTons)})
                </span>
              </>
            ) : (
              <>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  0 kg Diff
                </p>
                <span className="text-[11px] font-semibold text-emerald-700/80 dark:text-emerald-400/80 block pt-0.5">
                  100% Weight verification intact
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Dual Panel Dashboard (2/3 Loads, 1/3 Cash & Pending Balances) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1">
        {/* Main Column (8 cols = 2/3): Recent Consignments */}
        <div className="lg:col-span-8 space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Recent Consignments
              </h3>
              <p className="text-xs text-muted-foreground hidden md:block pt-0.5">
                Live dispatch & delivery tracking with weight and profit
              </p>
            </div>
            <button
              type="button"
              onClick={onViewAllLoads}
              className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1"
            >
              View all ({loads.length}) →
            </button>
          </div>

          <div className="space-y-3">
            {loads.slice(0, 6).map((l) => (
              <div
                key={l.id}
                onClick={() => onSelectLoad(l)}
                className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 flex items-center justify-between cursor-pointer transition-all hover:shadow-md hover:border-teal-500/40 active:scale-[0.99] touch-target shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  {/* Clean weight badge pill (No overflow) */}
                  <div
                    className={`flex items-center justify-center px-3 py-2 rounded-xl font-bold text-xs tabular-nums shadow-2xs ${
                      l.material === "coal"
                        ? "bg-slate-900 text-slate-100 dark:bg-slate-800 dark:text-slate-100 border border-slate-700"
                        : "bg-amber-600 text-white shadow-amber-600/20"
                    }`}
                  >
                    {formatTons(l.tons_bought)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                          l.material === "coal"
                            ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                        }`}
                      >
                        {l.material}
                      </span>
                      <p className="text-xs font-extrabold text-foreground tracking-wide">
                        {l.truck_number}
                      </p>
                      {l.buyer_name && (
                        <span className="hidden sm:inline-block text-xs text-muted-foreground font-medium">
                          ({l.supplier_name} → {l.buyer_name})
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground pt-0.5 font-medium tabular-nums">
                      {l.sale_date
                        ? `${formatTons(l.tons_received)} delivered${
                            l.shortage_tons && l.shortage_tons > 0.005
                              ? ` • ⚖️ -${Math.round(l.shortage_tons * 1000)}kg`
                              : ""
                          }`
                        : "📦 In Stock (Unsold)"}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  {l.profit !== null && (() => {
                    const tons = l.tons_received ?? l.tons_bought ?? 0;
                    const comm = Math.round(tons * 100 * 100) / 100;
                    const net = l.profit - comm;
                    return (
                      <>
                        <p
                          className={`text-sm font-black tabular-nums ${
                            net >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-destructive"
                          }`}
                        >
                          {net >= 0 ? `+${formatINR(net)}` : formatINR(net)}
                        </p>
                        <span className="text-[10px] text-muted-foreground font-medium block">
                          Net (-{formatINR(comm)} @ ₹100/t)
                        </span>
                      </>
                    );
                  })()}
                  {l.profit === null && (
                    <>
                      <p className="text-sm font-black tabular-nums text-muted-foreground">Unsold</p>
                      <span className="text-[10px] text-muted-foreground font-medium block">
                        {formatDate(l.load_date)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column (4 cols = 1/3): Cash & Pending Balances */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Cash & Pending Balances
            </h3>
          </div>

          <div className="space-y-3">
            {/* 1. To Receive from Buyers */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 flex items-center justify-between shadow-2xs hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300">
                  <ArrowDownLeft className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">Receivable from Buyers</p>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Customer pending khata
                  </span>
                  {currentMonthMetrics.moneyToReceiveOverdue > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-destructive tabular-nums">
                      <AlertCircle className="h-3 w-3" />
                      {formatINR(currentMonthMetrics.moneyToReceiveOverdue)} overdue
                    </span>
                  )}
                </div>
              </div>
              <span className="text-base font-black text-teal-700 dark:text-teal-400 tabular-nums">
                {formatINR(currentMonthMetrics.moneyToReceiveTotal)}
              </span>
            </div>

            {/* 2. To Pay Suppliers */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 flex items-center justify-between shadow-2xs hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">Payable to Suppliers</p>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Pending supplier bills
                  </span>
                </div>
              </div>
              <span className="text-base font-black text-rose-600 dark:text-rose-400 tabular-nums">
                {formatINR(currentMonthMetrics.moneyToPaySuppliers)}
              </span>
            </div>

            {/* 3. To Pay Transporters */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 flex items-center justify-between shadow-2xs hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">Payable to Transporters</p>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Pending freight dues
                  </span>
                </div>
              </div>
              <span className="text-base font-black text-blue-600 dark:text-blue-400 tabular-nums">
                {formatINR(currentMonthMetrics.moneyToPayAgencies)}
              </span>
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Quick Actions
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onNewLoadClick}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-card border border-border text-xs font-bold text-foreground hover:bg-card/80 transition-all shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5 text-teal-600" /> New Load
              </button>
              <button
                type="button"
                onClick={onViewAllLoads}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-card border border-border text-xs font-bold text-foreground hover:bg-card/80 transition-all shadow-2xs"
              >
                <Truck className="h-3.5 w-3.5 text-blue-600" /> View Trucks
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
