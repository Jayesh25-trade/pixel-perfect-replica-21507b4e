import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LoadDetail } from "@/hooks/use-load-accounts";
import { formatINR, type PaymentKind, type PaymentMode } from "@/lib/calculations";
import { CreditCard, ArrowDownLeft, ArrowUpRight, CheckCircle2, AlertCircle } from "lucide-react";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  load: LoadDetail | null;
  defaultKind?: PaymentKind | undefined;
  onRecordPayment: (data: {
    load_id: string;
    party_id: string;
    kind: PaymentKind;
    amount: number;
    payment_date: string;
    mode: PaymentMode;
    reference?: string | undefined;
  }) => Promise<void>;
}

export function PaymentModal({
  open,
  onOpenChange,
  load,
  defaultKind = "sale",
  onRecordPayment,
}: PaymentModalProps) {
  const [kind, setKind] = useState<PaymentKind>(defaultKind);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]!);
  const [mode, setMode] = useState<PaymentMode>("UPI");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync kind when defaultKind changes or dialog opens
  useEffect(() => {
    if (open) {
      setKind(defaultKind);
      setAmount("");
      setReference("");
      setValidationError(null);
      setDate(new Date().toISOString().split("T")[0]!);
    }
  }, [open, defaultKind]);

  if (!load) return null;

  // Determine current pending balance for the selected kind
  let partyId = "";
  let partyName = "";
  let partyRoleLabel = "";
  let billTotal = 0;
  let existingPaid = 0;
  let remaining = 0;

  if (kind === "purchase") {
    partyId = load.supplier_id;
    partyName = load.supplier_name ?? "Supplier";
    partyRoleLabel = "Coal Supplier";
    billTotal = load.purchase_total;
    existingPaid = load.purchase_paid;
    remaining = load.purchase_pending;
  } else if (kind === "freight") {
    partyId = load.agency_id;
    partyName = load.agency_name ?? "Agency";
    partyRoleLabel = "Transport Agency";
    billTotal = load.freight_amount;
    existingPaid = load.freight_paid;
    remaining = load.freight_pending;
  } else if (kind === "sale") {
    partyId = load.buyer_id ?? "";
    partyName = load.buyer_name ?? "Buyer";
    partyRoleLabel = "Buyer / Customer";
    billTotal = load.sale_total ?? 0;
    existingPaid = load.sale_paid;
    remaining = load.sale_pending ?? 0;
  }

  const isReceipt = kind === "sale";

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > remaining) {
      setValidationError(
        `Amount exceeds remaining balance of ${formatINR(remaining)}. The database trigger will reject overpayments.`,
      );
    } else {
      setValidationError(null);
    }
  };

  const handleFillFull = () => {
    if (remaining > 0) {
      setAmount(remaining.toString());
      setValidationError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setValidationError("Please enter a valid payment amount greater than ₹0.");
      return;
    }

    if (numAmount > remaining) {
      setValidationError(`Maximum allowed settlement is ${formatINR(remaining)}.`);
      return;
    }

    try {
      setLoading(true);
      await onRecordPayment({
        load_id: load.id,
        party_id: partyId,
        kind,
        amount: numAmount,
        payment_date: date,
        mode,
        reference: reference.trim() || undefined,
      });
      setAmount("");
      setReference("");
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setValidationError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isReceipt ? (
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <ArrowDownLeft className="h-5 w-5" />
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              )}
              <div>
                <DialogTitle className="text-base font-extrabold">
                  {isReceipt
                    ? "Receive Payment (Customer Receipt)"
                    : `Pay ${kind === "purchase" ? "Supplier" : "Transporter"}`}
                </DialogTitle>
                <p className="text-xs text-muted-foreground font-mono">
                  Truck: <strong className="text-foreground">{load.truck_number}</strong> ·{" "}
                  {load.material.toUpperCase()}
                </p>
              </div>
            </div>

            <span
              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                isReceipt
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                  : "bg-destructive/15 text-destructive border border-destructive/30"
              }`}
            >
              {isReceipt ? "Receipt (In)" : "Payment (Out)"}
            </span>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-xs">
          {/* CATEGORY SELECTOR */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-kind" className="font-bold text-foreground">
              Payment Category & Party
            </Label>
            <Select
              value={kind}
              onValueChange={(val) => {
                setKind(val as PaymentKind);
                setAmount("");
                setValidationError(null);
              }}
            >
              <SelectTrigger id="payment-kind" className="min-h-11 text-xs">
                <SelectValue placeholder="Select payment kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="purchase">
                  1. Supplier Payment → {load.supplier_name} (Pending:{" "}
                  {formatINR(load.purchase_pending)})
                </SelectItem>
                <SelectItem value="freight">
                  2. Transporter Payment → {load.agency_name} (Pending:{" "}
                  {formatINR(load.freight_pending)})
                </SelectItem>
                {load.buyer_name && (
                  <SelectItem value="sale">
                    3. Customer Receipt ← {load.buyer_name} (Pending:{" "}
                    {formatINR(load.sale_pending ?? 0)})
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* ACTIVE PARTY & PENDING BALANCE CARD */}
          <div
            className={`rounded-xl border p-3.5 space-y-2 ${
              isReceipt
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-destructive/20 bg-destructive/5"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                  {partyRoleLabel}
                </span>
                <strong className="text-sm font-extrabold text-foreground">{partyName}</strong>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                  {isReceipt ? "Receivable Balance" : "Payable Balance"}
                </span>
                <span
                  className={`text-base font-black font-mono block ${
                    remaining > 0
                      ? isReceipt
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {formatINR(remaining)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-2 font-mono">
              <span>
                Total Billed: <strong className="text-foreground">{formatINR(billTotal)}</strong>
              </span>
              <span>
                Already Settled:{" "}
                <strong className="text-foreground">{formatINR(existingPaid)}</strong>
              </span>
            </div>

            {remaining > 0 && (
              <div className="pt-1 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFillFull}
                  className="h-8 text-xs font-bold gap-1 rounded-lg border-border hover:bg-muted"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Settle Full Balance ({formatINR(remaining)})
                </Button>
              </div>
            )}
          </div>

          {/* AMOUNT INPUT */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount" className="font-bold text-foreground">
              {isReceipt ? "Receipt Amount (₹ Received)" : "Payment Amount (₹ Paid)"}
            </Label>
            <div className="relative">
              <Input
                id="payment-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={remaining}
                placeholder={`0.00 (Max: ${remaining})`}
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="min-h-12 text-base font-mono font-bold pr-12 rounded-xl"
                required
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-muted-foreground">
                INR
              </span>
            </div>
            {validationError && (
              <div className="flex items-center gap-1.5 text-xs text-destructive pt-0.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* DATE & PAYMENT MODE */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="payment-date" className="font-bold text-foreground">
                Transaction Date
              </Label>
              <Input
                id="payment-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-h-11 text-xs rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment-mode" className="font-bold text-foreground">
                Payment Mode
              </Label>
              <Select value={mode} onValueChange={(val: PaymentMode) => setMode(val)}>
                <SelectTrigger id="payment-mode" className="min-h-11 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI">UPI / Net Banking</SelectItem>
                  <SelectItem value="Cheque">Cheque / RTGS / NEFT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* REFERENCE / UTR */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-ref" className="font-bold text-foreground">
              Reference / UTR / Cheque No. (Optional)
            </Label>
            <Input
              id="payment-ref"
              placeholder="e.g. UTR1293847291 or Chq #004921"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="min-h-11 text-xs rounded-xl font-mono"
            />
          </div>

          {/* SUBMIT BUTTONS */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 min-h-11 font-semibold rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || remaining <= 0}
              className={`flex-1 min-h-11 font-bold gap-1.5 rounded-xl text-white shadow-sm ${
                isReceipt
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-destructive hover:bg-destructive/90"
              }`}
            >
              <CreditCard className="h-4 w-4" />
              {loading
                ? "Recording..."
                : isReceipt
                  ? `Receive ${amount ? formatINR(parseFloat(amount) || 0) : ""}`
                  : `Pay ${amount ? formatINR(parseFloat(amount) || 0) : ""}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
