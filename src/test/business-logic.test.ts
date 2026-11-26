import { describe, expect, it } from "vitest";
import {
  computeLoadFigures,
  validatePaymentCap,
  formatINR,
  formatTons,
  formatDate,
  calculateDueDate,
  checkIsOverdue,
} from "@/lib/calculations";

describe("Business Logic & Financial Formulas", () => {
  const settings = {
    gst_rate_coal: 18,
    gst_rate_briquette: 5,
    tcs_rate_purchase: 2,
  };

  /**
   * TEST CASE 1:
   * 22 t × ₹7,000 purchase, 22 t × ₹1,600 freight, 22 t × ₹9,000 sale → profit ₹8,800.
   * Coal has 18% GST and 2% TCS on purchase invoice total.
   * Sale has 18% GST and strictly NO TCS. Freight has 0% GST and NO TCS.
   */
  it("Test Case 1: 22t Coal full delivery profit calculation", () => {
    const load = {
      material: "coal" as const,
      tons_bought: 22,
      buy_rate: 7000,
      tons_loaded: 22,
      freight_rate: 1600,
      tons_received: 22,
      sale_rate: 9000,
    };

    const result = computeLoadFigures(load, settings);

    expect(result.purchase_amount).toBe(154000); // 22 * 7000
    expect(result.purchase_gst).toBe(27720); // 154000 * 18%
    expect(result.purchase_tcs).toBe(3634.4); // (154000 + 27720) * 2%
    expect(result.purchase_total).toBe(185354.4); // 181720 + 3634.40
    expect(result.freight_amount).toBe(35200); // 22 * 1600 (strictly NO GST, NO TCS)
    expect(result.sale_amount).toBe(198000); // 22 * 9000
    expect(result.sale_gst).toBe(35640); // 198000 * 18%
    expect(result.sale_total).toBe(233640); // 198000 + 35640 (strictly NO TCS)
    expect(result.shortage_tons).toBe(0);
    // PROFIT (before GST) = sale_amount − purchase_amount − freight_amount
    // 198000 - 154000 - 35200 = 8800
    // Parity assertion with SQL view load_details_view
    expect(result.profit?.toFixed(2)).toBe("8800.00");
    // Sardarji Commission is ₹100 per ton on sold weight (22t * 100 = 2200)
    expect(result.sardarji_commission).toBe(2200);
    expect(result.net_profit?.toFixed(2)).toBe("6600.00");
    expect(result.net_profit_per_ton?.toFixed(2)).toBe("300.00");
    expect(result.sale_amount?.toFixed(2)).toBe("198000.00");
    expect(result.shortage_tons?.toFixed(3)).toBe("0.000");
  });

  /**
   * TEST CASE 2:
   * Same load but 21.5 t received → sale ₹1,93,500, profit ₹4,300, shortage 0.5 t.
   */
  it("Test Case 2: 21.5t received with 0.5t shortage", () => {
    const load = {
      material: "coal" as const,
      tons_bought: 22,
      buy_rate: 7000,
      tons_loaded: 22,
      freight_rate: 1600,
      tons_received: 21.5,
      sale_rate: 9000,
    };

    const result = computeLoadFigures(load, settings);

    expect(result.purchase_amount).toBe(154000);
    expect(result.freight_amount).toBe(35200);
    expect(result.sale_amount).toBe(193500); // 21.5 * 9000
    expect(result.shortage_tons).toBe(0.5); // 22 - 21.5
    // Parity assertion with SQL view load_details_view
    expect(result.sale_amount?.toFixed(2)).toBe("193500.00");
    expect(result.profit?.toFixed(2)).toBe("4300.00");
    // 21.5t * 100 = 2150 commission
    expect(result.sardarji_commission).toBe(2150);
    expect(result.net_profit?.toFixed(2)).toBe("2150.00");
    expect(result.net_profit_per_ton?.toFixed(2)).toBe("100.00");
    expect(result.shortage_tons?.toFixed(3)).toBe("0.500");
    expect(result.profit_per_ton?.toFixed(2)).toBe("200.00");
  });

  /**
   * TEST CASE 3:
   * Briquette purchase of ₹1,54,000 → GST 5% ₹7,700, strictly NO TCS → total ₹1,61,700.00.
   * Coal purchase of ₹1,54,000 → GST 18% ₹27,720, TCS 2% ₹3,634.40 → total ₹1,85,354.40.
   */
  it("Test Case 3: GST difference between Briquette (5%, no TCS) and Coal (18% + 2% TCS)", () => {
    // Briquette
    const briquetteLoad = {
      material: "briquette" as const,
      tons_bought: 22,
      buy_rate: 7000, // 22 * 7000 = 1,54,000
      tons_loaded: 22,
      freight_rate: 1600,
    };
    const briquetteRes = computeLoadFigures(briquetteLoad, settings);
    expect(briquetteRes.purchase_amount).toBe(154000);
    expect(briquetteRes.purchase_gst.toFixed(2)).toBe("7700.00");
    expect(briquetteRes.purchase_tcs).toBe(0); // Strictly NO TCS on briquettes
    expect(briquetteRes.purchase_total.toFixed(2)).toBe("161700.00");

    // Coal
    const coalLoad = {
      material: "coal" as const,
      tons_bought: 22,
      buy_rate: 7000,
      tons_loaded: 22,
      freight_rate: 1600,
    };
    const coalRes = computeLoadFigures(coalLoad, settings);
    expect(coalRes.purchase_amount).toBe(154000);
    expect(coalRes.purchase_gst.toFixed(2)).toBe("27720.00");
    expect(coalRes.purchase_tcs.toFixed(2)).toBe("3634.40"); // 2% TCS on Coal
    expect(coalRes.purchase_total.toFixed(2)).toBe("185354.40");
  });

  /**
   * Unsold Load (Sale step skipped / pending)
   */
  it("Handles unsold load where sale is not yet entered", () => {
    const unsoldLoad = {
      material: "coal" as const,
      tons_bought: 25,
      buy_rate: 6500,
      tons_loaded: 25,
      freight_rate: 1500,
      tons_received: null,
      sale_rate: null,
    };

    const res = computeLoadFigures(unsoldLoad, settings);
    expect(res.purchase_amount).toBe(162500);
    expect(res.freight_amount).toBe(37500);
    expect(res.sale_amount).toBeNull();
    expect(res.profit).toBeNull();
    expect(res.shortage_tons).toBeNull();
  });

  /**
   * Overpayment Validation Trigger Logic
   */
  it("Rejects payment exceeding bill balance and permits valid partial payments", () => {
    const billTotal = 181720;
    const existingPayments = 150000;

    // Remaining is 31720
    // Try to pay 31721 -> should reject
    const overResult = validatePaymentCap({
      bill_total: billTotal,
      existing_payments: existingPayments,
      new_payment: 31721,
    });
    expect(overResult.valid).toBe(false);
    expect(overResult.error).toBeDefined();

    // Try to pay exactly 31720 -> should pass
    const exactResult = validatePaymentCap({
      bill_total: billTotal,
      existing_payments: existingPayments,
      new_payment: 31720,
    });
    expect(exactResult.valid).toBe(true);

    // Try to pay partial 20000 -> should pass
    const partialResult = validatePaymentCap({
      bill_total: billTotal,
      existing_payments: existingPayments,
      new_payment: 20000,
    });
    expect(partialResult.valid).toBe(true);
  });

  /**
   * Formatting tests
   */
  it("Formats Indian Currency, Tons, and Dates correctly", () => {
    expect(formatINR(154000)).toBe("₹1,54,000");
    expect(formatINR(181720.5)).toBe("₹1,81,720.50");
    expect(formatINR(0)).toBe("₹0");
    expect(formatINR(-5000)).toBe("-₹5,000");

    expect(formatTons(22)).toBe("22 t");
    expect(formatTons(21.5)).toBe("21.5 t");
    expect(formatTons(0.5)).toBe("0.5 t");

    expect(formatDate("2026-01-12")).toBe("12 Jan 2026");
  });

  /**
   * Due date and Overdue tests
   */
  it("Calculates due dates and detects overdue pending amounts correctly", () => {
    const saleDate = "2026-01-01";
    const dueDate = calculateDueDate(saleDate, 30);
    expect(dueDate).toBe("2026-01-31");

    // Overdue when salePending > 0 and dueDate < today
    expect(checkIsOverdue(50000, "2026-01-31", "2026-02-15")).toBe(true);

    // Not overdue if fully paid
    expect(checkIsOverdue(0, "2026-01-31", "2026-02-15")).toBe(false);

    // Not overdue if dueDate is in the future
    expect(checkIsOverdue(50000, "2026-03-31", "2026-02-15")).toBe(false);
  });
});
