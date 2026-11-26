import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  AlertCircle,
  Sparkles,
  FileCheck2,
} from "lucide-react";
import type { Party, Settings } from "@/hooks/use-load-accounts";
import { computeLoadFigures, formatINR, formatTons, type Material } from "@/lib/calculations";
import {
  getInitialDraft,
  saveLoadDraft,
  loadSavedDraft,
  clearLoadDraft,
  type NewLoadDraft,
} from "@/lib/draft-storage";
import { AddPartyDialog } from "@/components/parties/AddPartyDialog";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import type { TablesInsert } from "@/integrations/supabase/types";

interface NewLoadWizardProps {
  parties: Party[];
  settings?: Settings | undefined;
  settingsError?: unknown;
  initialDraft?: Partial<NewLoadDraft> | undefined;
  onClose: () => void;
  onSubmit: (load: TablesInsert<"loads">) => Promise<void>;
  onAddParty: (party: {
    name: string;
    type: "supplier" | "agency" | "buyer";
    phone?: string | undefined;
    credit_days?: number | undefined;
  }) => Promise<Party>;
}

export function NewLoadWizard({
  parties,
  settings,
  settingsError,
  initialDraft,
  onClose,
  onSubmit,
  onAddParty,
}: NewLoadWizardProps) {
  const [draft, setDraft] = useState<NewLoadDraft>(() => {
    if (initialDraft) {
      return {
        ...getInitialDraft(),
        ...initialDraft,
      };
    }
    const saved = loadSavedDraft() ?? getInitialDraft();
    if (typeof window !== "undefined") {
      const stepParam = parseInt(new URLSearchParams(window.location.search).get("step") ?? "");
      if (stepParam && stepParam >= 1 && stepParam <= 3) {
        return {
          ...saved,
          step: stepParam,
          has_sale: stepParam === 3 ? true : saved.has_sale,
        };
      }
    }
    return saved;
  });

  const [addPartyOpen, setAddPartyOpen] = useState(false);
  const [addPartyType, setAddPartyType] = useState<"supplier" | "agency" | "buyer">("supplier");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic GST rates from settings - NO hardcoded fallback
  const gstRates = useMemo(
    () => ({
      gst_rate_coal: settings ? settings.gst_rate_coal : 0,
      gst_rate_briquette: settings ? settings.gst_rate_briquette : 0,
    }),
    [settings],
  );

  // Filter parties by category
  const suppliers = useMemo(() => parties.filter((p) => p.type === "supplier"), [parties]);
  const agencies = useMemo(() => parties.filter((p) => p.type === "agency"), [parties]);
  const buyers = useMemo(() => parties.filter((p) => p.type === "buyer"), [parties]);

  // Persist draft on any change
  useEffect(() => {
    saveLoadDraft(draft);
  }, [draft]);

  // Auto-sync tons_loaded with tons_bought if tons_loaded is empty or unset
  const handleTonsBoughtChange = (val: string) => {
    setDraft((prev) => ({
      ...prev,
      tons_bought: val,
      tons_loaded:
        prev.tons_loaded === "" || prev.tons_loaded === prev.tons_bought ? val : prev.tons_loaded,
    }));
  };

  // When buyer is selected, default credit days to buyer's setting
  const handleBuyerChange = (buyerId: string) => {
    const buyer = buyers.find((b) => b.id === buyerId);
    setDraft((prev) => ({
      ...prev,
      buyer_id: buyerId,
      credit_days: buyer?.credit_days
        ? String(buyer.credit_days)
        : String(settings?.default_credit_days ?? 30),
    }));
  };

  // Live Calculations computation
  const liveCalc = useMemo(() => {
    const tonsBought = parseFloat(draft.tons_bought) || 0;
    const buyRate = parseFloat(draft.buy_rate) || 0;
    const tonsLoaded = parseFloat(draft.tons_loaded) || tonsBought;
    const freightRate = parseFloat(draft.freight_rate) || 0;

    let tonsReceived: number | null = null;
    let saleRate: number | null = null;

    if (draft.has_sale) {
      tonsReceived = parseFloat(draft.tons_received);
      if (isNaN(tonsReceived)) tonsReceived = null;
      saleRate = parseFloat(draft.sale_rate);
      if (isNaN(saleRate)) saleRate = null;
    }

    return computeLoadFigures(
      {
        material: draft.material,
        tons_bought: tonsBought,
        buy_rate: buyRate,
        tons_loaded: tonsLoaded,
        freight_rate: freightRate,
        tons_received: tonsReceived,
        sale_rate: saleRate,
      },
      gstRates,
    );
  }, [draft, gstRates]);

  // Auto-match buyer from challan if buyer_name is provided
  useEffect(() => {
    if (draft.buyer_name && !draft.buyer_id && buyers.length > 0) {
      const match = buyers.find(
        (b) => b.name.trim().toLowerCase() === draft.buyer_name?.trim().toLowerCase(),
      );
      if (match) {
        setDraft((p) => ({
          ...p,
          buyer_id: match.id,
          credit_days: match.credit_days ? String(match.credit_days) : p.credit_days,
        }));
      }
    }
  }, [draft.buyer_name, draft.buyer_id, buyers]);

  // Step Navigations
  const canGoToTruck = useMemo(() => {
    return (
      !!settings &&
      !settingsError &&
      draft.load_date !== "" &&
      draft.supplier_id !== "" &&
      parseFloat(draft.tons_bought) > 0 &&
      parseFloat(draft.buy_rate) > 0
    );
  }, [draft, settings, settingsError]);

  const canGoToSale = useMemo(() => {
    return (
      canGoToTruck &&
      draft.agency_id !== "" &&
      draft.truck_number.trim() !== "" &&
      parseFloat(draft.tons_loaded) > 0 &&
      parseFloat(draft.freight_rate) >= 0
    );
  }, [canGoToTruck, draft]);

  const handleNextStep = () => {
    if (draft.step === 1 && canGoToTruck) {
      setDraft((p) => ({ ...p, step: 2 }));
    } else if (draft.step === 2 && canGoToSale) {
      setDraft((p) => ({ ...p, step: 3 }));
    }
  };

  const handlePrevStep = () => {
    if (draft.step > 1) {
      setDraft((p) => ({ ...p, step: p.step - 1 }));
    }
  };

  const handleSaveLoad = async (withSale: boolean) => {
    if (!canGoToSale) return;

    try {
      setIsSubmitting(true);
      const newLoad: TablesInsert<"loads"> = {
        load_date: draft.load_date,
        material: draft.material,
        supplier_id: draft.supplier_id,
        tons_bought: parseFloat(draft.tons_bought),
        buy_rate: parseFloat(draft.buy_rate),
        agency_id: draft.agency_id,
        truck_number: draft.truck_number.trim().toUpperCase(),
        tons_loaded: parseFloat(draft.tons_loaded),
        freight_rate: parseFloat(draft.freight_rate),
        buyer_id: withSale && draft.buyer_id ? draft.buyer_id : null,
        sale_date: withSale && draft.sale_date ? draft.sale_date : null,
        tons_received: withSale && draft.tons_received ? parseFloat(draft.tons_received) : null,
        sale_rate: withSale && draft.sale_rate ? parseFloat(draft.sale_rate) : null,
        credit_days: withSale && draft.credit_days ? parseInt(draft.credit_days) : null,
      };

      await onSubmit(newLoad);
      clearLoadDraft();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenAddParty = (type: "supplier" | "agency" | "buyer") => {
    setAddPartyType(type);
    setAddPartyOpen(true);
  };

  const handleCreatedParty = async (partyData: {
    name: string;
    type: "supplier" | "agency" | "buyer";
    phone?: string | undefined;
    credit_days?: number | undefined;
  }) => {
    const created = await onAddParty(partyData);
    if (partyData.type === "supplier") {
      setDraft((p) => ({ ...p, supplier_id: created.id }));
    } else if (partyData.type === "agency") {
      setDraft((p) => ({ ...p, agency_id: created.id }));
    } else if (partyData.type === "buyer") {
      setDraft((p) => ({
        ...p,
        buyer_id: created.id,
        credit_days: created.credit_days ? String(created.credit_days) : p.credit_days,
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background safe-bottom safe-top">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={draft.step > 1 ? handlePrevStep : onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted touch-target"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-base font-bold">New Load Entry</h2>
            <p className="text-xs text-muted-foreground">
              Step {draft.step} of 3:{" "}
              {draft.step === 1 ? "Purchase" : draft.step === 2 ? "Truck & Freight" : "Sale"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground p-2"
        >
          Cancel
        </button>
      </div>

      {/* Step Indicator Progress Bar */}
      <div className="grid grid-cols-3 gap-1 px-4 py-2 bg-muted/30">
        <div className={`h-1.5 rounded-full ${draft.step >= 1 ? "bg-primary" : "bg-border"}`} />
        <div className={`h-1.5 rounded-full ${draft.step >= 2 ? "bg-primary" : "bg-border"}`} />
        <div className={`h-1.5 rounded-full ${draft.step >= 3 ? "bg-primary" : "bg-border"}`} />
      </div>

      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-36">
        {draft.challan_no && (
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3.5 flex items-center justify-between text-xs shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-700 dark:text-blue-300 shrink-0">
                <FileCheck2 className="h-4 w-4" />
              </div>
              <div>
                <p className="font-black text-blue-900 dark:text-blue-200">
                  Note: Pre-filled from Delivery Challan {draft.challan_no}
                </p>
                <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80">
                  Truck ({draft.truck_number || "---"}) and Buyer ({draft.buyer_name || "---"})
                  pre-loaded.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full">
              Challan Mode
            </span>
          </div>
        )}
        {(!settings || !!settingsError) && (
          <QueryErrorState
            error={settingsError ?? "Database setup is incomplete. Settings row missing."}
            title="Cannot enter load: Database settings missing"
          />
        )}
        {/* STEP 1: PURCHASE */}
        {draft.step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                1. Purchase Information
              </span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {draft.material === "coal"
                  ? `Coal (${gstRates.gst_rate_coal}% GST)`
                  : `Briquette (${gstRates.gst_rate_briquette}% GST)`}
              </span>
            </div>

            {/* Material Selector */}
            <div className="space-y-1.5">
              <Label>Material</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={draft.material === "coal" ? "default" : "outline"}
                  onClick={() => setDraft((p) => ({ ...p, material: "coal" }))}
                  className="min-h-12 text-base font-semibold"
                >
                  Coal ({gstRates.gst_rate_coal}% GST)
                </Button>
                <Button
                  type="button"
                  variant={draft.material === "briquette" ? "default" : "outline"}
                  onClick={() => setDraft((p) => ({ ...p, material: "briquette" }))}
                  className="min-h-12 text-base font-semibold"
                >
                  Briquette ({gstRates.gst_rate_briquette}% GST)
                </Button>
              </div>
            </div>

            {/* Purchase Date */}
            <div className="space-y-1.5">
              <Label htmlFor="purchase-date">Purchase Date</Label>
              <Input
                id="purchase-date"
                type="date"
                value={draft.load_date}
                onChange={(e) => setDraft((p) => ({ ...p, load_date: e.target.value }))}
                required
                className="min-h-12 text-base"
              />
            </div>

            {/* Supplier Selector with + Add New */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="supplier-select">Supplier (Bought From)</Label>
                <button
                  type="button"
                  onClick={() => handleOpenAddParty("supplier")}
                  className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" /> Add Supplier
                </button>
              </div>
              <select
                id="supplier-select"
                value={draft.supplier_id}
                onChange={(e) => setDraft((p) => ({ ...p, supplier_id: e.target.value }))}
                className="w-full min-h-12 rounded-md border border-input bg-background px-3 py-2 text-base focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `(${s.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Tons Bought & Buy Rate */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tons-bought">Tons Bought (t)</Label>
                <Input
                  id="tons-bought"
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min="0.001"
                  placeholder="e.g. 22.000"
                  value={draft.tons_bought}
                  onChange={(e) => handleTonsBoughtChange(e.target.value)}
                  required
                  className="min-h-12 text-lg font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="buy-rate">Buy Rate (₹/t)</Label>
                <Input
                  id="buy-rate"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 7000"
                  value={draft.buy_rate}
                  onChange={(e) => setDraft((p) => ({ ...p, buy_rate: e.target.value }))}
                  required
                  className="min-h-12 text-lg font-semibold"
                />
              </div>
            </div>

            {/* Purchase Live Bill Summary */}
            {liveCalc.purchase_amount > 0 && (
              <div className="rounded-lg border border-border bg-card p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Base Purchase Amount:</span>
                  <span className="font-semibold text-foreground">
                    {formatINR(liveCalc.purchase_amount)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST ({liveCalc.gst_rate}%):</span>
                  <span className="font-semibold text-foreground">
                    {formatINR(liveCalc.purchase_gst)}
                  </span>
                </div>
                {liveCalc.purchase_tcs > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>TCS ({liveCalc.tcs_rate}% on Coal):</span>
                    <span className="font-semibold text-foreground">
                      {formatINR(liveCalc.purchase_tcs)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1.5 text-sm font-bold">
                  <span>Supplier Bill Total:</span>
                  <span className="text-primary">{formatINR(liveCalc.purchase_total)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: TRUCK & FREIGHT */}
        {draft.step === 2 && (
          <div className="space-y-4">
            <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              2. Truck & Freight Details
            </span>

            {/* Truck Number */}
            <div className="space-y-1.5">
              <Label htmlFor="truck-number">Truck Number</Label>
              <Input
                id="truck-number"
                placeholder="e.g. GJ-18-GA-4821"
                value={draft.truck_number}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, truck_number: e.target.value.toUpperCase() }))
                }
                required
                className="min-h-12 text-base font-semibold uppercase tracking-wider"
              />
            </div>

            {/* Transport Agency with + Add New */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="agency-select">Transport Agency</Label>
                <button
                  type="button"
                  onClick={() => handleOpenAddParty("agency")}
                  className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" /> Add Agency
                </button>
              </div>
              <select
                id="agency-select"
                value={draft.agency_id}
                onChange={(e) => setDraft((p) => ({ ...p, agency_id: e.target.value }))}
                className="w-full min-h-12 rounded-md border border-input bg-background px-3 py-2 text-base focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">Select Transport Agency</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.phone ? `(${a.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Tons Loaded & Freight Rate */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tons-loaded">Tons Loaded (t)</Label>
                <Input
                  id="tons-loaded"
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min="0.001"
                  placeholder="Defaults to bought"
                  value={draft.tons_loaded}
                  onChange={(e) => setDraft((p) => ({ ...p, tons_loaded: e.target.value }))}
                  required
                  className="min-h-12 text-lg font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="freight-rate">Freight Rate (₹/t)</Label>
                <Input
                  id="freight-rate"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 1600 (No GST)"
                  value={draft.freight_rate}
                  onChange={(e) => setDraft((p) => ({ ...p, freight_rate: e.target.value }))}
                  required
                  className="min-h-12 text-lg font-semibold"
                />
              </div>
            </div>

            {/* Freight Live Summary */}
            {liveCalc.freight_amount > 0 && (
              <div className="rounded-lg border border-border bg-card p-3 flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Freight (No GST):</span>
                <strong className="text-base font-bold text-foreground">
                  {formatINR(liveCalc.freight_amount)}
                </strong>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: SALE (OPTIONAL) */}
        {draft.step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                3. Sale Details (Optional)
              </span>
              <button
                type="button"
                onClick={() => setDraft((p) => ({ ...p, has_sale: !p.has_sale }))}
                className="text-xs font-semibold text-primary underline"
              >
                {draft.has_sale ? "Skip Sale For Now" : "Record Sale Now"}
              </button>
            </div>

            {!draft.has_sale ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-5 text-center space-y-2">
                <p className="text-sm font-medium">This load is currently unsold stock.</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  You can save this load as unsold inventory now, and record the buyer and sale rate
                  later when delivery is completed.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDraft((p) => ({ ...p, has_sale: true }))}
                  className="mt-2 min-h-12"
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add Sale Details Now
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {/* Prefilled from Delivery Challan Notice */}
                {draft.buyer_name && !draft.buyer_id && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between text-xs shadow-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 block">
                        Customer From Delivery Challan
                      </span>
                      <strong className="text-sm font-black text-foreground">
                        {draft.buyer_name}
                      </strong>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={async () => {
                        const created = await onAddParty({
                          name: draft.buyer_name!,
                          type: "buyer",
                        });
                        setDraft((p) => ({
                          ...p,
                          buyer_id: created.id,
                        }));
                      }}
                      className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add & Select
                    </Button>
                  </div>
                )}

                {/* Buyer Selector with + Add New */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="buyer-select">Buyer (Customer)</Label>
                    <button
                      type="button"
                      onClick={() => handleOpenAddParty("buyer")}
                      className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                    >
                      <Plus className="h-3 w-3" /> Add Buyer
                    </button>
                  </div>
                  <select
                    id="buyer-select"
                    value={draft.buyer_id}
                    onChange={(e) => handleBuyerChange(e.target.value)}
                    className="w-full min-h-12 rounded-md border border-input bg-background px-3 py-2 text-base focus:ring-2 focus:ring-ring"
                    required={draft.has_sale}
                  >
                    <option value="">Select Buyer</option>
                    {buyers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.phone ? `(${b.phone})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sale Date & Credit Days */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sale-date">Sale Date</Label>
                    <Input
                      id="sale-date"
                      type="date"
                      value={draft.sale_date}
                      onChange={(e) => setDraft((p) => ({ ...p, sale_date: e.target.value }))}
                      required={draft.has_sale}
                      className="min-h-12 text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="credit-days">Credit Days</Label>
                    <Input
                      id="credit-days"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={draft.credit_days}
                      onChange={(e) => setDraft((p) => ({ ...p, credit_days: e.target.value }))}
                      required={draft.has_sale}
                      className="min-h-12 text-base font-semibold"
                    />
                  </div>
                </div>

                {/* Tons Received & Sale Rate */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tons-received">Tons Received (t)</Label>
                    <Input
                      id="tons-received"
                      type="number"
                      inputMode="decimal"
                      step="0.001"
                      min="0"
                      placeholder="e.g. 21.500"
                      value={draft.tons_received}
                      onChange={(e) => setDraft((p) => ({ ...p, tons_received: e.target.value }))}
                      required={draft.has_sale}
                      className="min-h-12 text-lg font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="sale-rate">Sale Rate (₹/t)</Label>
                    <Input
                      id="sale-rate"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 9000"
                      value={draft.sale_rate}
                      onChange={(e) => setDraft((p) => ({ ...p, sale_rate: e.target.value }))}
                      required={draft.has_sale}
                      className="min-h-12 text-lg font-semibold"
                    />
                  </div>
                </div>

                {/* Kanta Difference indicator */}
                {liveCalc.shortage_tons !== null &&
                  (() => {
                    const diff = liveCalc.shortage_tons;
                    const diffKg = Math.round(Math.abs(diff) * 1000);
                    const buyRate = parseFloat(draft.buy_rate) || 0;
                    const lossAmount = Math.round(diff * buyRate);

                    if (diff > 0.005) {
                      return (
                        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-200">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                            <span>
                              ⚖️ Weight Shortage:{" "}
                              <strong>
                                {formatTons(diff)} ({diffKg} kg)
                              </strong>
                            </span>
                          </div>
                          <span className="font-black text-destructive">
                            Loss: -{formatINR(lossAmount)}
                          </span>
                        </div>
                      );
                    } else if (diff < -0.005) {
                      return (
                        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-950 dark:text-emerald-200">
                          <span className="font-bold text-emerald-700 dark:text-emerald-300">
                            ⚖️ Weight Gain: +{formatTons(Math.abs(diff))} (+{diffKg} kg Gain)
                          </span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-emerald-600 font-semibold text-center">
                          ⚖️ Exact Weight Match (0 kg Difference)
                        </div>
                      );
                    }
                  })()}

                {/* Sale Invoice Live Bill Summary */}
                {liveCalc.sale_amount !== null && liveCalc.sale_amount > 0 && (
                  <div className="rounded-lg border border-border bg-card p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Base Sale Amount:</span>
                      <span className="font-semibold text-foreground font-mono">
                        {formatINR(liveCalc.sale_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST ({liveCalc.gst_rate}%):</span>
                      <span className="font-semibold text-foreground font-mono">
                        {formatINR(liveCalc.sale_gst ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1.5 text-sm font-bold">
                      <span>Customer Invoice Total:</span>
                      <span className="text-primary font-mono">
                        {formatINR(liveCalc.sale_total ?? 0)}
                      </span>
                    </div>
                    {liveCalc.net_profit !== null && (
                      <div className="border-t border-dashed border-border pt-2 space-y-1 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Gross Margin (Pre-GST):</span>
                          <span className="font-semibold text-foreground font-mono">
                            {formatINR(liveCalc.profit ?? 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Sardarji Commission:</span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">
                            -₹100.00
                          </span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span>Net Trading Profit:</span>
                          <span
                            className={`font-mono ${
                              (liveCalc.net_profit ?? 0) >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-destructive"
                            }`}
                          >
                            {formatINR(liveCalc.net_profit ?? 0)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* STICKY BOTTOM LIVE CALCULATION STRIP & ACTIONS */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-md safe-bottom">
        <div className="mx-auto max-w-lg space-y-2.5">
          {/* Live Strip Summary */}
          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                Cost Basis
              </span>
              <p className="font-bold text-foreground">
                Buy {formatINR(liveCalc.purchase_amount)} + Freight{" "}
                {formatINR(liveCalc.freight_amount)}
              </p>
            </div>

            <div className="text-right space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                {liveCalc.net_profit !== null ? "Net Profit (-₹100 Comm.)" : "Sale Status"}
              </span>
              <p
                className={`text-sm font-extrabold ${
                  liveCalc.net_profit !== null
                    ? liveCalc.net_profit >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {liveCalc.net_profit !== null ? formatINR(liveCalc.net_profit) : "Unsold"}
              </p>
              {liveCalc.profit !== null && (
                <span className="text-[9px] text-muted-foreground block font-medium">
                  Gross: {formatINR(liveCalc.profit)} - ₹100
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {draft.step === 1 && (
              <Button
                type="button"
                disabled={!canGoToTruck}
                onClick={handleNextStep}
                className="min-h-12 flex-1 text-base font-semibold"
              >
                Next: Truck & Freight <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}

            {draft.step === 2 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSaveLoad(false)}
                  disabled={!canGoToSale || isSubmitting}
                  className="min-h-12 flex-1 text-xs sm:text-sm font-semibold"
                >
                  Save as Unsold
                </Button>
                <Button
                  type="button"
                  disabled={!canGoToSale}
                  onClick={handleNextStep}
                  className="min-h-12 flex-1 text-xs sm:text-sm font-semibold"
                >
                  Next: Sale <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </>
            )}

            {draft.step === 3 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSaveLoad(false)}
                  disabled={isSubmitting}
                  className="min-h-12 flex-1 text-xs sm:text-sm font-semibold"
                >
                  Save (Unsold)
                </Button>
                <Button
                  type="button"
                  disabled={
                    isSubmitting ||
                    (draft.has_sale &&
                      (!draft.buyer_id || !draft.tons_received || !draft.sale_rate))
                  }
                  onClick={() => handleSaveLoad(draft.has_sale)}
                  className="min-h-12 flex-1 text-xs sm:text-sm font-semibold"
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  {isSubmitting ? "Saving..." : "Save Load"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Party Inline Dialog */}
      <AddPartyDialog
        open={addPartyOpen}
        onOpenChange={setAddPartyOpen}
        defaultType={addPartyType}
        onPartyCreated={handleCreatedParty}
      />
    </div>
  );
}
