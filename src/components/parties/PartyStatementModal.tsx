import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Share2,
  Printer,
  PlusCircle,
  Phone,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Clock,
  Trash2,
  FileDown,
  FileSpreadsheet,
} from "lucide-react";
import type { LoadDetail, Payment } from "@/hooks/use-load-accounts";
import { formatINR, formatTons, formatDate } from "@/lib/calculations";
import { generatePartyLedgerPdf } from "@/utils/generatePartyLedgerPdf";

export interface LedgerEntry {
  id: string;
  date: string;
  voucherType: "Purchase Bill" | "Freight Bill" | "Sale Invoice" | "Payment (Out)" | "Receipt (In)";
  particulars: string;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
  balanceType: "Dr" | "Cr" | "Nil";
  load?: LoadDetail | undefined;
  paymentId?: string | undefined;
}

interface PartyStatementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partyName: string;
  partyType: "supplier" | "agency" | "buyer";
  partyPhone?: string | null | undefined;
  partyCreditDays?: number | null | undefined;
  loads: LoadDetail[];
  payments?: Payment[] | undefined;
  onRecordPayment?:
    ((load: LoadDetail, kind?: "purchase" | "freight" | "sale") => void) | undefined;
  onDeletePayment?: ((paymentId: string) => Promise<void>) | undefined;
}

