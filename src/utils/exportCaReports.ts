import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { LoadDetail } from "@/hooks/use-load-accounts";
import { formatTons, formatDate } from "@/lib/calculations";
import { ensureRobotoFonts } from "./pdfFontLoader";

/**
 * Format currency with Indian grouping and exactly 2 decimal places.
 * Example: 463032 -> "₹4,63,032.00", -9378 -> "-₹9,378.00"
 */
export function formatINR2(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "₹0.00";
  const isNegative = amount < 0;
  const abs = Math.abs(amount).toFixed(2);
  const parts = abs.split(".");
  const intPart = parts[0] ?? "0";
  const decPart = parts[1] ?? "00";
  const lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  const formattedInt =
    otherNumbers !== ""
      ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
      : lastThree;
  return `${isNegative ? "-" : ""}₹${formattedInt}.${decPart}`;
}

export function exportLoadsToExcel(loads: LoadDetail[], title = "Complete CA Register") {
  const headers = [
    "Sr No",
    "Load Date",
    "Truck Number",
    "Material",
    "Supplier Name",
    "Tons Bought (MT)",
    "Buy Rate (Rs/t)",
    "Purchase Value (Rs)",
    "Input GST Rate (%)",
    "Input GST Amount (Rs)",
    "TCS Rate (%)",
    "TCS Amount (Rs)",
    "Total Supplier Bill (Rs)",
    "Paid to Supplier (Rs)",
    "Pending to Supplier (Rs)",
    "Transport Agency",
    "Freight Rate (Rs/t)",
    "Total Freight (Rs)",
    "Freight Paid (Rs)",
    "Freight Pending (Rs)",
    "Buyer / Customer Name",
    "Sale Date",
    "Tons Received (MT)",
    "Sale Rate (Rs/t)",
    "Sale Value (Rs)",
    "Output GST Rate (%)",
    "Output GST Amount (Rs)",
    "Total Customer Bill (Rs)",
    "Received from Buyer (Rs)",
    "Pending from Buyer (Rs)",
    "Kanta Shortage (kg)",
    "Gross Trading Margin (Rs)",
    "Sardarji Commission (Rs)",
    "Net Trading Profit (Rs)",
  ];

  let sumBought = 0;
  let sumPurchase = 0;
  let sumInputGst = 0;
  let sumTcs = 0;
  let sumSupplierBill = 0;
  let sumSupplierPaid = 0;
  let sumSupplierPending = 0;
  let sumFreight = 0;
  let sumFreightPaid = 0;
  let sumFreightPending = 0;
  let sumReceived = 0;
  let sumSale = 0;
  let sumOutputGst = 0;
  let sumCustomerBill = 0;
  let sumBuyerPaid = 0;
  let sumBuyerPending = 0;
  let sumGrossProfit = 0;
  let sumSardarjiComm = 0;
  let sumNetProfit = 0;

  const rows = loads.map((l, idx) => {
    const tonsBought = Number(l.tons_bought ?? 0);
    const buyRate = Number(l.buy_rate ?? 0);
    const purchaseAmount = Number(l.purchase_amount ?? tonsBought * buyRate);
    const gstRate = Number(l.gst_rate ?? (l.material === "coal" ? 18 : 5));
    const inputGst = Number(l.purchase_gst ?? (purchaseAmount * gstRate) / 100);
    const tcsRate = l.material === "coal" ? 2 : 0;
    const tcsAmount = l.material === "coal" ? (purchaseAmount + inputGst) * 0.02 : 0;
    const totalSupplierBill = Number(l.purchase_total ?? purchaseAmount + inputGst + tcsAmount);
    const supplierPaid = Number(l.purchase_paid ?? 0);
    const supplierPending = Number(l.purchase_pending ?? totalSupplierBill - supplierPaid);

    const freightRate = Number(l.freight_rate ?? 0);
    const freightAmount = Number(l.freight_amount ?? tonsBought * freightRate);
    const freightPaid = Number(l.freight_paid ?? 0);
    const freightPending = Number(l.freight_pending ?? freightAmount - freightPaid);

    const tonsReceived = Number(l.tons_received ?? 0);
    const saleRate = Number(l.sale_rate ?? 0);
    const saleAmount = Number(l.sale_amount ?? tonsReceived * saleRate);
    const outputGst = Number(l.sale_gst ?? (saleAmount * gstRate) / 100);
    const totalCustomerBill = Number(l.sale_total ?? saleAmount + outputGst);
    const buyerPaid = Number(l.sale_paid ?? 0);
    const buyerPending = Number(l.sale_pending ?? totalCustomerBill - buyerPaid);

    const shortageKg = Math.round((tonsBought - tonsReceived) * 1000);
    const grossProfit = Number(l.profit ?? saleAmount - purchaseAmount - freightAmount);
    // Sardarji commission of ₹100 per ton on sold weight
    const soldTons = tonsReceived > 0 ? tonsReceived : tonsBought;
    const sardarjiComm = l.sale_date ? Math.round(soldTons * 100 * 100) / 100 : 0;
    const netProfit = l.sale_date ? grossProfit - sardarjiComm : 0;

    sumBought += tonsBought;
    sumPurchase += purchaseAmount;
    sumInputGst += inputGst;
    sumTcs += tcsAmount;
    sumSupplierBill += totalSupplierBill;
    sumSupplierPaid += supplierPaid;
    sumSupplierPending += supplierPending;
    sumFreight += freightAmount;
    sumFreightPaid += freightPaid;
    sumFreightPending += freightPending;
    sumReceived += tonsReceived;
    sumSale += saleAmount;
    sumOutputGst += outputGst;
    sumCustomerBill += totalCustomerBill;
    sumBuyerPaid += buyerPaid;
    sumBuyerPending += buyerPending;
    sumGrossProfit += grossProfit;
    sumSardarjiComm += sardarjiComm;
    sumNetProfit += netProfit;

    return [
      idx + 1,
      l.load_date,
      l.truck_number,
      l.material.toUpperCase(),
      `"${(l.supplier_name ?? "").replace(/"/g, '""')}"`,
      tonsBought.toFixed(3),
      buyRate.toFixed(2),
      purchaseAmount.toFixed(2),
      `${gstRate}%`,
      inputGst.toFixed(2),
      `${tcsRate}%`,
      tcsAmount.toFixed(2),
      totalSupplierBill.toFixed(2),
      supplierPaid.toFixed(2),
      supplierPending.toFixed(2),
      `"${(l.agency_name ?? "").replace(/"/g, '""')}"`,
      freightRate.toFixed(2),
      freightAmount.toFixed(2),
      freightPaid.toFixed(2),
      freightPending.toFixed(2),
      `"${(l.buyer_name ?? "Unsold").replace(/"/g, '""')}"`,
      l.sale_date ?? "In Stock",
      tonsReceived > 0 ? tonsReceived.toFixed(3) : "0",
      saleRate.toFixed(2),
      saleAmount.toFixed(2),
      l.sale_date ? `${gstRate}%` : "0%",
      outputGst.toFixed(2),
      totalCustomerBill.toFixed(2),
      buyerPaid.toFixed(2),
      buyerPending.toFixed(2),
      shortageKg,
      grossProfit.toFixed(2),
      sardarjiComm.toFixed(2),
      netProfit.toFixed(2),
    ];
  });

  const totalsRow = [
    "TOTAL",
    "-",
    `${loads.length} Loads`,
    "-",
    "-",
    sumBought.toFixed(3),
    "-",
    sumPurchase.toFixed(2),
    "-",
    sumInputGst.toFixed(2),
    "-",
    sumTcs.toFixed(2),
    sumSupplierBill.toFixed(2),
    sumSupplierPaid.toFixed(2),
    sumSupplierPending.toFixed(2),
    "-",
    "-",
    sumFreight.toFixed(2),
    sumFreightPaid.toFixed(2),
    sumFreightPending.toFixed(2),
    "-",
    "-",
    sumReceived.toFixed(3),
    "-",
    sumSale.toFixed(2),
    "-",
    sumOutputGst.toFixed(2),
    sumCustomerBill.toFixed(2),
    sumBuyerPaid.toFixed(2),
    sumBuyerPending.toFixed(2),
    "-",
    sumGrossProfit.toFixed(2),
    sumSardarjiComm.toFixed(2),
    sumNetProfit.toFixed(2),
  ];

  const metadata = [
    `"AARAV TRADERS - MONTHLY TRADING & GST REGISTER (CA REPORT)"`,
    `"Period / Scope: ${title} · Generated on: ${new Date().toLocaleString("en-IN")}"`,
    `"GSTIN: 27AKIPM5661P1ZE · Shegaon, Dist. Buldhana, Maharashtra"`,
    "",
  ];

  const csvContent =
    "\uFEFF" +
    [...metadata, headers.join(","), ...rows.map((r) => r.join(",")), totalsRow.join(",")].join(
      "\r\n",
    );

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, "_");
  link.setAttribute("href", url);
  link.setAttribute("download", `Aarav_Traders_CA_Report_${cleanTitle}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Big-4 / Corporate CA Grade PDF Generator for Aarav Traders
 */
export async function exportLoadsToPdf(loads: LoadDetail[], title = "Complete CA Register") {
  const doc = new jsPDF("l", "mm", "a4"); // A4 Landscape: 297mm x 210mm
  const pageW = 297;
  const pageH = 210;
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR; // 267mm

  // Ensure Roboto font with full Indian Rupee (₹) Unicode glyph support is loaded
  const fontLoaded = await ensureRobotoFonts(doc);
  const activeFont = fontLoaded ? "Roboto" : "helvetica";

  // Palette: Big-4 / Executive strict colour system
  const cNavy: [number, number, number] = [11, 37, 69]; // #0B2545
  const cText: [number, number, number] = [31, 41, 55]; // #1F2937
  const cMuted: [number, number, number] = [107, 114, 128]; // #6B7280
  const cBorder: [number, number, number] = [229, 231, 235]; // #E5E7EB
  const cZebra: [number, number, number] = [249, 250, 251]; // #F9FAFB
  const cLightNavy: [number, number, number] = [238, 242, 247]; // #EEF2F7
  const cProfit: [number, number, number] = [15, 123, 62]; // #0F7B3E
  const cLoss: [number, number, number] = [185, 28, 28]; // #B91C1C

  // Aggregate Metrics
  let totalTonsBought = 0;
  let totalTonsSold = 0;
  let totalPurchaseVal = 0;
  let totalInputGst = 0;
  let totalTcs = 0;
  let totalSupplierBill = 0;
  let totalFreightVal = 0;
  let totalSaleVal = 0;
  let totalOutputGst = 0;
  let totalCustomerBill = 0;
  let totalGrossProfit = 0;
  let totalSardarjiComm = 0;
  let totalNetProfit = 0;

  loads.forEach((l) => {
    const tonsB = Number(l.tons_bought ?? 0);
    const buyR = Number(l.buy_rate ?? 0);
    const purch = Number(l.purchase_amount ?? tonsB * buyR);
    const gstR = Number(l.gst_rate ?? (l.material === "coal" ? 18 : 5));
    const inGst = Number(l.purchase_gst ?? (purch * gstR) / 100);
    const tcs = l.material === "coal" ? (purch + inGst) * 0.02 : 0;
    const supBill = Number(l.purchase_total ?? purch + inGst + tcs);
    const freight = Number(l.freight_amount ?? tonsB * Number(l.freight_rate ?? 0));
    const tonsS = Number(l.tons_received ?? 0);
    const saleR = Number(l.sale_rate ?? 0);
    const sale = Number(l.sale_amount ?? tonsS * saleR);
    const outGst = Number(l.sale_gst ?? (sale * gstR) / 100);
    const custBill = Number(l.sale_total ?? sale + outGst);
    const grossProfit = Number(l.profit ?? sale - purch - freight);
    const soldTons = tonsS > 0 ? tonsS : tonsB;
    const sardarjiComm = l.sale_date ? Math.round(soldTons * 100 * 100) / 100 : 0;
    const netProfit = l.sale_date ? grossProfit - sardarjiComm : 0;

    totalTonsBought += tonsB;
    totalTonsSold += tonsS;
    totalPurchaseVal += purch;
    totalInputGst += inGst;
    totalTcs += tcs;
    totalSupplierBill += supBill;
    totalFreightVal += freight;
    totalSaleVal += sale;
    totalOutputGst += outGst;
    totalCustomerBill += custBill;
    totalGrossProfit += grossProfit;
    totalSardarjiComm += sardarjiComm;
    totalNetProfit += netProfit;
  });

  const netGstPayable = totalOutputGst - totalInputGst;

  // 1. Draw Header Band on Page 1
  let y = 14;

  // Small blessing on top left
  doc.setFont(activeFont, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...cMuted);
  doc.text("|| Jai Gajanan ||", marginL, y);

  // GSTIN top right
  doc.setFont(activeFont, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...cNavy);
  doc.text("GSTIN: 27AKIPM5661P1ZE", pageW - marginR, y, { align: "right" });

  y += 5.5;

  // Firm Name (Bold Navy, 20pt)
  doc.setFont(activeFont, "bold");
  doc.setFontSize(20);
  doc.setTextColor(...cNavy);
  doc.text("AARAV TRADERS", marginL, y);

  // Document Title (Right)
  doc.setFontSize(12);
  doc.text("Monthly CA Trading & Tax Register", pageW - marginR, y, { align: "right" });

  y += 5;

  // Firm Address & Scope (Right)
  doc.setFont(activeFont, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...cMuted);
  doc.text(
    "Shop No. 11, APMC Market, Shegaon - 444203, Maharashtra · Mob: 9881125511 / 7020709696",
    marginL,
    y,
  );
  doc.text(`Scope: ${title} · Date: ${formatDate(new Date())}`, pageW - marginR, y, {
    align: "right",
  });

  y += 4;

  // Thin navy divider line (1.5pt = ~0.53mm)
  doc.setDrawColor(...cNavy);
  doc.setLineWidth(0.53);
  doc.line(marginL, y, pageW - marginR, y);

  y += 6;

  // 2. Key Metrics Row (4 Equal Corporate Cards)
  // White card, 1px light-grey border (#E5E7EB), 4px navy left accent (#0B2545)
  const gap = 3.5;
  const cardW = (contentW - gap * 3) / 4; // ~64mm each
  const cardH = 18;

  const cardsData = [
    {
      label: "TOTAL SALES & OUTPUT GST",
      val: formatINR2(totalSaleVal),
      sub: `+ GST: ${formatINR2(totalOutputGst)}`,
    },
    {
      label: "PURCHASES & INPUT TAX CREDIT",
      val: formatINR2(totalPurchaseVal),
      sub: `ITC: ${formatINR2(totalInputGst)} | TCS: ${formatINR2(totalTcs)}`,
    },
    {
      label: "TOTAL FREIGHT DISPATCHED",
      val: formatINR2(totalFreightVal),
      sub: `Across ${formatTons(totalTonsBought)} Dispatched`,
    },
    {
      label: "NET TRADING PROFIT (AFTER COMM.)",
      val: formatINR2(totalNetProfit),
      sub: `Gross: ${formatINR2(totalGrossProfit)} | Comm: -${formatINR2(totalSardarjiComm)} (₹100/t)`,
    },
  ];

  cardsData.forEach((c, idx) => {
    const cardX = marginL + idx * (cardW + gap);

    // Card white background & 1px border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...cBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, y, cardW, cardH, 1, 1, "FD");

    // 4px Navy left accent stripe
    doc.setFillColor(...cNavy);
    doc.rect(cardX, y, 1.4, cardH, "F");

    // Small uppercase grey label
    doc.setFont(activeFont, "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(...cMuted);
    doc.text(c.label, cardX + 3.5, y + 4.5);

    // Large bold navy amount (tabular, normal tracking)
    doc.setFont(activeFont, "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...cNavy);
    doc.text(c.val, cardX + 3.5, y + 10.5);

    // Small muted sub-line
    doc.setFont(activeFont, "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...cMuted);
    doc.text(c.sub, cardX + 3.5, y + 15);
  });

  y += cardH + 7;

  // 3. Transaction Register Table (via autoTable)
  // Precise column widths totaling exactly 267mm:
  // Sr: 8 | Date: 17 | Truck: 22 | Material: 14 | Supplier: 29 | Weight: 15 | Buy Rate: 16 | Supplier Bill: 24 | Transporter: 24 | Customer: 30 | Customer Bill: 24 | Kanta Diff: 17 | Net Profit: 27
  const tableRows = loads.map((l, idx) => {
    const tonsB = Number(l.tons_bought ?? 0);
    const buyR = Number(l.buy_rate ?? 0);
    const tonsS = Number(l.tons_received ?? 0);
    const diffKg = Math.round((tonsB - tonsS) * 1000);
    const grossProfit = Number(l.profit ?? 0);
    const soldTons = tonsS > 0 ? tonsS : tonsB;
    const sardarjiComm = l.sale_date ? Math.round(soldTons * 100 * 100) / 100 : 0;
    const netProfit = l.sale_date ? grossProfit - sardarjiComm : 0;

    const diffStr =
      l.sale_date && diffKg !== 0 ? `${diffKg > 0 ? "-" : "+"}${Math.abs(diffKg)} kg` : "0 kg";

    const profitStr =
      l.sale_date && l.profit !== null
        ? netProfit >= 0
          ? `+${formatINR2(netProfit)}`
          : formatINR2(netProfit)
        : "Unsold";

    return [
      String(idx + 1),
      formatDate(l.load_date),
      l.truck_number,
      l.material.toUpperCase(),
      l.supplier_name || "---",
      formatTons(l.tons_bought),
      formatINR2(l.buy_rate),
      formatINR2(l.purchase_total),
      l.agency_name || "---",
      l.buyer_name || "In Stock",
      l.sale_total ? formatINR2(l.sale_total) : "-",
      diffStr,
      profitStr,
    ];
  });

  // Totals Row
  const totalsRow = [
    "TOTAL",
    "-",
    `${loads.length} Loads`,
    "-",
    "-",
    formatTons(totalTonsBought),
    "-",
    formatINR2(totalSupplierBill),
    "-",
    "-",
    formatINR2(totalCustomerBill),
    "-",
    `+${formatINR2(totalNetProfit)}`,
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR, top: 18, bottom: 18 },
    theme: "plain",
    styles: {
      font: activeFont,
      fontSize: 7.5,
      textColor: cText,
      cellPadding: { top: 2, right: 1.5, bottom: 2, left: 1.5 },
      overflow: "linebreak",
      lineWidth: 0,
    },
    headStyles: {
      fillColor: cNavy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.2,
      halign: "left",
      cellPadding: { top: 2.5, right: 1.5, bottom: 2.5, left: 1.5 },
    },
    bodyStyles: {
      lineWidth: { bottom: 0.2 },
      lineColor: cBorder,
    },
    alternateRowStyles: {
      fillColor: cZebra,
    },
    footStyles: {
      fillColor: cLightNavy,
      textColor: cNavy,
      fontStyle: "bold",
      fontSize: 7.5,
      lineWidth: { top: 0.4, bottom: 0.4 },
      lineColor: [203, 213, 225],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" }, // Sr
      1: { cellWidth: 17, halign: "center" }, // Date
      2: { cellWidth: 22, halign: "left", fontStyle: "bold" }, // Truck No
      3: { cellWidth: 14, halign: "left" }, // Material
      4: { cellWidth: 29, halign: "left" }, // Supplier
      5: { cellWidth: 15, halign: "right" }, // Weight
      6: { cellWidth: 16, halign: "right" }, // Buy Rate
      7: { cellWidth: 24, halign: "right", fontStyle: "bold" }, // Supplier Bill
      8: { cellWidth: 24, halign: "left" }, // Transporter
      9: { cellWidth: 30, halign: "left" }, // Customer / Buyer
      10: { cellWidth: 24, halign: "right", fontStyle: "bold" }, // Customer Bill
      11: { cellWidth: 17, halign: "right" }, // Kanta Diff
      12: { cellWidth: 27, halign: "right", fontStyle: "bold" }, // Net Profit
    },
    head: [
      [
        "Sr.",
        "Date",
        "Truck No",
        "Material",
        "Supplier",
        "Weight",
        "Buy Rate",
        "Supplier Bill",
        "Transporter",
        "Customer / Buyer",
        "Customer Bill",
        "Kanta Diff",
        "Net Profit",
      ],
    ],
    body: tableRows,
    foot: [totalsRow],
    didParseCell: (data) => {
      // Color Net Profit column (index 12)
      if (data.section === "body" && data.column.index === 12) {
        const txt = String(data.cell.raw);
        if (txt.startsWith("-")) {
          data.cell.styles.textColor = cLoss;
        } else if (txt.startsWith("+")) {
          data.cell.styles.textColor = cProfit;
        }
      }
      // Center align header for Sr and Date
      if (data.section === "head") {
        if (data.column.index === 0 || data.column.index === 1) {
          data.cell.styles.halign = "center";
        } else if ([5, 6, 7, 10, 11, 12].includes(data.column.index)) {
          data.cell.styles.halign = "right";
        }
      }
      // Right align numeric footer columns
      if (data.section === "foot") {
        if ([5, 6, 7, 10, 11, 12].includes(data.column.index)) {
          data.cell.styles.halign = "right";
        }
      }
    },
  });

  // Get current Y after autoTable
  let finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;

  // 4. Tax Summary Table & Notes & Signatures
  // Ensure enough room on current page or add new page
  if (finalY + 46 > pageH - 18) {
    doc.addPage();
    finalY = 18;
  } else {
    finalY += 8;
  }

  // Left Block: Tax Summary Table (Corporate Two-Column)
  const taxBoxW = 125;
  const taxBoxX = marginL;
  const rowH = 4.6;

  // Header for Tax Summary
  doc.setFillColor(...cNavy);
  doc.rect(taxBoxX, finalY, taxBoxW, 5.5, "F");
  doc.setFont(activeFont, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("GST & REVENUE TAX RECONCILIATION SUMMARY", taxBoxX + 2.5, finalY + 3.8);

  let curTaxY = finalY + 5.5;

  const taxRows: Array<{ label: string; val: string; bold?: boolean; isNet?: boolean }> = [
    { label: "Taxable Sales Turnover (Pre-GST)", val: formatINR2(totalSaleVal) },
    { label: "Output GST Payable (18% / 5%)", val: formatINR2(totalOutputGst) },
    { label: "Taxable Purchases (Collieries / Mines)", val: formatINR2(totalPurchaseVal) },
    { label: "Input Tax Credit (ITC - Eligible)", val: formatINR2(totalInputGst) },
    { label: "Tax Collected at Source (TCS 2% on Coal)", val: formatINR2(totalTcs) },
    {
      label: "Net GST Cash Liability (Output GST - ITC)",
      val: formatINR2(netGstPayable > 0 ? netGstPayable : 0),
      bold: true,
      isNet: true,
    },
    { label: "Total Freight Expenses (Exempt / Nil-Rated)", val: formatINR2(totalFreightVal) },
    { label: "Gross Trading Margin (Sales - Cost - Freight)", val: formatINR2(totalGrossProfit) },
    { label: "Sardarji Commission (-₹100/t on sold weight)", val: `-${formatINR2(totalSardarjiComm)}` },
    {
      label: "Net Trading Profit (Final Realized Pre-Tax)",
      val: formatINR2(totalNetProfit),
      bold: true,
    },
  ];

  taxRows.forEach((tr, tIdx) => {
    if (tr.isNet) {
      doc.setFillColor(...cLightNavy);
      doc.rect(taxBoxX, curTaxY, taxBoxW, rowH, "F");
      doc.setDrawColor(...cNavy);
      doc.setLineWidth(0.3);
      doc.line(taxBoxX, curTaxY, taxBoxX + taxBoxW, curTaxY);
      doc.line(taxBoxX, curTaxY + rowH, taxBoxX + taxBoxW, curTaxY + rowH);
    } else if (tIdx % 2 === 1) {
      doc.setFillColor(...cZebra);
      doc.rect(taxBoxX, curTaxY, taxBoxW, rowH, "F");
    }

    doc.setFont(activeFont, tr.bold ? "bold" : "normal");
    doc.setFontSize(7);
    doc.setTextColor(...(tr.bold ? cNavy : cText));

    doc.text(tr.label, taxBoxX + 2.5, curTaxY + 3.2);
    doc.text(tr.val, taxBoxX + taxBoxW - 2.5, curTaxY + 3.2, { align: "right" });

    curTaxY += rowH;
  });

  // Right Block: Notes & Declarations & Signatures
  const notesX = marginL + taxBoxW + 8;
  const notesW = contentW - taxBoxW - 8;

  // Notes Box
  doc.setDrawColor(...cBorder);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(notesX, finalY, notesW, 20, 1, 1, "FD");

  doc.setFont(activeFont, "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...cNavy);
  doc.text("BASIS OF PREPARATION & NOTES", notesX + 3, finalY + 4.5);

  doc.setFont(activeFont, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...cMuted);
  const noteLines = [
    "• Figures are compiled from primary load books, delivery challans, and weighbridge slips.",
    "• Input Tax Credit (ITC) & TCS entries are subject to GSTR-2B reconciliation by the CA.",
    "• Freight payments are under Goods Transport Agency (GTA) reverse charge / exemption.",
  ];
  noteLines.forEach((line, lIdx) => {
    doc.text(line, notesX + 3, finalY + 8.5 + lIdx * 3.5);
  });

  // Signature Block
  const sigY = finalY + 22;
  doc.setFont(activeFont, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...cNavy);
  doc.text("Prepared for CA Review", notesX + 3, sigY + 5);
  doc.text("For AARAV TRADERS", notesX + notesW - 3, sigY + 5, { align: "right" });

  doc.setFont(activeFont, "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...cMuted);
  doc.text("Accounts & Tax Desk", notesX + 3, sigY + 14);
  doc.text("Authorised Signatory", notesX + notesW - 3, sigY + 14, { align: "right" });

  // 5. Footer on Every Page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Thin grey footer line
    doc.setDrawColor(...cBorder);
    doc.setLineWidth(0.3);
    doc.line(marginL, pageH - 12, pageW - marginR, pageH - 12);

    doc.setFont(activeFont, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...cMuted);

    // Left
    doc.text("AARAV TRADERS | GSTIN: 27AKIPM5661P1ZE", marginL, pageH - 8);

    // Center
    doc.text("Confidential - For CA / Tax Purpose", pageW / 2, pageH - 8, { align: "center" });

    // Right
    doc.text(`Page ${p} of ${totalPages}`, pageW - marginR, pageH - 8, { align: "right" });
  }

  // Save Document
  const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`Aarav_Traders_CA_Register_${cleanTitle}.pdf`);
}
