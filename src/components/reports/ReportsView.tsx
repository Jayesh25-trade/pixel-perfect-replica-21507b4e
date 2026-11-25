import { useState, useMemo } from "react";
import { Download, Calendar, BarChart2, Package, FileSpreadsheet, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import type { MonthlyReport, UnsoldStock, LoadDetail } from "@/hooks/use-load-accounts";
import { formatINR, formatTons } from "@/lib/calculations";
import { exportLoadsToExcel, exportLoadsToPdf } from "@/utils/exportCaReports";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface ReportsViewProps {
  monthlyReports: MonthlyReport[];
  unsoldStock: UnsoldStock | null | undefined;
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  loads?: LoadDetail[] | undefined;
}

export function ReportsView({
  monthlyReports,
  unsoldStock,
  isLoading,
  error,
  onRetry,
  loads = [],
}: ReportsViewProps) {
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    monthlyReports.forEach((r) => {
      const year = r.sale_month.split("-")[0];
      if (year) years.add(year);
    });
    return Array.from(years);
  }, [monthlyReports]);

  const filteredReports = useMemo(() => {
    if (selectedYear === "all") return monthlyReports;
    return monthlyReports.filter((r) => r.sale_month.startsWith(selectedYear));
  }, [monthlyReports, selectedYear]);

  // Aggregate stats across filtered months
  const totals = useMemo(() => {
    let loadsCount = 0;
    let tonsBought = 0;
    let tonsSold = 0;
    let shortageTons = 0;
    let purchaseAmount = 0;
    let freightAmount = 0;
    let saleAmount = 0;
    let profit = 0;
    let gstPaid = 0;
    let gstCollected = 0;
    let netGst = 0;

    filteredReports.forEach((r) => {
      loadsCount += r.loads_count;
      tonsBought += r.tons_bought;
      tonsSold += r.tons_sold;
      shortageTons += r.shortage_tons;
      purchaseAmount += r.purchase_amount;
      freightAmount += r.freight_amount;
      saleAmount += r.sale_amount;
      profit += r.profit;
      gstPaid += r.gst_paid;
      gstCollected += r.gst_collected;
      netGst += r.net_gst;
    });

    return {
      loadsCount,
      tonsBought,
      tonsSold,
      shortageTons,
      purchaseAmount,
      freightAmount,
      saleAmount,
      profit,
      gstPaid,
      gstCollected,
      netGst,
    };
  }, [filteredReports]);

  // Chart data reversed for chronological left-to-right display
  const chartData = useMemo(() => {
    return [...filteredReports].reverse().map((r) => ({
      month: r.sale_month,
      profit: r.profit,
      sales: r.sale_amount,
    }));
  }, [filteredReports]);

  // Export handlers
  const handleExportFullExcel = () => {
    const targetLoads =
      selectedYear === "all"
        ? loads
        : loads.filter(
            (l) => l.load_date?.startsWith(selectedYear) || l.sale_date?.startsWith(selectedYear),
          );
    exportLoadsToExcel(
      targetLoads,
      selectedYear === "all" ? "Complete CA Register" : `Year ${selectedYear} Register`,
    );
  };

  const handleExportFullPdf = async () => {
    const targetLoads =
      selectedYear === "all"
        ? loads
        : loads.filter(
            (l) => l.load_date?.startsWith(selectedYear) || l.sale_date?.startsWith(selectedYear),
          );
    await exportLoadsToPdf(
      targetLoads,
      selectedYear === "all" ? "Complete CA Register" : `Year ${selectedYear} Register`,
    );
  };

  const handleExportMonthExcel = (month: string) => {
    const targetLoads = loads.filter(
      (l) => l.load_date?.startsWith(month) || l.sale_date?.startsWith(month),
    );
    exportLoadsToExcel(targetLoads, `Month ${month}`);
  };

  const handleExportMonthPdf = async (month: string) => {
    const targetLoads = loads.filter(
      (l) => l.load_date?.startsWith(month) || l.sale_date?.startsWith(month),
    );
    await exportLoadsToPdf(targetLoads, `Month ${month}`);
  };

  if (error) {
    return (
      <div className="px-4 py-8 pb-28 max-w-lg mx-auto">
        <QueryErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3 px-4 py-4 pb-28 max-w-lg mx-auto">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 md:px-8 py-4 md:py-6 pb-28 md:pb-12 max-w-7xl mx-auto w-full">
      {/* Header & Export Hub */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight text-foreground">
            Monthly Reports & Accounts
          </h2>
          <p className="text-xs text-muted-foreground pt-0.5">
            Aggregated by Sale Month · Complete Audit & GST Details
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportFullExcel}
            className="min-h-10 text-xs font-bold gap-1.5 rounded-xl border-slate-200/90 dark:border-slate-800"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export Excel (CA)
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleExportFullPdf}
            style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}
            className="min-h-10 text-xs font-bold gap-1.5 rounded-xl text-white shadow-xs hover:brightness-105 active:scale-95"
          >
            <FileDown className="h-4 w-4" /> Download PDF (CA)
          </Button>
        </div>
      </div>

      {/* Year Filter */}
      {availableYears.length > 1 && (
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setSelectedYear("all")}
            className={`rounded-full px-3 py-1 font-semibold ${
              selectedYear === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            All Years
          </button>
          {availableYears.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setSelectedYear(y)}
              className={`rounded-full px-3 py-1 font-semibold ${
                selectedYear === y
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {/* Total Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-900 dark:to-emerald-950/20 p-4 space-y-1.5 shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Total Profit
          </span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatINR(totals.profit)}
          </p>
          <span className="text-[10px] text-muted-foreground block font-medium">
            {totals.loadsCount} loads · {formatTons(totals.tonsSold)} sold
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 space-y-1.5 shadow-xs">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Net GST Position
          </span>
          <p className="text-xl font-black text-foreground font-mono">{formatINR(totals.netGst)}</p>
          <span className="text-[10px] text-muted-foreground block font-medium">
            Collected {formatINR(totals.gstCollected)} - Paid {formatINR(totals.gstPaid)}
          </span>
        </div>
      </div>

      {/* Unsold Stock Summary Card */}
      <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-slate-900 dark:to-blue-950/20 p-4 flex items-center justify-between shadow-xs">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            Unsold Inventory Stock
          </span>
          <p className="text-sm font-black text-foreground">
            {formatTons(unsoldStock?.unsold_tons ?? 0)} ({unsoldStock?.unsold_loads ?? 0} loads
            pending sale)
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Cost Basis</span>
          <p className="text-sm font-black text-foreground font-mono">
            {formatINR(unsoldStock?.total_unsold_cost_basis ?? 0)}
          </p>
        </div>
      </div>

      {/* Kanta Shortage Overview */}
      {totals.shortageTons > 0 && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-800/60 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/15 p-4 flex items-center justify-between text-xs shadow-xs">
          <div className="space-y-0.5">
            <span className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              ⚖️ Total Weighbridge Shortage
            </span>
            <span className="text-[11px] text-muted-foreground block font-mono font-medium">
              Loading vs delivery shortage: {formatTons(totals.shortageTons)} (
              {Math.round(totals.shortageTons * 1000)} kg)
            </span>
          </div>
          <div className="text-right">
            <span className="text-sm font-black text-destructive font-mono">
              {formatTons(totals.shortageTons)}
            </span>
            <span className="block text-[10px] text-muted-foreground font-semibold">
              Transit Loss
            </span>
          </div>
        </div>
      )}

      {/* Monthly Chart */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 space-y-2.5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <BarChart2 className="h-3.5 w-3.5 text-primary" /> Monthly Profit Trend
          </span>
          <div className="h-48 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(val: unknown) => [formatINR(Number(val) || 0), "Profit"]}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    borderColor: "var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="profit" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Wide Monthly Table with Horizontal Scroll Area */}
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Monthly Ledger Table
        </span>

        {filteredReports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            No sales recorded yet. Once a load is marked sold, monthly metrics will aggregate here.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/50 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 whitespace-nowrap">Month</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Loads</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Tons Bought</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Tons Sold</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Shortage</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Purchase</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Freight</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Sale</th>
                  <th className="px-3 py-2.5 whitespace-nowrap font-bold text-foreground">
                    Profit
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap">GST Paid</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">GST Coll.</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Net GST</th>
                  <th className="px-3 py-2.5 whitespace-nowrap text-right">CA Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReports.map((r) => (
                  <tr key={r.sale_month} className="hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-bold whitespace-nowrap">{r.sale_month}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.loads_count}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatTons(r.tons_bought)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatTons(r.tons_sold)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-amber-600 font-semibold">
                      {formatTons(r.shortage_tons)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {formatINR(r.purchase_amount)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatINR(r.freight_amount)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatINR(r.sale_amount)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400">
                      {formatINR(r.profit)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatINR(r.gst_paid)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{formatINR(r.gst_collected)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-semibold">
                      {formatINR(r.net_gst)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleExportMonthExcel(r.sale_month)}
                          className="h-7 px-2 text-[11px] font-bold gap-1 rounded-lg border-slate-200 dark:border-slate-800"
                        >
                          <FileSpreadsheet className="h-3 w-3 text-emerald-600" /> Excel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => handleExportMonthPdf(r.sale_month)}
                          className="h-7 px-2 text-[11px] font-bold gap-1 rounded-lg"
                        >
                          <FileDown className="h-3 w-3 text-primary" /> PDF
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