export function PartyStatementModal({
  open,
  onOpenChange,
  partyName,
  partyType,
  partyPhone,
  partyCreditDays,
  loads,
  payments = [],
  onRecordPayment,
  onDeletePayment,
}: PartyStatementModalProps) {
  const [filter, setFilter] = useState<"all" | "bills" | "payments" | "pending">("all");

  // 1. Filter loads involving this party
  const partyLoads = useMemo(() => {
    return loads.filter((l) => {
      if (partyType === "supplier") return l.supplier_name === partyName;
      if (partyType === "agency") return l.agency_name === partyName;
      if (partyType === "buyer") return l.buyer_name === partyName;
      return false;
    });
  }, [loads, partyName, partyType]);

  // Load IDs for matching payments
  const partyLoadIds = useMemo(() => new Set(partyLoads.map((l) => l.id)), [partyLoads]);

  // 2. Filter payments belonging to this party or these loads
  const partyPayments = useMemo(() => {
    return payments.filter((p) => {
      if (partyLoadIds.has(p.load_id)) {
        if (partyType === "supplier" && p.kind === "purchase") return true;
        if (partyType === "agency" && p.kind === "freight") return true;
        if (partyType === "buyer" && p.kind === "sale") return true;
      }
      return false;
    });
  }, [payments, partyLoadIds, partyType]);

  // 3. Build Chronological Tally Ledger Entries
  const { ledgerEntries, totalDebit, totalCredit, closingBalance, closingType } = useMemo(() => {
    const rawEntries: Array<{
      id: string;
      date: string;
      voucherType: LedgerEntry["voucherType"];
      particulars: string;
      reference: string;
      debit: number;
      credit: number;
      load?: LoadDetail | undefined;
      paymentId?: string | undefined;
    }> = [];

    // Add Invoices / Bills
    partyLoads.forEach((l) => {
      if (partyType === "supplier") {
        // Purchase Bill is Credit (Cr) for Supplier
        rawEntries.push({
          id: `load-bill-${l.id}`,
          date: l.load_date,
          voucherType: "Purchase Bill",
          particulars: `By Purchase A/c (${l.truck_number} · ${formatTons(l.tons_bought)} ${l.material} @ ${formatINR(l.buy_rate)}/t + ${l.gst_rate}% GST ₹${formatINR(l.purchase_gst)})`,
          reference: l.truck_number,
          debit: 0,
          credit: l.purchase_total,
          load: l,
        });
      } else if (partyType === "agency") {
        // Freight Bill is Credit (Cr) for Transporter
        rawEntries.push({
          id: `load-bill-${l.id}`,
          date: l.load_date,
          voucherType: "Freight Bill",
          particulars: `By Freight A/c (${l.truck_number} · ${formatTons(l.tons_loaded)} @ ${formatINR(l.freight_rate)}/t · 0% GST Exempt)`,
          reference: l.truck_number,
          debit: 0,
          credit: l.freight_amount,
          load: l,
        });
      } else if (partyType === "buyer") {
        // Sale Invoice is Debit (Dr) for Buyer
        const saleTotal = l.sale_total ?? 0;
        const saleDate = l.sale_date || l.load_date;
        rawEntries.push({
          id: `load-bill-${l.id}`,
          date: saleDate,
          voucherType: "Sale Invoice",
          particulars: `To Sales A/c (${l.truck_number} · ${formatTons(l.tons_received ?? l.tons_bought)} ${l.material} @ ${formatINR(l.sale_rate ?? 0)}/t + ${l.gst_rate}% GST ₹${formatINR(l.sale_gst ?? 0)})`,
          reference: l.truck_number,
          debit: saleTotal,
          credit: 0,
          load: l,
        });
      }
    });

    // Add Payments
    partyPayments.forEach((p) => {
      const matchLoad = partyLoads.find((l) => l.id === p.load_id);
      const truckRef = matchLoad ? ` (${matchLoad.truck_number})` : "";
      if (partyType === "supplier" || partyType === "agency") {
        // Payment made to supplier/agency is Debit (Dr) reducing payable
        rawEntries.push({
          id: `payment-${p.id}`,
          paymentId: p.id,
          date: p.payment_date,
          voucherType: "Payment (Out)",
          particulars: `To Bank A/c (Paid via ${p.mode}${p.reference ? ` Ref: ${p.reference}` : ""}${truckRef})`,
          reference: p.reference || p.mode,
          debit: Number(p.amount),
          credit: 0,
        });
      } else if (partyType === "buyer") {
        // Receipt from buyer is Credit (Cr) reducing receivable
        rawEntries.push({
          id: `payment-${p.id}`,
          paymentId: p.id,
          date: p.payment_date,
          voucherType: "Receipt (In)",
          particulars: `By Bank A/c (Received via ${p.mode}${p.reference ? ` Ref: ${p.reference}` : ""}${truckRef})`,
          reference: p.reference || p.mode,
          debit: 0,
          credit: Number(p.amount),
        });
      }
    });

    // Sort chronologically ascending
    rawEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate Tally Running Balance
    let running = 0;
    let sumDebit = 0;
    let sumCredit = 0;

    const computedEntries: LedgerEntry[] = rawEntries.map((entry) => {
      sumDebit += entry.debit;
      sumCredit += entry.credit;

      if (partyType === "supplier" || partyType === "agency") {
        // Creditor rule: Credit increases payable, Debit decreases payable
        running += entry.credit - entry.debit;
        const balType: "Dr" | "Cr" | "Nil" = running > 0.01 ? "Cr" : running < -0.01 ? "Dr" : "Nil";
        return {
          ...entry,
          runningBalance: Math.abs(running),
          balanceType: balType,
        };
      } else {
        // Debtor rule: Debit increases receivable, Credit decreases receivable
        running += entry.debit - entry.credit;
        const balType: "Dr" | "Cr" | "Nil" = running > 0.01 ? "Dr" : running < -0.01 ? "Cr" : "Nil";
        return {
          ...entry,
          runningBalance: Math.abs(running),
          balanceType: balType,
        };
      }
    });

    const finalBalance = Math.abs(running);
    let finalType: "Dr" | "Cr" | "Nil" = "Nil";
    if (partyType === "supplier" || partyType === "agency") {
      finalType = running > 0.01 ? "Cr" : running < -0.01 ? "Dr" : "Nil";
    } else {
      finalType = running > 0.01 ? "Dr" : running < -0.01 ? "Cr" : "Nil";
    }

    return {
      ledgerEntries: computedEntries,
      totalDebit: sumDebit,
      totalCredit: sumCredit,
      closingBalance: finalBalance,
      closingType: finalType,
    };
  }, [partyLoads, partyPayments, partyType]);

  // 4. Filter entries for display
  const displayedEntries = useMemo(() => {
    if (filter === "bills") {
      return ledgerEntries.filter(
        (e) => e.voucherType.includes("Bill") || e.voucherType.includes("Invoice"),
      );
    }
    if (filter === "payments") {
      return ledgerEntries.filter(
        (e) => e.voucherType.includes("Payment") || e.voucherType.includes("Receipt"),
      );
    }
    if (filter === "pending") {
      return ledgerEntries.filter((e) => {
        if (!e.load) return false;
        if (partyType === "supplier") return e.load.purchase_pending > 0;
        if (partyType === "agency") return e.load.freight_pending > 0;
        if (partyType === "buyer") return (e.load.sale_pending ?? 0) > 0;
        return false;
      });
    }
    return ledgerEntries;
  }, [ledgerEntries, filter, partyType]);

  // Construct WhatsApp text message in Tally Ledger format
  const handleWhatsAppShare = () => {
    const isPayable = closingType === "Cr";
    const statusText =
      closingType === "Nil"
        ? "Fully Settled (Nil)"
        : isPayable
          ? `₹${formatINR(closingBalance)} Payable (Cr)`
          : `₹${formatINR(closingBalance)} Receivable (Dr)`;

    const lines = [
      `*AARAV TRADERS - TALLY STATEMENT OF ACCOUNT*`,
      `Ledger Account: *${partyName}*`,
      `Account Group: ${
        partyType === "supplier"
          ? "Sundry Creditors (Supplier)"
          : partyType === "agency"
            ? "Sundry Creditors (Transporter)"
            : "Sundry Debtors (Customer)"
      }`,
      `Date: ${formatDate(new Date())}`,
      `---------------------------------------`,
      `Total Billed / Debits: ${formatINR(totalDebit)}`,
      `Total Paid / Credits: ${formatINR(totalCredit)}`,
      `*CLOSING BALANCE: ${statusText}*`,
      `---------------------------------------`,
      `Recent Transactions (${ledgerEntries.length} total):`,
    ];

    ledgerEntries.slice(-6).forEach((e) => {
      const amt = e.debit > 0 ? `Dr ${formatINR(e.debit)}` : `Cr ${formatINR(e.credit)}`;
      lines.push(
        `• ${formatDate(e.date)} | ${e.voucherType} [${e.reference}]: ${amt} (Bal: ${formatINR(e.runningBalance)} ${e.balanceType})`,
      );
    });

    lines.push(`\nFor reconciliations, contact Aarav Traders finance desk.`);

    const message = lines.join("\n");
    const cleanPhone = partyPhone ? partyPhone.replace(/[^0-9]/g, "") : "";
    const url = cleanPhone
      ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank");
  };

  const handleDownloadPdf = async () => {
    await generatePartyLedgerPdf({
      partyName,
      partyType,
      partyPhone,
      partyCreditDays,
      entries: ledgerEntries,
      totalDebit,
      totalCredit,
      closingBalance,
      closingType,
    });
  };

  const handleExportExcel = () => {
    const headers = [
      "Date",
      "Voucher Type",
      "Particulars",
      "Reference / Truck",
      "Debit (Dr)",
      "Credit (Cr)",
      "Running Balance",
      "Balance Type",
    ];
    const rows = ledgerEntries.map((e) => [
      e.date,
      `"${e.voucherType}"`,
      `"${e.particulars.replace(/"/g, '""')}"`,
      `"${e.reference}"`,
      e.debit > 0 ? e.debit.toFixed(2) : "0.00",
      e.credit > 0 ? e.credit.toFixed(2) : "0.00",
      e.runningBalance.toFixed(2),
      e.balanceType,
    ]);

    const metadata = [
      `"AARAV TRADERS - PARTY STATEMENT OF ACCOUNT"`,
      `"Party: ${partyName} · Group: ${groupLabel}"`,
      `"As on: ${new Date().toLocaleDateString("en-IN")}"`,
      `"Total Debit (Billed): Rs. ${totalDebit.toFixed(2)} | Total Credit (Paid): Rs. ${totalCredit.toFixed(2)} | Net Balance: Rs. ${closingBalance.toFixed(2)} ${closingType}"`,
      "",
    ];

    const csvContent =
      "\uFEFF" + [...metadata, headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const cleanParty = partyName.replace(/[^a-zA-Z0-9]/g, "_");
    link.setAttribute("href", url);
    link.setAttribute("download", `Aarav_Traders_Ledger_${cleanParty}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const groupLabel =
    partyType === "supplier"
      ? "Sundry Creditor (Supplier A/c)"
      : partyType === "agency"
        ? "Sundry Creditor (Transporter A/c)"
        : "Sundry Debtor (Customer A/c)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="no-print p-4 sm:p-5 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-black tracking-tight">
                Party Ledger & Khata
              </DialogTitle>
              <p className="text-xs text-muted-foreground">Standard Tally Statement of Account</p>
            </div>
            <span className="text-[11px] uppercase font-bold px-2.5 py-1 rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
              {partyType}
            </span>
          </div>
        </DialogHeader>

        {/* Scrollable Body: Tally Ledger Printable Document */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar print:p-6 print:text-black">
          {/* Firm & Account Header */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-3 gap-2">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                  AARAV TRADERS
                </h2>
                <p className="text-xs text-muted-foreground">
                  Coal & Biomass Briquettes Trading · Shegaon
                </p>
              </div>
              <div className="text-left sm:text-right text-xs">
                <span className="text-muted-foreground block text-[11px]">Statement Generated</span>
                <strong className="text-foreground tabular-nums">{formatDate(new Date())}</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground text-[11px] block">Ledger Account Name</span>
                <strong className="text-base font-bold text-foreground">{partyName}</strong>
                <p className="text-muted-foreground text-[11px] mt-0.5">{groupLabel}</p>
              </div>
              <div className="space-y-1 sm:text-right">
                {partyPhone && (
                  <p className="text-muted-foreground flex items-center sm:justify-end gap-1 tabular-nums">
                    <Phone className="h-3 w-3" /> {partyPhone}
                  </p>
                )}
                {partyCreditDays !== undefined && partyCreditDays !== null && (
                  <p className="text-muted-foreground flex items-center sm:justify-end gap-1">
                    <Clock className="h-3 w-3" /> Credit Terms:{" "}
                    <strong className="text-foreground tabular-nums">{partyCreditDays} Days</strong>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* TALLY CLOSING BALANCE HIGHLIGHT BANNER */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="grid grid-cols-3 gap-2 text-center border-b border-border pb-3">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Total Debits (Dr)
                </span>
                <p className="text-sm font-extrabold text-foreground mt-0.5 tabular-nums">
                  {formatINR(totalDebit)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Total Credits (Cr)
                </span>
                <p className="text-sm font-extrabold text-foreground mt-0.5 tabular-nums">
                  {formatINR(totalCredit)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Transactions
                </span>
                <p className="text-sm font-extrabold text-foreground mt-0.5 tabular-nums">
                  {ledgerEntries.length} Entries
                </p>
              </div>
            </div>

            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-muted-foreground">
                Net Closing Balance
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xl font-black tabular-nums ${
                    closingType === "Nil"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : closingType === "Cr"
                        ? "text-destructive"
                        : "text-teal-700 dark:text-teal-300"
                  }`}
                >
                  {formatINR(closingBalance)}{" "}
                  <span className="text-xs uppercase tracking-normal">({closingType})</span>
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    closingType === "Nil"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : closingType === "Cr"
                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                        : "bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20"
                  }`}
                >
                  {closingType === "Nil"
                    ? "✓ Settled"
                    : closingType === "Cr"
                      ? "Payable to party"
                      : "Receivable from party"}
                </span>
              </div>
            </div>
          </div>

          {/* Filter Pills (no-print) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-print">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                filter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All Vouchers ({ledgerEntries.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("bills")}
              className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                filter === "bills"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Invoices & Bills
            </button>
            <button
              type="button"
              onClick={() => setFilter("payments")}
              className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                filter === "payments"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Payments & Receipts
            </button>
            <button
              type="button"
              onClick={() => setFilter("pending")}
              className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                filter === "pending"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Pending Loads Only
            </button>
          </div>

          {/* CHRONOLOGICAL TALLY LEDGER ENTRIES */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>Ledger Statement Entries</span>
              <span className="tabular-nums">Showing {displayedEntries.length}</span>
            </div>

            {displayedEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                No entries match the selected filter.
              </div>
            ) : (
              <div className="space-y-2">
                {displayedEntries.map((entry) => {
                  const isDebit = entry.debit > 0;
                  const isCredit = entry.credit > 0;

                  return (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-border bg-card p-3 space-y-2 transition-colors hover:bg-muted/20"
                    >
                      {/* Top Bar of Entry */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                            {formatDate(entry.date)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                              entry.voucherType.includes("Payment") ||
                              entry.voucherType.includes("Receipt")
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20"
                            }`}
                          >
                            {isDebit ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownLeft className="h-3 w-3" />
                            )}
                            {entry.voucherType}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground">
                            Ref: {entry.reference}
                          </span>
                          {entry.paymentId && onDeletePayment && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                if (
                                  window.confirm(
                                    "Are you sure you want to delete / void this payment?",
                                  )
                                ) {
                                  await onDeletePayment(entry.paymentId!);
                                }
                              }}
                              className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Delete payment"
                            >
                              <Trash2 className="h-3 w-3 mr-1" /> Void
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Particulars Text */}
                      <p className="text-xs font-medium text-foreground leading-relaxed">
                        {entry.particulars}
                      </p>

                      {/* Dr / Cr and Running Balance Row */}
                      <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                        <div className="flex items-center gap-3">
                          {isDebit && (
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                                Debit (Dr)
                              </span>
                              <strong className="text-sm font-black tabular-nums text-foreground">
                                {formatINR(entry.debit)}
                              </strong>
                            </div>
                          )}
                          {isCredit && (
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                                Credit (Cr)
                              </span>
                              <strong className="text-sm font-black tabular-nums text-foreground">
                                {formatINR(entry.credit)}
                              </strong>
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground uppercase block font-semibold">
                            Balance
                          </span>
                          <span className="text-xs font-black tabular-nums text-foreground">
                            {formatINR(entry.runningBalance)}{" "}
                            <span className="text-[10px] text-muted-foreground">
                              {entry.balanceType}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Action for Pending Load */}
                      {entry.load &&
                        onRecordPayment &&
                        (() => {
                          const pendingAmt =
                            partyType === "supplier"
                              ? entry.load.purchase_pending
                              : partyType === "agency"
                                ? entry.load.freight_pending
                                : (entry.load.sale_pending ?? 0);

                          if (pendingAmt <= 0) {
                            return (
                              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border-t border-border/40 pt-1.5">
                                <ShieldCheck className="h-3.5 w-3.5" /> Fully Settled
                              </div>
                            );
                          }

                          const targetKind =
                            partyType === "supplier"
                              ? "purchase"
                              : partyType === "agency"
                                ? "freight"
                                : "sale";

                          return (
                            <div className="flex items-center justify-between border-t border-border/40 pt-2 no-print">
                              <span className="text-[11px] font-bold text-destructive tabular-nums">
                                Unsettled: {formatINR(pendingAmt)}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (entry.load) {
                                    onRecordPayment(entry.load, targetKind);
                                    onOpenChange(false);
                                  }
                                }}
                                className="h-8 text-xs font-bold gap-1 rounded-lg text-teal-700 dark:text-teal-300 border-teal-500/30 hover:bg-teal-500/10"
                              >
                                <PlusCircle className="h-3.5 w-3.5" />
                                {partyType === "buyer" ? "Receive Payment" : "Pay Bill"}
                              </Button>
                            </div>
                          );
                        })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sticky Action Buttons Footer (Always visible, never cut off) */}
        <div className="p-3 sm:p-4 border-t border-border bg-background shrink-0 flex flex-wrap items-center gap-2 no-print">
          <Button
            type="button"
            onClick={handleDownloadPdf}
            style={{ background: "linear-gradient(135deg, #0B2545 0%, #0F766E 100%)" }}
            className="flex-1 min-h-11 text-xs sm:text-sm font-bold text-white rounded-xl shadow-xs hover:brightness-105 active:scale-95"
          >
            <FileDown className="mr-1.5 h-4 w-4" /> Download A4 PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportExcel}
            className="min-h-11 px-3.5 text-xs sm:text-sm font-semibold rounded-xl border-slate-200/90 dark:border-slate-800 hover:bg-muted"
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-600" /> Excel
          </Button>
          <Button
            type="button"
            onClick={handleWhatsAppShare}
            className="min-h-11 px-3.5 text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
          >
            <Share2 className="mr-1.5 h-4 w-4" /> WhatsApp
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handlePrint}
            title="Print via Printer"
            className="h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground"
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
