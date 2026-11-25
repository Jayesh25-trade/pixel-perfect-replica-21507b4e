export type Material = "coal" | "briquette";
export type PartyType = "supplier" | "agency" | "buyer";
export type PaymentKind = "purchase" | "freight" | "sale";
export type PaymentMode = "UPI" | "Cheque";

export interface Settings {
  id?: string;
  gst_rate_coal: number;
  gst_rate_briquette: number;
  tcs_rate_purchase?: number;
  default_credit_days: number;
  updated_at?: string;
}

export interface LoadInput {
  material: Material;
  tons_bought: number;
  buy_rate: number;
  tons_loaded: number;
  freight_rate: number;
  tons_received?: number | null;
  sale_rate?: number | null;
  credit_days?: number | null;
}

export interface LoadCalculations {
  purchase_amount: number;
  purchase_gst: number;
  purchase_tcs: number;
  purchase_total: number;
  freight_amount: number;
  sale_amount: number | null;
  sale_gst: number | null;
  sale_total: number | null;
  shortage_tons: number | null;
  profit: number | null;
  profit_per_ton: number | null;
  gst_rate: number;
  tcs_rate: number;
}

/**
 * High-precision rounding helper avoiding float inaccuracies
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function round3(num: number): number {
  return Math.round((num + Number.EPSILON) * 1000) / 1000;
}

/**
 * Computes all authoritative formulas matching the SQL load_details_view
 */
export function computeLoadFigures(
  load: LoadInput,
  settings: {
    gst_rate_coal: number;
    gst_rate_briquette: number;
    tcs_rate_purchase?: number | undefined;
  },
): LoadCalculations {
  const gst_rate = load.material === "coal" ? settings.gst_rate_coal : settings.gst_rate_briquette;
  // 2% TCS applies ONLY to Coal purchase (Section 206C). Briquette and Sale/Freight have strictly NO TCS.
  const tcs_rate = load.material === "coal" ? (settings.tcs_rate_purchase ?? 2.0) : 0;

  const purchase_amount = round2(load.tons_bought * load.buy_rate);
  const purchase_gst = round2(purchase_amount * (gst_rate / 100));
  const purchase_subtotal = round2(purchase_amount + purchase_gst);
  const purchase_tcs = tcs_rate > 0 ? round2(purchase_subtotal * (tcs_rate / 100)) : 0;
  const purchase_total = round2(purchase_subtotal + purchase_tcs);

  const freight_amount = round2(load.tons_loaded * load.freight_rate);

  let sale_amount: number | null = null;
  let sale_gst: number | null = null;
  let sale_total: number | null = null;
  let shortage_tons: number | null = null;
  let profit: number | null = null;
  let profit_per_ton: number | null = null;

  if (
    load.tons_received !== undefined &&
    load.tons_received !== null &&
    load.sale_rate !== undefined &&
    load.sale_rate !== null
  ) {
    sale_amount = round2(load.tons_received * load.sale_rate);
    sale_gst = round2(sale_amount * (gst_rate / 100));
    sale_total = round2(sale_amount + sale_gst);

    shortage_tons = round3(load.tons_bought - load.tons_received);
    // PROFIT (before GST) = sale_amount − purchase_amount − freight_amount
    profit = round2(sale_amount - purchase_amount - freight_amount);
    profit_per_ton = load.tons_received > 0 ? round2(profit / load.tons_received) : null;
  }

  return {
    purchase_amount,
    purchase_gst,
    purchase_tcs,
    purchase_total,
    freight_amount,
    sale_amount,
    sale_gst,
    sale_total,
    shortage_tons,
    profit,
    profit_per_ton,
    gst_rate,
    tcs_rate,
  };
}

/**
 * Validates whether a new payment exceeds the remaining bill total.
 * Returns true if valid, or an error message string if invalid.
 */
export function validatePaymentCap(params: {
  bill_total: number;
  existing_payments: number;
  new_payment: number;
}): { valid: boolean; error?: string } {
  const remaining = round2(params.bill_total - params.existing_payments);
  if (round2(params.new_payment) > remaining) {
    return {
      valid: false,
      error: `Payment of ${formatINR(params.new_payment)} exceeds the remaining balance of ${formatINR(remaining)} (Bill total: ${formatINR(params.bill_total)}).`,
    };
  }
  return { valid: true };
}

/**
 * Formats a number to Indian currency format: ₹1,54,000 or ₹1,54,000.50
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "₹0";
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const fixed = abs.toFixed(2);
  const [intPart, decPart] = fixed.split(".");

  // Indian numbering: last 3 digits, then groups of 2
  let lastThree = intPart!.slice(-3);
  const otherNumbers = intPart!.slice(0, -3);
  if (otherNumbers !== "") {
    lastThree = "," + lastThree;
  }
  const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;

  const result = decPart === "00" ? formattedInt : `${formattedInt}.${decPart}`;
  return `${isNegative ? "-" : ""}₹${result}`;
}

/**
 * Formats tons: 22 t or 21.5 t
 */
export function formatTons(tons: number | null | undefined): string {
  if (tons === null || tons === undefined || isNaN(tons)) return "0 t";
  // Remove unnecessary trailing zeroes
  const formatted = Number(tons.toFixed(3));
  return `${formatted} t`;
}

/**
 * Formats date as '12 Jan 2026'
 */
export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "-";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Calculates due date given sale_date and credit_days
 */
export function calculateDueDate(saleDate: string, creditDays: number): string {
  const d = new Date(saleDate);
  d.setDate(d.getDate() + creditDays);
  return d.toISOString().split("T")[0]!;
}

/**
 * Checks if a sale payment is overdue
 */
export function checkIsOverdue(
  salePending: number,
  dueDateStr: string | null | undefined,
  todayStr?: string,
): boolean {
  if (salePending <= 0 || !dueDateStr) return false;
  const today = todayStr ? new Date(todayStr) : new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  return due < today;
}
