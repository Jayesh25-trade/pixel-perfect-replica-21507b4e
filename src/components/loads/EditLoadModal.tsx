import { useState, useEffect, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import type { LoadDetail, Party } from "@/hooks/use-load-accounts";
import type { TablesInsert } from "@/integrations/supabase/types";
import { formatINR, formatTons } from "@/lib/calculations";
import { Truck, Save, AlertCircle } from "lucide-react";

interface EditLoadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  load: LoadDetail | null;
  parties: Party[];
  onUpdateLoad: (id: string, updates: Partial<TablesInsert<"loads">>) => Promise<void>;
}

export function EditLoadModal({
  open,
  onOpenChange,
  load,
  parties,
  onUpdateLoad,
}: EditLoadModalProps) {
  const [loadDate, setLoadDate] = useState("");
  const [material, setMaterial] = useState<"coal" | "briquette">("coal");
  const [supplierId, setSupplierId] = useState("");
  const [tonsBought, setTonsBought] = useState("");
  const [buyRate, setBuyRate] = useState("");

  const [agencyId, setAgencyId] = useState("");
  const [truckNumber, setTruckNumber] = useState("");
  const [tonsLoaded, setTonsLoaded] = useState("");
  const [freightRate, setFreightRate] = useState("");

  const [isSold, setIsSold] = useState(false);
  const [buyerId, setBuyerId] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [tonsReceived, setTonsReceived] = useState("");
  const [saleRate, setSaleRate] = useState("");
  const [creditDays, setCreditDays] = useState("30");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter parties by category
  const suppliers = useMemo(() => parties.filter((p) => p.type === "supplier"), [parties]);
  const agencies = useMemo(() => parties.filter((p) => p.type === "agency"), [parties]);
  const buyers = useMemo(() => parties.filter((p) => p.type === "buyer"), [parties]);

  // Sync state whenever load changes or dialog opens
  useEffect(() => {
    if (load && open) {
      setLoadDate(load.load_date || "");
      setMaterial(load.material || "coal");
      setSupplierId(load.supplier_id || "");
      setTonsBought(load.tons_bought?.toString() || "");
      setBuyRate(load.buy_rate?.toString() || "");

      setAgencyId(load.agency_id || "");
      setTruckNumber(load.truck_number || "");
      setTonsLoaded(load.tons_loaded?.toString() || "");
      setFreightRate(load.freight_rate?.toString() || "");

      const sold = !!load.sale_date;
      setIsSold(sold);
      setBuyerId(load.buyer_id || "");
      setSaleDate(load.sale_date || "");
      setTonsReceived(load.tons_received?.toString() || "");
      setSaleRate(load.sale_rate?.toString() || "");
      setCreditDays(load.credit_days?.toString() || "30");
      setErrorMsg(null);
    }
  }, [load, open]);

  // Dynamic calculations preview
  const preview = useMemo(() => {
    const tb = parseFloat(tonsBought) || 0;
    const br = parseFloat(buyRate) || 0;
    const tl = parseFloat(tonsLoaded) || 0;
    const fr = parseFloat(freightRate) || 0;
    const tr = parseFloat(tonsReceived) || 0;
    const sr = parseFloat(saleRate) || 0;

    const gstRate = material === "coal" ? 18 : 5;
    const tcsRate = material === "coal" ? 2 : 0;

    const purchaseAmount = Math.round(tb * br * 100) / 100;
    const purchaseGst = Math.round(purchaseAmount * (gstRate / 100) * 100) / 100;
    const purchaseTcs =
      material === "coal"
        ? Math.round((purchaseAmount + purchaseGst) * (tcsRate / 100) * 100) / 100
        : 0;
    const purchaseTotal = Math.round((purchaseAmount + purchaseGst + purchaseTcs) * 100) / 100;

    const freightTotal = Math.round(tl * fr * 100) / 100;

    let saleAmount = 0;
    let saleGst = 0;
    let saleTotal = 0;
    let profit = 0;
    let profitPerTon = 0;

    if (isSold && tr > 0 && sr > 0) {
      saleAmount = Math.round(tr * sr * 100) / 100;
      saleGst = Math.round(saleAmount * (gstRate / 100) * 100) / 100;
      saleTotal = Math.round((saleAmount + saleGst) * 100) / 100;
      profit = Math.round((saleAmount - purchaseAmount - freightTotal) * 100) / 100;
      profitPerTon = Math.round((profit / tr) * 100) / 100;
    }

    return {
      gstRate,
      tcsRate,
      purchaseAmount,
      purchaseGst,
      purchaseTcs,
      purchaseTotal,
      freightTotal,
      saleAmount,
      saleGst,
      saleTotal,
      profit,
      profitPerTon,
    };
  }, [tonsBought, buyRate, tonsLoaded, freightRate, tonsReceived, saleRate, material, isSold]);

  if (!load) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const tb = parseFloat(tonsBought);
    const br = parseFloat(buyRate);
    const tl = parseFloat(tonsLoaded);
    const fr = parseFloat(freightRate);

    if (!loadDate) {
      setErrorMsg("Load Date is required.");
      return;
    }
    if (!supplierId) {
      setErrorMsg("Please select a Supplier.");
      return;
    }
    if (isNaN(tb) || tb <= 0) {
      setErrorMsg("Tons Bought must be greater than 0.");
      return;
    }
    if (isNaN(br) || br <= 0) {
      setErrorMsg("Buy Rate must be greater than 0.");
      return;
    }
    if (!agencyId) {
      setErrorMsg("Please select a Transport Agency.");
      return;
    }
    if (!truckNumber.trim()) {
      setErrorMsg("Truck Number is required.");
      return;
    }
    if (isNaN(tl) || tl <= 0) {
      setErrorMsg("Tons Loaded must be greater than 0.");
      return;
    }
    if (isNaN(fr) || fr < 0) {
      setErrorMsg("Freight Rate must be 0 or greater.");
      return;
    }

    let tr: number | null = null;
    let sr: number | null = null;
    let sDate: string | null = null;
    let bId: string | null = null;
    let cd: number | null = null;

    if (isSold) {
      if (!buyerId) {
        setErrorMsg("Please select a Buyer for the sold load.");
        return;
      }
      if (!saleDate) {
        setErrorMsg("Sale Date is required when load is sold.");
        return;
      }
      tr = parseFloat(tonsReceived);
      sr = parseFloat(saleRate);
      if (isNaN(tr) || tr <= 0) {
        setErrorMsg("Tons Received must be greater than 0.");
        return;
      }
      if (isNaN(sr) || sr <= 0) {
        setErrorMsg("Sale Rate must be greater than 0.");
        return;
      }
      bId = buyerId;
      sDate = saleDate;
      cd = parseInt(creditDays, 10) || 30;
    }

    try {
      setIsSubmitting(true);
      await onUpdateLoad(load.id, {
        load_date: loadDate,
        material,
        supplier_id: supplierId,
        tons_bought: tb,
        buy_rate: br,
        agency_id: agencyId,
        truck_number: truckNumber.toUpperCase().trim(),
        tons_loaded: tl,
        freight_rate: fr,
        buyer_id: bId,
        sale_date: sDate,
        tons_received: tr,
        sale_rate: sr,
        credit_days: cd,
      });

      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base font-extrabold">
              Edit Load · {load.truck_number}
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Update load rates, quantities, parties, or sale information.
          </p>
        </DialogHeader>

        {errorMsg && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1 text-xs">
          {/* MATERIAL & DATE */}
          <div className="rounded-xl border border-border bg-card p-3 space-y-3">
            <span className="font-bold text-foreground block uppercase text-[11px] tracking-wider">
              Basic Load Info
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit-load-date" className="text-[11px]">
                  Load Date
                </Label>
                <Input
                  id="edit-load-date"
                  type="date"
                  value={loadDate}
                  onChange={(e) => setLoadDate(e.target.value)}
                  className="min-h-10 text-xs"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-material" className="text-[11px]">
                  Material Type
                </Label>
                <Select
                  value={material}
                  onValueChange={(val: "coal" | "briquette") => setMaterial(val)}
                >
                  <SelectTrigger id="edit-material" className="min-h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coal">Coal (18% GST + 2% TCS)</SelectItem>
                    <SelectItem value="briquette">Briquette (5% GST, No TCS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 1. PURCHASE SECTION */}
          <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="font-bold text-foreground uppercase text-[11px] tracking-wider">
                1. Purchase (Supplier)
              </span>
              <span className="font-mono text-muted-foreground font-semibold">
                Bill: {formatINR(preview.purchaseTotal)}
              </span>
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-supplier" className="text-[11px]">
                Supplier
              </Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="edit-supplier" className="min-h-10 text-xs">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit-tons-bought" className="text-[11px]">
                  Tons Bought (t)
                </Label>
                <Input
                  id="edit-tons-bought"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={tonsBought}
                  onChange={(e) => setTonsBought(e.target.value)}
                  className="min-h-10 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-buy-rate" className="text-[11px]">
                  Buy Rate (₹/t)
                </Label>
                <Input
                  id="edit-buy-rate"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={buyRate}
                  onChange={(e) => setBuyRate(e.target.value)}
                  className="min-h-10 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-2 space-y-1 text-[11px] font-mono text-muted-foreground">
              <div className="flex justify-between">
                <span>Base Amount:</span>
                <span className="font-medium text-foreground">
                  {formatINR(preview.purchaseAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Input GST ({preview.gstRate}%):</span>
                <span className="font-medium text-foreground">
                  {formatINR(preview.purchaseGst)}
                </span>
              </div>
              {preview.purchaseTcs > 0 && (
                <div className="flex justify-between text-foreground font-semibold">
                  <span>TCS ({preview.tcsRate}% on Coal):</span>
                  <span>{formatINR(preview.purchaseTcs)}</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. FREIGHT SECTION */}
          <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="font-bold text-foreground uppercase text-[11px] tracking-wider">
                2. Transport (Agency)
              </span>
              <span className="font-mono text-muted-foreground font-semibold">
                Freight: {formatINR(preview.freightTotal)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit-agency" className="text-[11px]">
                  Transporter Agency
                </Label>
                <Select value={agencyId} onValueChange={setAgencyId}>
                  <SelectTrigger id="edit-agency" className="min-h-10 text-xs">
                    <SelectValue placeholder="Select agency" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-truck" className="text-[11px]">
                  Truck Number
                </Label>
                <Input
                  id="edit-truck"
                  type="text"
                  placeholder="e.g. MH-12-AB-1234"
                  value={truckNumber}
                  onChange={(e) => setTruckNumber(e.target.value)}
                  className="min-h-10 text-xs uppercase font-mono font-bold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit-tons-loaded" className="text-[11px]">
                  Tons Loaded (t)
                </Label>
                <Input
                  id="edit-tons-loaded"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={tonsLoaded}
                  onChange={(e) => setTonsLoaded(e.target.value)}
                  className="min-h-10 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-freight-rate" className="text-[11px]">
                  Freight Rate (₹/t)
                </Label>
                <Input
                  id="edit-freight-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={freightRate}
                  onChange={(e) => setFreightRate(e.target.value)}
                  className="min-h-10 text-xs font-mono"
                  required
                />
              </div>
            </div>
          </div>

          {/* 3. SALE & DELIVERY SECTION */}
          <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <div className="flex items-center gap-2">
                <Switch id="edit-is-sold" checked={isSold} onCheckedChange={setIsSold} />
                <Label
                  htmlFor="edit-is-sold"
                  className="font-bold text-foreground uppercase text-[11px] tracking-wider cursor-pointer"
                >
                  3. Sold & Delivered?
                </Label>
              </div>
              {isSold && (
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  Profit: {formatINR(preview.profit)}
                </span>
              )}
            </div>

            {isSold && (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-buyer" className="text-[11px]">
                      Buyer
                    </Label>
                    <Select value={buyerId} onValueChange={setBuyerId}>
                      <SelectTrigger id="edit-buyer" className="min-h-10 text-xs">
                        <SelectValue placeholder="Select buyer" />
                      </SelectTrigger>
                      <SelectContent>
                        {buyers.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-sale-date" className="text-[11px]">
                      Sale Date
                    </Label>
                    <Input
                      id="edit-sale-date"
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="min-h-10 text-xs"
                      required={isSold}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-tons-received" className="text-[11px]">
                      Tons Recv
                    </Label>
                    <Input
                      id="edit-tons-received"
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={tonsReceived}
                      onChange={(e) => setTonsReceived(e.target.value)}
                      className="min-h-10 text-xs font-mono"
                      required={isSold}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-sale-rate" className="text-[11px]">
                      Sale Rate
                    </Label>
                    <Input
                      id="edit-sale-rate"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={saleRate}
                      onChange={(e) => setSaleRate(e.target.value)}
                      className="min-h-10 text-xs font-mono"
                      required={isSold}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-credit-days" className="text-[11px]">
                      Credit Days
                    </Label>
                    <Input
                      id="edit-credit-days"
                      type="number"
                      min="0"
                      value={creditDays}
                      onChange={(e) => setCreditDays(e.target.value)}
                      className="min-h-10 text-xs font-mono"
                    />
                  </div>
                </div>

                {parseFloat(tonsReceived) > 0 &&
                  parseFloat(tonsBought) > 0 &&
                  (() => {
                    const tb = parseFloat(tonsBought);
                    const tr = parseFloat(tonsReceived);
                    const diff = tb - tr;
                    const diffKg = Math.round(Math.abs(diff) * 1000);
                    const loss = Math.round(diff * (parseFloat(buyRate) || 0));
                    return (
                      <div className="rounded-lg p-2 font-mono text-[11px] bg-amber-500/10 border border-amber-500/20 text-amber-950 dark:text-amber-200 flex items-center justify-between">
                        <span className="font-semibold">⚖️ Weighbridge Difference:</span>
                        <span className="font-black">
                          {diff > 0.005
                            ? `-${diff.toFixed(3)} t (${diffKg} kg Shortage · Loss: -₹${loss.toLocaleString("en-IN")})`
                            : diff < -0.005
                              ? `+${Math.abs(diff).toFixed(3)} t (+${diffKg} kg Gain)`
                              : "0 kg Diff (Exact Match)"}
                        </span>
                      </div>
                    );
                  })()}

                <div className="rounded-lg bg-muted/40 p-2 space-y-1 text-[11px] font-mono text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Customer Bill (with {preview.gstRate}% GST):</span>
                    <span className="font-bold text-foreground">
                      {formatINR(preview.saleTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Trading Profit:</span>
                    <span
                      className={`font-black ${preview.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}
                    >
                      {formatINR(preview.profit)} ({formatINR(preview.profitPerTon)}/t)
                    </span>
                  </div>
                </div>
              </div>
            )}
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
              disabled={isSubmitting}
              className="flex-1 min-h-11 font-bold gap-2 rounded-xl bg-primary shadow-sm"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? "Updating..." : "Update Load"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
