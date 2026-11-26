import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Truck,
  Edit,
  Trash2,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  AlertCircle,
  FileCheck2,
  Download,
} from "lucide-react";
import type { LoadDetail, Payment } from "@/hooks/use-load-accounts";
import { formatINR, formatTons, formatDate, type PaymentKind } from "@/lib/calculations";
import { type EnrichedChallan, findMatchingChallan } from "@/hooks/use-formomatic-challans";
import { generateAaravChallanPdf } from "@/utils/generateChallanPdf";

interface LoadDetailSheetProps {
  load: LoadDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payments?: Payment[];
  onRecordPaymentClick: (load: LoadDetail, kind?: PaymentKind) => void;
  onEditLoadClick: (load: LoadDetail) => void;
  onSoftDelete: (id: string) => Promise<void>;
  onDeletePayment?: (paymentId: string) => Promise<void>;
  challans?: EnrichedChallan[] | undefined;
}

export function LoadDetailSheet({
  load,
  open,
  onOpenChange,
  payments = [],
  onRecordPaymentClick,
  onEditLoadClick,
  onSoftDelete,
  onDeletePayment,
  challans = [],
}: LoadDetailSheetProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  if (!load) return null;

  const matchedChallan = findMatchingChallan(load, challans);

  // Filter payments for this load
  const loadPayments = payments.filter((p) => p.load_id === load.id);

  const handleDeleteLoad = async () => {
    try {
      setDeleting(true);
      await onSoftDelete(load.id);
      setConfirmDelete(false);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!onDeletePayment) return;
    try {
      setDeletingPaymentId(paymentId);
      await onDeletePayment(paymentId);
    } finally {
      setDeletingPaymentId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl p-5">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-600/25">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black tracking-wide font-mono text-foreground">
                  {load.truck_number}
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5 font-medium">
                  <Calendar className="h-3 w-3" />
                  <span>Loaded: {formatDate(load.load_date)}</span>
                  {load.sale_date && <span>· Sold: {formatDate(load.sale_date)}</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wider ${
                  load.material === "coal"
                    ? "bg-slate-900 text-slate-100 dark:bg-slate-100 dark:text-slate-900"
                    : "bg-amber-600 text-white"
                }`}
              >
                {load.material.toUpperCase()}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onEditLoadClick(load);
                }}
                className="h-8 text-xs font-bold gap-1 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-muted"
              >
                <Edit className="h-3.5 w-3.5" /> Edit
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          {/* CHALLAN LINK NOTE BANNER */}
          {matchedChallan && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
                  <FileCheck2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                    Created from Delivery Challan: {matchedChallan.pc_no}
                  </p>
                  <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                    Customer: <strong>{matchedChallan.party_name}</strong> · Quantity:{" "}
                    {matchedChallan.quantity} t
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => generateAaravChallanPdf(matchedChallan)}
                className="h-8 text-xs font-bold gap-1 rounded-xl border-emerald-500/30 bg-background/80 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200"
              >
                <Download className="h-3 w-3" /> PDF
              </Button>
            </div>
          )}

          {/* PROFIT & STATUS SUMMARY BANNER */}
          <div
            className={`rounded-2xl p-4 shadow-md flex items-center justify-between text-white ${
              load.sale_date
                ? "bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900 border border-emerald-500/30 shadow-emerald-950/20"
                : "bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-slate-950/20"
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
                  Trading Status
                </span>
              </div>
              <p className="text-base font-black text-white pt-0.5">
                {load.sale_date ? "Sold & Delivered" : "📦 In Stock (Unsold)"}
              </p>
            </div>
            {load.profit !== null && (
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
                  Net Trading Profit
                </span>
                <p
                  className={`text-xl font-black tabular-nums drop-shadow-xs ${
                    load.profit - 100 >= 0 ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {load.profit - 100 >= 0
                    ? `+${formatINR(load.profit - 100)}`
                    : formatINR(load.profit - 100)}
                </p>
                <span className="text-[10px] text-emerald-100/90 block tabular-nums">
                  Gross: {formatINR(load.profit)} | Sardarji Comm: -₹100
                </span>
              </div>
            )}
          </div>

          {/* 1. PURCHASE BREAKDOWN */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-border/70 pb-2">
              <span className="font-extrabold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-800 dark:bg-slate-300" />
                1. Purchase (Supplier)
              </span>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                {load.supplier_name}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-muted-foreground font-mono text-[11px]">
              <span>Tons Bought:</span>
              <span className="text-right font-bold text-foreground">
                {formatTons(load.tons_bought)}
              </span>
              <span>Buy Rate:</span>
              <span className="text-right font-medium text-foreground">
                {formatINR(load.buy_rate)}/t
              </span>
              <span>Purchase Amount:</span>
              <span className="text-right font-medium text-foreground">
                {formatINR(load.purchase_amount)}
              </span>
              <span>Input GST ({load.gst_rate}%):</span>
              <span className="text-right font-medium text-foreground">
                {formatINR(load.purchase_gst)}
              </span>
              {/* TCS on Coal Purchase: 2% */}
              {(load.material === "coal" ||
                (load.purchase_tcs !== undefined && load.purchase_tcs > 0)) && (
                <>
                  <span className="text-foreground font-semibold">
                    TCS ({load.tcs_rate ?? 2}% on Coal):
                  </span>
                  <span className="text-right font-semibold text-foreground">
                    {formatINR(
                      load.purchase_tcs !== undefined && load.purchase_tcs > 0
                        ? load.purchase_tcs
                        : Math.round(
                            ((load.purchase_amount ?? 0) + (load.purchase_gst ?? 0)) * 0.02 * 100,
                          ) / 100,
                    )}
                  </span>
                </>
              )}
              <span className="font-bold text-foreground">Total Supplier Bill:</span>
              <span className="text-right font-black text-foreground">
                {formatINR(
                  load.material === "coal" &&
                    (load.purchase_tcs === undefined || load.purchase_tcs === 0)
                    ? Math.round(
                        ((load.purchase_amount ?? 0) + (load.purchase_gst ?? 0)) * 1.02 * 100,
                      ) / 100
                    : load.purchase_total,
                )}
              </span>
              <span className="text-emerald-600 font-semibold">Paid to Supplier:</span>
              <span className="text-right font-bold text-emerald-600">
                {formatINR(load.purchase_paid)}
              </span>
              <span className="font-bold text-destructive">Pending to Supplier:</span>
              <span className="text-right font-black text-destructive">
                {formatINR(
                  load.material === "coal" &&
                    (load.purchase_tcs === undefined || load.purchase_tcs === 0)
                    ? Math.max(
                        0,
                        Math.round(
                          (Math.round(
                            ((load.purchase_amount ?? 0) + (load.purchase_gst ?? 0)) * 1.02 * 100,
                          ) /
                            100 -
                            (load.purchase_paid ?? 0)) *
                            100,
                        ) / 100,
                      )
                    : load.purchase_pending,
                )}
              </span>
            </div>

            {load.purchase_pending > 0 && (
              <div className="pt-1.5">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onRecordPaymentClick(load, "purchase");
                  }}
                  className="w-full min-h-10 font-bold text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Pay Supplier ({formatINR(load.purchase_pending)})
                </Button>
              </div>
            )}
          </div>

          {/* 2. FREIGHT BREAKDOWN */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-border/70 pb-2">
              <span className="font-extrabold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                2. Freight (Agency)
              </span>
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-500/10 px-2.5 py-0.5 rounded-full">
                {load.agency_name}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-muted-foreground font-mono text-[11px]">
              <span>Tons Loaded:</span>
              <span className="text-right font-bold text-foreground">
                {formatTons(load.tons_loaded)}
              </span>
              <span>Freight Rate:</span>
              <span className="text-right font-medium text-foreground">
                {formatINR(load.freight_rate)}/t
              </span>
              <span className="font-bold text-foreground">Total Freight (No GST):</span>
              <span className="text-right font-black text-foreground">
                {formatINR(load.freight_amount)}
              </span>
              <span className="text-emerald-600 font-semibold">Paid to Agency:</span>
              <span className="text-right font-bold text-emerald-600">
                {formatINR(load.freight_paid)}
              </span>
              <span className="font-bold text-destructive">Pending to Agency:</span>
              <span className="text-right font-black text-destructive">
                {formatINR(load.freight_pending)}
              </span>
            </div>

            {load.freight_pending > 0 && (
              <div className="pt-1.5">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onRecordPaymentClick(load, "freight");
                  }}
                  className="w-full min-h-10 font-bold text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Pay Transporter ({formatINR(load.freight_pending)})
                </Button>
              </div>
            )}
          </div>

          {/* 3. SALE BREAKDOWN */}
          {load.sale_date ? (
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-border/70 pb-2">
                <span className="font-extrabold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  3. Sale (Buyer)
                </span>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  {load.buyer_name ?? "Buyer"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-muted-foreground font-mono text-[11px]">
                <span>Tons Received:</span>
                <span className="text-right font-bold text-foreground">
                  {formatTons(load.tons_received)}
                </span>
                {load.shortage_tons !== null && load.shortage_tons > 0 && (
                  <>
                    <span className="text-amber-600 font-bold">Shortage:</span>
                    <span className="text-right font-bold text-amber-600">
                      {formatTons(load.shortage_tons)}
                    </span>
                  </>
                )}
                <span>Sale Rate:</span>
                <span className="text-right font-medium text-foreground">
                  {formatINR(load.sale_rate)}/t
                </span>
                <span>Sale Amount:</span>
                <span className="text-right font-medium text-foreground">
                  {formatINR(load.sale_amount)}
                </span>
                <span>Sale GST ({load.gst_rate}%):</span>
                <span className="text-right font-medium text-foreground">
                  {formatINR(load.sale_gst)}
                </span>
                <span className="font-bold text-foreground">Total Customer Bill:</span>
                <span className="text-right font-black text-foreground">
                  {formatINR(load.sale_total)}
                </span>
                <span>Due Date:</span>
                <span
                  className={`text-right font-semibold ${load.is_overdue ? "text-destructive" : "text-foreground"}`}
                >
                  {formatDate(load.due_date)} {load.is_overdue && "(OVERDUE)"}
                </span>
                <span className="text-emerald-600 font-semibold">Received from Buyer:</span>
                <span className="text-right font-bold text-emerald-600">
                  {formatINR(load.sale_paid)}
                </span>
                <span className="font-bold text-destructive">Pending from Buyer:</span>
                <span className="text-right font-black text-destructive">
                  {formatINR(load.sale_pending)}
                </span>
              </div>

              {load.sale_pending !== null && load.sale_pending > 0 && (
                <div className="pt-1.5">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      onRecordPaymentClick(load, "sale");
                    }}
                    className="w-full min-h-10 font-bold text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                  >
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                    Receive Payment ({formatINR(load.sale_pending)})
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-4 text-center space-y-2 bg-muted/20">
              <span className="text-xs text-muted-foreground block font-medium">
                Load is currently unsold inventory. Click below to enter buyer details & delivery.
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onEditLoadClick(load);
                }}
                className="h-9 text-xs font-bold rounded-xl"
              >
                <Edit className="mr-1 h-3.5 w-3.5" /> Enter Sale / Delivery
              </Button>
            </div>
          )}

          {/* KANTA DIFFERENCE & WEIGHT SLIP SUMMARY */}
          {load.sale_date &&
            load.tons_received !== null &&
            (() => {
              const loadedTons = load.tons_bought ?? 0;
              const receivedTons = load.tons_received ?? 0;
              const diffTons = loadedTons - receivedTons;
              const diffKg = Math.round(Math.abs(diffTons) * 1000);
              const lossRupees = Math.round(Math.abs(diffTons) * (load.buy_rate ?? 0));
              const shortagePct =
                loadedTons > 0 ? ((diffTons / loadedTons) * 100).toFixed(2) : "0.00";

              return (
                <div
                  className={`rounded-2xl border p-4 space-y-2 text-xs shadow-xs ${
                    diffTons > 0.005
                      ? "border-amber-300 dark:border-amber-800/60 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/15 text-amber-950 dark:text-amber-200"
                      : diffTons < -0.005
                        ? "border-emerald-300 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/15 text-emerald-950 dark:text-emerald-200"
                        : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <span className="font-extrabold text-xs flex items-center gap-1.5 text-foreground">
                      ⚖️ Weighbridge Difference (Kanta Shortage)
                    </span>
                    <span
                      className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full ${
                        diffTons > 0.005
                          ? "bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/30"
                          : diffTons < -0.005
                            ? "bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-500/30"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {diffTons > 0.005
                        ? `Shortage (${shortagePct}%)`
                        : diffTons < -0.005
                          ? `Gain (+${Math.abs(Number(shortagePct))}%)`
                          : "Exact Match"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                    <span className="text-muted-foreground">Loading Weighbridge:</span>
                    <span className="text-right font-bold text-foreground">
                      {formatTons(loadedTons)}
                    </span>
                    <span className="text-muted-foreground">Unloading Weighbridge:</span>
                    <span className="text-right font-bold text-foreground">
                      {formatTons(receivedTons)}
                    </span>
                    <span className="font-bold text-foreground">Weight Difference:</span>
                    <span
                      className={`text-right font-black ${
                        diffTons > 0.005
                          ? "text-amber-700 dark:text-amber-400"
                          : diffTons < -0.005
                            ? "text-emerald-600"
                            : "text-foreground"
                      }`}
                    >
                      {diffTons > 0.005
                        ? `-${formatTons(diffTons)} (${diffKg} kg Shortage)`
                        : diffTons < -0.005
                          ? `+${formatTons(Math.abs(diffTons))} (+${diffKg} kg Gain)`
                          : "0 kg Diff (Exact Match)"}
                    </span>
                    {diffTons > 0.005 && (
                      <>
                        <span className="font-bold text-destructive">Shortage Loss:</span>
                        <span className="text-right font-black text-destructive">
                          -{formatINR(lossRupees)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* 4. TAX POSITION (GST SUMMARY) */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="font-bold text-foreground uppercase text-[11px] tracking-wider">
                4. Tax Position (GST Summary)
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {load.material.toUpperCase()} ({load.gst_rate}%)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-muted-foreground font-mono text-[11px]">
              <span>Input GST (ITC Paid):</span>
              <span className="text-right font-medium text-foreground">
                {formatINR(load.purchase_gst)}
              </span>
              <span>Output GST (Collected):</span>
              <span className="text-right font-medium text-foreground">
                {load.sale_gst !== null ? formatINR(load.sale_gst) : "Pending Sale"}
              </span>
              <span className="font-bold text-foreground">Net GST Position:</span>
              <span className="text-right font-bold text-foreground">
                {load.sale_gst !== null ? formatINR(load.sale_gst - load.purchase_gst) : "—"}
              </span>
            </div>
          </div>

          {/* 5. PROFIT & SARDARJI COMMISSION RECONCILIATION */}
          {load.sale_date && load.profit !== null && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2.5 text-xs shadow-2xs">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <span className="font-extrabold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  Trading Margin & Sardarji Commission
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                  Deducted Post-Sale
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 tabular-nums text-[11px]">
                <span className="text-muted-foreground">Sale Amount (Realization):</span>
                <span className="text-right font-semibold text-foreground">
                  +{formatINR(load.sale_amount)}
                </span>
                <span className="text-muted-foreground">Purchase Cost:</span>
                <span className="text-right font-semibold text-rose-600 dark:text-rose-400">
                  -{formatINR(load.purchase_amount)}
                </span>
                <span className="text-muted-foreground">Freight Expense:</span>
                <span className="text-right font-semibold text-blue-600 dark:text-blue-400">
                  -{formatINR(load.freight_amount)}
                </span>
                <div className="col-span-2 border-t border-border/60 my-0.5" />
                <span className="font-bold text-foreground">Gross Trading Margin:</span>
                <span className="text-right font-black text-foreground">
                  {formatINR(load.profit)}
                </span>
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  Sardarji Commission (Deducted):
                </span>
                <span className="text-right font-black text-amber-700 dark:text-amber-400">
                  -₹100.00
                </span>
                <div className="col-span-2 border-t border-border/60 my-0.5" />
                <span className="font-black text-emerald-700 dark:text-emerald-300 text-xs">
                  Net Trading Profit (Final):
                </span>
                <span className="text-right font-black text-emerald-700 dark:text-emerald-300 text-sm">
                  {formatINR(load.profit - 100)}
                </span>
                {load.tons_received && load.tons_received > 0 && (
                  <>
                    <span className="text-[10px] text-muted-foreground">Net Margin Per Ton:</span>
                    <span className="text-right text-[10px] text-muted-foreground font-semibold">
                      {formatINR(Math.round((load.profit - 100) / load.tons_received))}/t
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 6. PAYMENT HISTORY & VOID ACTION */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="font-bold text-foreground uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-primary" />
                Payments & Vouchers ({loadPayments.length})
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onOpenChange(false);
                  onRecordPaymentClick(load);
                }}
                className="h-7 text-[11px] font-bold text-primary px-2"
              >
                + Add Payment
              </Button>
            </div>

            {loadPayments.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-1 text-center font-mono">
                No payments recorded yet for this load.
              </p>
            ) : (
              <div className="space-y-2">
                {loadPayments.map((p) => {
                  const isSaleReceipt = p.kind === "sale";
                  return (
                    <div
                      key={p.id}
                      className="rounded-lg border border-border/80 bg-muted/30 p-2.5 flex items-center justify-between gap-2 text-[11px]"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase font-mono ${
                              isSaleReceipt
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {isSaleReceipt ? "Receipt (In)" : `Paid ${p.kind.toUpperCase()}`}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {formatDate(p.payment_date)}
                          </span>
                        </div>
                        <div className="text-muted-foreground font-mono">
                          {p.mode} {p.reference && `· Ref: ${p.reference}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <strong
                          className={`font-mono text-xs font-black ${
                            isSaleReceipt ? "text-emerald-600" : "text-destructive"
                          }`}
                        >
                          {formatINR(p.amount)}
                        </strong>

                        {onDeletePayment && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={deletingPaymentId === p.id}
                            onClick={() => handleDeletePayment(p.id)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                            title="Void / Delete payment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DANGER ZONE: DELETE LOAD */}
          <div className="pt-1">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full text-center text-xs text-muted-foreground hover:text-destructive py-2 transition-colors font-medium"
              >
                Delete this load entry
              </button>
            ) : (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 space-y-2 text-center">
                <p className="text-xs font-semibold text-destructive flex items-center justify-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  Are you sure you want to remove truck {load.truck_number}?
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 min-h-9 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={deleting}
                    onClick={handleDeleteLoad}
                    className="flex-1 min-h-9 text-xs font-bold"
                  >
                    {deleting ? "Deleting..." : "Confirm Delete"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
