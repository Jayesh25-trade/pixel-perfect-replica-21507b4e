import { useState, useMemo } from "react";
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Download,
  Truck,
  Building2,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type EnrichedChallan } from "@/hooks/use-formomatic-challans";
import { generateAaravChallanPdf } from "@/utils/generateChallanPdf";
import { formatTons } from "@/lib/calculations";
import type { LoadDetail } from "@/hooks/use-load-accounts";

interface ChallansViewProps {
  challans: EnrichedChallan[];
  isLoading: boolean;
  error: unknown;
  onRefresh: () => void;
  onCreateLoadFromChallan: (challan: EnrichedChallan) => void;
  onSelectLoad?: ((load: LoadDetail) => void) | undefined;
}

export function ChallansView({
  challans,
  isLoading,
  error,
  onRefresh,
  onCreateLoadFromChallan,
  onSelectLoad,
}: ChallansViewProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "converted">("all");

  const filtered = useMemo(() => {
    return challans.filter((c) => {
      if (filter === "pending" && c.isConverted) return false;
      if (filter === "converted" && !c.isConverted) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (c.pc_no ?? "").toLowerCase().includes(q) ||
        (c.party_name ?? "").toLowerCase().includes(q) ||
        (c.truck_no ?? "").toLowerCase().includes(q)
      );
    });
  }, [challans, filter, search]);

  const pendingCount = challans.filter((c) => !c.isConverted).length;
  const convertedCount = challans.filter((c) => c.isConverted).length;

  return (
    <div className="space-y-5 px-4 md:px-8 py-4 md:py-6 pb-28 md:pb-12 max-w-7xl mx-auto w-full animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black tracking-tight text-foreground">
              Aarav Delivery Challans
            </h2>
            <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-bold border border-emerald-500/20">
              Only Aarav Traders
            </span>
          </div>
          <p className="text-xs text-muted-foreground pt-0.5">
            Synced live from Formomatic (Bills starting with AT/...)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="text-xs font-bold gap-1.5 rounded-xl border-slate-200/90 dark:border-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh Sync
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 text-center space-y-1 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
            Aarav Challans
          </span>
          <p className="text-lg sm:text-2xl font-black font-mono text-foreground">
            {challans.length}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 sm:p-4 text-center space-y-1 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-amber-900 dark:text-amber-300 block">
            Pending Load Entry
          </span>
          <p className="text-lg sm:text-2xl font-black font-mono text-amber-700 dark:text-amber-400">
            {pendingCount}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 sm:p-4 text-center space-y-1 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-emerald-900 dark:text-emerald-300 block">
            In Accounts
          </span>
          <p className="text-lg sm:text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
            {convertedCount}
          </p>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by challan no (e.g. AT/5), party, or truck number..."
            className="pl-9 min-h-11 rounded-xl text-sm font-semibold"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap shadow-xs ${
              filter === "all"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All Aarav Bills ({challans.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap shadow-xs ${
              filter === "pending"
                ? "bg-amber-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Pending Creation ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("converted")}
            className={`rounded-xl px-3 py-1.5 font-bold transition-all whitespace-nowrap shadow-xs ${
              filter === "converted"
                ? "bg-emerald-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Already in Accounts ({convertedCount})
          </button>
        </div>
      </div>

      {/* Error state */}
      {Boolean(error) && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-center space-y-2">
          <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
          <p className="text-xs font-semibold text-destructive">
            Failed to sync live challans from Formomatic database.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
            Retry Sync
          </Button>
        </div>
      )}

      {/* Challans List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-2 bg-muted/20">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold">No Aarav Traders challans found</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Only delivery challans with invoice number starting with <strong>AT/</strong> or for{" "}
            <strong>Aarav Traders</strong> are shown here. Parth Fuel Corporation bills are
            automatically excluded.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const isBriquette = String(c.material_type).toLowerCase().includes("briquette");

            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 space-y-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  {/* Top Bar: Challan No & Status */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-white bg-slate-900 dark:bg-slate-800 px-2.5 py-1 rounded-lg shadow-xs">
                      {c.pc_no || "AT/--"}
                    </span>

                    {c.isConverted ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 rounded-full shadow-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Already Created in
                        Accounts
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-500/15 border border-amber-500/25 px-2.5 py-0.5 rounded-full">
                        <Clock className="h-3 w-3" /> Ready for Load Entry
                      </span>
                    )}
                  </div>

                  {/* Already Created Alert Banner */}
                  {c.isConverted && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-200">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Note: Load Already Created</span>
                      </div>
                      {c.matchedLoad?.truck_number && (
                        <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          {c.matchedLoad.truck_number}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Customer / Buyer Name */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                      <Building2 className="h-3.5 w-3.5" /> Customer (Buyer)
                    </div>
                    <p className="text-sm font-extrabold text-foreground truncate">
                      {c.party_name || "Direct Customer / Factory"}
                    </p>
                  </div>

                  {/* Truck & Material & Tons */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-muted/40 p-2.5 rounded-xl">
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                        <Truck className="h-3 w-3" /> Truck
                      </span>
                      <strong className="text-foreground text-xs">
                        {c.truck_no || "Not stated"}
                      </strong>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-[10px]">Material</span>
                      <strong
                        className={`block text-xs uppercase ${
                          isBriquette ? "text-amber-600" : "text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {c.material_type || "Coal"}
                      </strong>
                    </div>

                    <div>
                      <span className="text-muted-foreground text-[10px]">Challan Weight</span>
                      <strong className="text-foreground text-xs">
                        {c.quantity ? `${c.quantity} t` : "0 t"}
                      </strong>
                    </div>

                    <div>
                      <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                        <Calendar className="h-3 w-3" /> Date
                      </span>
                      <strong className="text-foreground text-xs">{c.date || "---"}</strong>
                    </div>
                  </div>
                </div>

                {/* Actions Bottom Bar */}
                <div className="pt-2 border-t border-border/60 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => generateAaravChallanPdf(c)}
                    className="flex-1 min-h-10 text-xs font-bold gap-1 rounded-xl border-slate-200/90 dark:border-slate-800"
                  >
                    <Download className="h-3.5 w-3.5" /> PDF
                  </Button>

                  {c.isConverted && c.matchedLoad ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onSelectLoad && onSelectLoad(c.matchedLoad!)}
                      className="flex-1 min-h-10 text-xs font-bold gap-1 rounded-xl border-emerald-500/40 text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> View Created Load
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onCreateLoadFromChallan(c)}
                      style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}
                      className="flex-1 min-h-10 text-xs font-bold gap-1 rounded-xl text-white shadow-xs hover:brightness-105 active:scale-95"
                    >
                      <Plus className="h-3.5 w-3.5 stroke-[2.5]" /> Create Load
                    </Button>
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
