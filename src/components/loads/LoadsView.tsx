import { useState, useMemo } from "react";
import { Search, Plus, Filter, AlertCircle, FileText, FileCheck2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import type { LoadDetail } from "@/hooks/use-load-accounts";
import { formatINR, formatTons, formatDate } from "@/lib/calculations";
import { type EnrichedChallan, findMatchingChallan } from "@/hooks/use-formomatic-challans";

interface LoadsViewProps {
  loads: LoadDetail[];
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  onSelectLoad: (load: LoadDetail) => void;
  onNewLoadClick: () => void;
  onViewChallansClick?: () => void;
  pendingChallansCount?: number | undefined;
  challans?: EnrichedChallan[] | undefined;
}

type MaterialFilter = "all" | "coal" | "briquette";
type StatusFilter = "all" | "sold" | "unsold";

export function LoadsView({
  loads,
  isLoading,
  error,
  onRetry,
  onSelectLoad,
  onNewLoadClick,
  onViewChallansClick,
  pendingChallansCount,
  challans = [],
}: LoadsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [materialFilter, setMaterialFilter] = useState<MaterialFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const allTimeLoadsStats = useMemo(() => {
    let totalTonsSold = 0;
    let totalLoadsSold = 0;
    let totalNetProfit = 0;

    loads.forEach((l) => {
      if (l.sale_date) {
        totalTonsSold += l.tons_received ?? l.tons_bought ?? 0;
        totalLoadsSold += 1;
        if (l.profit !== null) {
          totalNetProfit += l.profit - 100; // Deduct ₹100 Sardarji commission
        }
      }
    });

    return { totalTonsSold, totalLoadsSold, totalNetProfit };
  }, [loads]);

  const filteredLoads = useMemo(() => {
    return loads.filter((l) => {
      // Search matching truck, supplier, agency, or buyer
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        query === "" ||
        l.truck_number.toLowerCase().includes(query) ||
        (l.supplier_name && l.supplier_name.toLowerCase().includes(query)) ||
        (l.agency_name && l.agency_name.toLowerCase().includes(query)) ||
        (l.buyer_name && l.buyer_name.toLowerCase().includes(query));

      // Material matching
      const matchesMaterial = materialFilter === "all" || l.material === materialFilter;

      // Status matching
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "sold" && l.sale_date !== null) ||
        (statusFilter === "unsold" && l.sale_date === null);

      return matchesSearch && matchesMaterial && matchesStatus;
    });
  }, [loads, searchTerm, materialFilter, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-4 px-4 md:px-8 py-6 pb-28 md:pb-12 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row gap-3">
          <Skeleton className="h-12 w-full md:w-80 rounded-2xl" />
          <Skeleton className="h-12 flex-1 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
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

  return (
    <div className="space-y-5 px-4 md:px-8 py-4 md:py-6 pb-28 md:pb-12 max-w-7xl mx-auto w-full">
      {/* Formomatic Sync Banner if pending Aarav challans exist */}
      {pendingChallansCount !== undefined && pendingChallansCount > 0 && onViewChallansClick && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 sm:p-4 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="font-extrabold text-foreground text-sm">
                {pendingChallansCount} Aarav Delivery Challan{pendingChallansCount > 1 ? "s" : ""}{" "}
                Available from Formomatic
              </p>
              <span className="text-[11px] text-muted-foreground">
                Only Aarav Traders bills. 1-click to create full consignment with customer & truck
                pre-filled.
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={onViewChallansClick}
            className="text-xs font-bold gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs self-start sm:self-auto"
          >
            View Challans →
          </Button>
        </div>
      )}

      {/* All-Time Volume & Profit Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
            Total Tons Sold (All-Time)
          </span>
          <p className="text-xl font-black text-teal-700 dark:text-teal-300 tabular-nums mt-0.5">
            {formatTons(allTimeLoadsStats.totalTonsSold)}
          </p>
          <span className="text-[10px] text-muted-foreground font-medium">
            Across {allTimeLoadsStats.totalLoadsSold} completed loads
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
            Total Net Trading Profit
          </span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
            {formatINR(allTimeLoadsStats.totalNetProfit)}
          </p>
          <span className="text-[10px] text-muted-foreground font-medium">
            After -₹100/bill Sardarji commission
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 shadow-2xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
            Consignments Status
          </span>
          <p className="text-xl font-black text-foreground tabular-nums mt-0.5">
            {loads.length} Loads Total
          </p>
          <span className="text-[10px] text-muted-foreground font-medium">
            {loads.length - allTimeLoadsStats.totalLoadsSold} in unsold stock
          </span>
        </div>
      </div>

      {/* Top Controls: Search Bar & Filter Chips */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-card p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        {/* Search Bar */}
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search truck, supplier, buyer, agency..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 min-h-11 text-xs sm:text-sm rounded-xl bg-background border-border/80 shadow-xs"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 text-xs custom-scrollbar items-center">
          <button
            type="button"
            onClick={() => setMaterialFilter("all")}
            className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap shadow-xs ${
              materialFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All Material
          </button>
          <button
            type="button"
            onClick={() => setMaterialFilter("coal")}
            className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap shadow-xs ${
              materialFilter === "coal"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Coal
          </button>
          <button
            type="button"
            onClick={() => setMaterialFilter("briquette")}
            className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap shadow-xs ${
              materialFilter === "briquette"
                ? "bg-amber-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Briquette
          </button>

          <span className="border-r border-border/80 h-5 mx-1 hidden sm:block" />

          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap shadow-xs ${
              statusFilter === "all"
                ? "bg-secondary text-secondary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All Status
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("unsold")}
            className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap shadow-xs ${
              statusFilter === "unsold"
                ? "bg-primary text-primary-foreground font-black"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            📦 Unsold Stock
          </button>
        </div>
      </div>

      {/* Loads List: Responsive 3-Column Grid on Desktop */}
      {filteredLoads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-muted/20">
          <p className="text-base font-semibold">No matching loads found.</p>
          <p className="text-xs text-muted-foreground">
            Try adjusting your filters or search term.
          </p>
          <button
            type="button"
            onClick={onNewLoadClick}
            style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-5 text-xs font-bold text-white shadow-sm"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" /> Add New Load
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {filteredLoads.map((l) => {
            const matchedChallan = findMatchingChallan(l, challans);

            return (
              <div
                key={l.id}
                onClick={() => onSelectLoad(l)}
                className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 space-y-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/40 active:scale-[0.99] touch-target shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        l.material === "coal"
                          ? "bg-slate-900 text-slate-100 dark:bg-slate-100 dark:text-slate-900"
                          : "bg-amber-600 text-white"
                      }`}
                    >
                      {l.material.toUpperCase()}
                    </span>
                    <strong className="text-sm font-black font-mono tracking-wide text-foreground">
                      {l.truck_number}
                    </strong>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-sm font-black tabular-nums ${
                        l.profit !== null
                          ? l.profit - 100 >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {l.profit !== null
                        ? l.profit - 100 >= 0
                          ? `+${formatINR(l.profit - 100)}`
                          : formatINR(l.profit - 100)
                        : "Unsold"}
                    </span>
                    {l.profit !== null && (
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        Net (-₹100 comm.)
                      </span>
                    )}
                  </div>
                </div>

                {/* Note: Created from Delivery Challan */}
                {matchedChallan && (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-xl">
                    <FileCheck2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Created from Challan: <strong>{matchedChallan.pc_no || "AT Challan"}</strong>{" "}
                      ({matchedChallan.party_name})
                    </span>
                  </div>
                )}

                {/* Load details summary */}
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/70 pt-2 font-medium">
                  <div>
                    <span className="text-foreground font-semibold">{l.supplier_name}</span>
                    {l.buyer_name && (
                      <span className="text-primary font-bold"> → {l.buyer_name}</span>
                    )}
                  </div>
                  <div className="font-mono text-[11px]">
                    <span>{formatDate(l.load_date)}</span>
                    <span> · {formatTons(l.tons_bought)}</span>
                  </div>
                </div>

                {/* Status & Kanta Shortage / Overdue alerts */}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40 flex-wrap gap-1.5">
                  {l.sale_date ? (
                    (() => {
                      const diff = (l.tons_bought ?? 0) - (l.tons_received ?? 0);
                      const diffKg = Math.round(Math.abs(diff) * 1000);
                      const lossAmount = Math.round(diff * (l.buy_rate ?? 0));

                      if (diff > 0.005) {
                        return (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-900 dark:text-amber-300 bg-amber-500/15 border border-amber-500/25 px-2.5 py-0.5 rounded-lg font-mono text-[11px]">
                            ⚖️ Weight Shortage: -{diffKg} kg (-{formatINR(lossAmount)})
                          </span>
                        );
                      } else if (diff < -0.005) {
                        return (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 rounded-lg font-mono text-[11px]">
                            ⚖️ Weight Gain: +{diffKg} kg Gain
                          </span>
                        );
                      } else {
                        return (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg font-mono text-[11px]">
                            ⚖️ Exact Weight: 0 kg Diff
                          </span>
                        );
                      }
                    })()
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-lg text-[11px]">
                      📦 In Transit / Stock
                    </span>
                  )}

                  {l.is_overdue && (
                    <span className="inline-flex items-center gap-1 font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-lg">
                      <AlertCircle className="h-3 w-3" /> Overdue
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
