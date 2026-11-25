import { useState, useMemo } from "react";
import {
  Plus,
  Users,
  Phone,
  FileText,
  Search,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import type { Party, PartyBalance, LoadDetail, Payment } from "@/hooks/use-load-accounts";
import { formatINR } from "@/lib/calculations";
import { PartyStatementModal } from "@/components/parties/PartyStatementModal";
import { AddPartyDialog } from "@/components/parties/AddPartyDialog";
import type { PartyType } from "@/lib/calculations";

interface PartiesViewProps {
  parties: Party[];
  partyBalances: PartyBalance[];
  loads: LoadDetail[];
  payments?: Payment[] | undefined;
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  onAddParty: (party: {
    name: string;
    type: PartyType;
    phone?: string | undefined;
    credit_days?: number | undefined;
  }) => Promise<void>;
  onRecordPayment?:
    ((load: LoadDetail, kind?: "purchase" | "freight" | "sale") => void) | undefined;
  onDeletePayment?: ((paymentId: string) => Promise<void>) | undefined;
}

export function PartiesView({
  parties,
  partyBalances,
  loads,
  payments = [],
  isLoading,
  error,
  onRetry,
  onAddParty,
  onRecordPayment,
  onDeletePayment,
}: PartiesViewProps) {
  const [selectedType, setSelectedType] = useState<PartyType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [statementParty, setStatementParty] = useState<{
    name: string;
    type: PartyType;
    phone?: string | null | undefined;
    credit_days?: number | null | undefined;
  } | null>(null);

  // Merge parties with balance information
  const mergedParties = useMemo(() => {
    return parties.map((p) => {
      const bal = partyBalances.find((b) => b.party_id === p.id);
      return {
        ...p,
        total_billed: bal?.total_billed ?? 0,
        total_paid: bal?.total_paid ?? 0,
        pending_balance: bal?.pending_balance ?? 0,
      };
    });
  }, [parties, partyBalances]);

  // Overall financial summary
  const summary = useMemo(() => {
    let totalPayable = 0; // Suppliers + Agencies (Cr)
    let totalReceivable = 0; // Buyers (Dr)

    mergedParties.forEach((p) => {
      if (p.type === "supplier" || p.type === "agency") {
        totalPayable += p.pending_balance;
      } else if (p.type === "buyer") {
        totalReceivable += p.pending_balance;
      }
    });

    return { totalPayable, totalReceivable };
  }, [mergedParties]);

  // Filtered & searched parties
  const filteredParties = useMemo(() => {
    return mergedParties.filter((p) => {
      if (selectedType !== "all" && p.type !== selectedType) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesPhone = p.phone ? p.phone.toLowerCase().includes(q) : false;
        return matchesName || matchesPhone;
      }
      return true;
    });
  }, [mergedParties, selectedType, searchQuery]);

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
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 md:px-8 py-4 md:py-6 pb-28 md:pb-12 max-w-7xl mx-auto w-full animate-in fade-in duration-150">
      {/* Top Header & Add Party */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold tracking-tight">Party Ledger Accounts</h2>
          <p className="text-xs text-muted-foreground font-medium">Balances & Payment Khatas</p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setAddPartyOpen(true)}
          className="min-h-10 text-xs font-bold gap-1 rounded-xl shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add Party
        </Button>
      </div>

      {/* Total Payables & Receivables Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-white to-rose-50/50 dark:from-slate-900 dark:to-rose-950/20 p-4 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-rose-700 dark:text-rose-400">
              TOTAL PAYABLE (CR)
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <ArrowDownLeft className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-lg font-black font-mono text-rose-600 dark:text-rose-400">
            {formatINR(summary.totalPayable)}
          </p>
          <span className="text-[10px] text-muted-foreground block font-medium">
            To Suppliers & Agencies
          </span>
        </div>

        <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-900 dark:to-emerald-950/20 p-4 space-y-1.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400">
              TOTAL RECEIVABLE (DR)
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
            {formatINR(summary.totalReceivable)}
          </p>
          <span className="text-[10px] text-muted-foreground block font-medium">
            From Buyers & Customers
          </span>
        </div>
      </div>

      {/* Real-time Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search party by name or mobile number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10 min-h-12 rounded-2xl text-xs sm:text-sm bg-card border-slate-200/80 dark:border-slate-800 shadow-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs custom-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedType("all")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all text-xs whitespace-nowrap shadow-xs ${
            selectedType === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          All Parties ({parties.length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedType("supplier")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all text-xs whitespace-nowrap shadow-xs ${
            selectedType === "supplier"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Suppliers
        </button>
        <button
          type="button"
          onClick={() => setSelectedType("agency")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all text-xs whitespace-nowrap shadow-xs ${
            selectedType === "agency"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Transport Agencies
        </button>
        <button
          type="button"
          onClick={() => setSelectedType("buyer")}
          className={`rounded-full px-3.5 py-1.5 font-bold transition-all text-xs whitespace-nowrap shadow-xs ${
            selectedType === "buyer"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Buyers
        </button>
      </div>

      {/* Parties List */}
      {filteredParties.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-3 bg-muted/20">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-semibold">No parties found.</p>
          <p className="text-xs text-muted-foreground">
            {searchQuery
              ? "No party matches your search query. Try clearing the search."
              : "Add your coal suppliers, truck agencies, and buyers to track ledgers."}
          </p>
          {searchQuery ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setAddPartyOpen(true)}
              className="min-h-11 rounded-xl"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Party Now
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {filteredParties.map((p) => {
            const isPayable = p.type === "supplier" || p.type === "agency";
            const balanceSuffix = p.pending_balance > 0 ? (isPayable ? "Cr" : "Dr") : "Nil";

            return (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 space-y-3 shadow-xs transition-all hover:shadow-md hover:border-primary/40 active:scale-[0.99]"
              >
                {/* Party Details & Pending Balance */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-sm font-black text-foreground">{p.name}</strong>
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {p.type}
                      </span>
                    </div>

                    {p.phone && (
                      <a
                        href={`tel:${p.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-primary hover:underline flex items-center gap-1 font-mono font-semibold"
                      >
                        <Phone className="h-3 w-3" /> {p.phone}
                      </a>
                    )}
                  </div>

                  {/* High Visibility Outstanding Balance Badge */}
                  <div className="text-right space-y-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                      {isPayable ? "Payable (Cr)" : "Receivable (Dr)"}
                    </span>
                    <span
                      className={`text-base font-black font-mono block ${
                        p.pending_balance > 0
                          ? isPayable
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatINR(p.pending_balance)}{" "}
                      <span className="text-[11px] font-bold">({balanceSuffix})</span>
                    </span>
                  </div>
                </div>

                {/* Billed vs Paid Progress / Summary Bar */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/70 pt-2 font-mono font-medium">
                  <span>
                    Total Billed:{" "}
                    <strong className="text-foreground">{formatINR(p.total_billed)}</strong>
                  </span>
                  <span>
                    Paid:{" "}
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {formatINR(p.total_paid)}
                    </strong>
                  </span>
                </div>

                {/* Tally Ledger & Quick Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setStatementParty({
                        name: p.name,
                        type: p.type,
                        phone: p.phone,
                        credit_days: p.credit_days,
                      })
                    }
                    className="flex-1 min-h-10 text-xs font-bold gap-1.5 rounded-xl border-slate-200/90 dark:border-slate-800 hover:bg-muted"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary" /> View Tally Ledger
                  </Button>

                  {p.pending_balance > 0 && onRecordPayment && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const targetKind =
                          p.type === "supplier"
                            ? "purchase"
                            : p.type === "agency"
                              ? "freight"
                              : "sale";

                        // Find first unsettled load for this party
                        const unsettled = loads.find((l) => {
                          if (p.type === "supplier")
                            return l.supplier_name === p.name && l.purchase_pending > 0;
                          if (p.type === "agency")
                            return l.agency_name === p.name && l.freight_pending > 0;
                          if (p.type === "buyer")
                            return l.buyer_name === p.name && (l.sale_pending ?? 0) > 0;
                          return false;
                        });
                        if (unsettled) {
                          onRecordPayment(unsettled, targetKind);
                        } else {
                          // Open statement if no single load pending
                          setStatementParty({
                            name: p.name,
                            type: p.type,
                            phone: p.phone,
                            credit_days: p.credit_days,
                          });
                        }
                      }}
                      className={`min-h-9 px-3 text-xs font-bold gap-1 rounded-lg text-white shadow-sm ${
                        p.type === "buyer"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-destructive hover:bg-destructive/90"
                      }`}
                    >
                      {p.type === "buyer" ? (
                        <>
                          <ArrowDownLeft className="h-3.5 w-3.5" /> Receive Payment
                        </>
                      ) : p.type === "agency" ? (
                        <>
                          <CreditCard className="h-3.5 w-3.5" /> Pay Transporter
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-3.5 w-3.5" /> Pay Supplier
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tally Statement & Khata Modal */}
      {statementParty && (
        <PartyStatementModal
          open={!!statementParty}
          onOpenChange={(open) => !open && setStatementParty(null)}
          partyName={statementParty.name}
          partyType={statementParty.type}
          partyPhone={statementParty.phone}
          partyCreditDays={statementParty.credit_days}
          loads={loads}
          payments={payments}
          onRecordPayment={onRecordPayment}
          onDeletePayment={onDeletePayment}
        />
      )}

      {/* Add Party Dialog */}
      <AddPartyDialog
        open={addPartyOpen}
        onOpenChange={setAddPartyOpen}
        onPartyCreated={onAddParty}
      />
    </div>
  );
}
