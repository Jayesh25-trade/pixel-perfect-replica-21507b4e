import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { LedgerEntry } from "@/components/parties/PartyStatementModal";
import { formatDate } from "@/lib/calculations";
import { formatINR2 } from "./exportCaReports";
import { ensureRobotoFonts } from "./pdfFontLoader";

interface PartyLedgerPdfData {
  partyName: string;
  partyType: "supplier" | "agency" | "buyer";
  partyPhone?: string | null | undefined;
  partyCreditDays?: number | null | undefined;
  entries: LedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  closingType: "Dr" | "Cr" | "Nil";
}

/**
 * Converts a numeric amount to Indian English words.
 * E.g. 546377.76 -> "Rupees Five Lakh Forty-Six Thousand Three Hundred Seventy-Seven and Seventy-Six Paise Only"
 */
export function numberToIndianWords(amount: number): string {
  if (!amount || isNaN(amount) || amount === 0) return "Rupees Zero Only";
  const abs = Math.abs(amount);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertTwoDigits(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] ?? "";
    const t = Math.floor(n / 10);
    const o = n % 10;
    return `${tens[t]}${o ? " " + ones[o] : ""}`;
  }

  function convertThreeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    let res = "";
    if (h > 0) res += `${ones[h]} Hundred`;
    if (rem > 0) res += `${res ? " " : ""}${convertTwoDigits(rem)}`;
    return res;
  }

  const crore = Math.floor(intPart / 10000000);
  const lakh = Math.floor((intPart % 10000000) / 100000);
  const thousand = Math.floor((intPart % 100000) / 1000);
  const hundredAndBelow = intPart % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${convertThreeDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${convertTwoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${convertTwoDigits(thousand)} Thousand`);
  if (hundredAndBelow > 0) parts.push(convertThreeDigits(hundredAndBelow));

  let result = parts.length > 0 ? parts.join(" ") : "Zero";
  result = `Rupees ${result}`;
  if (decPart > 0) {
    result += ` and ${convertTwoDigits(decPart)} Paise`;
  }
  result += " Only";
  return result;
}

export async function generatePartyLedgerPdf(data: PartyLedgerPdfData) {
  const doc = new jsPDF("p", "mm", "a4");
  const fontLoaded = await ensureRobotoFonts(doc);
  const activeFont = fontLoaded ? "Roboto" : "helvetica";

  const pageW = 210;
  const pageH = 297;
  const marginL = 15;
  const marginR = 15;
  const contentW = pageW - marginL - marginR; // 180mm

  // Clean party type classification
  const groupLabel =
    data.partyType === "supplier"
      ? "Sundry Creditor (Supplier)"
      : data.partyType === "agency"
        ? "Sundry Creditor (Transporter)"
        : "Sundry Debtor (Buyer / Customer)";

  // Compute period range
  const dates = data.entries
    .map((e) => e.date)
    .filter(Boolean)
    .sort();
  const fromDate = dates.length > 0 ? formatDate(dates[0]!) : formatDate(new Date());
  const toDate = dates.length > 0 ? formatDate(dates[dates.length - 1]!) : formatDate(new Date());
  const todayStr = formatDate(new Date().toISOString().split("T")[0]);

  // 1. TOP BLESSING & HEADER BAND
  // Blessing
  doc.setFont(activeFont, "bold");
  doc.setFontSize(8);
  doc.setTextColor(11, 37, 69); // Navy #0B2545
  doc.text("|| Jai Gajanan ||", pageW / 2, 12, { align: "center" });

  // Firm Title (Left)
  doc.setFont(activeFont, "bold");
  doc.setFontSize(18);
  doc.setTextColor(11, 37, 69); // #0B2545
  doc.text("AARAV TRADERS", marginL, 20);

  // Subtitle / Tagline
  doc.setFont(activeFont, "bold");
  doc.setFontSize(8);
  doc.setTextColor(19, 130, 138); // Teal #13828A
  doc.text("COAL & BIOMASS BRIQUETTES TRADING", marginL, 25);

  // Address & GSTIN
  doc.setFont(activeFont, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99); // #4B5563
  doc.text(
    "Shop No. 11, APMC Market, Shegaon - 444203, Dist. Buldhana (Maharashtra)",
    marginL,
    29.5,
  );
  doc.text("GSTIN: 27AKIPM5661P1ZE  |  Mob: +91 9881125511 / 7020709696", marginL, 33.5);

  // Right Header: Statement Meta
  doc.setFont(activeFont, "bold");
  doc.setFontSize(13);
  doc.setTextColor(11, 37, 69);
  doc.text("STATEMENT OF ACCOUNT", pageW - marginR, 20, { align: "right" });

  doc.setFont(activeFont, "bold");
  doc.setFontSize(8);
  doc.setTextColor(19, 130, 138);
  doc.text("PARTY LEDGER & KHATA", pageW - marginR, 25, { align: "right" });

  doc.setFont(activeFont, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99);
  doc.text(`As on: ${todayStr}`, pageW - marginR, 29.5, { align: "right" });
  doc.text(`Period: ${fromDate} to ${toDate}`, pageW - marginR, 33.5, { align: "right" });

  // Thin navy rule 1.5pt
  doc.setDrawColor(11, 37, 69);
  doc.setLineWidth(0.5);
  doc.line(marginL, 37, pageW - marginR, 37);

  // 2. PARTY INFORMATION BLOCK (2 columns, light border)
  const partyBoxY = 40;
  const partyBoxH = 20;
  doc.setFillColor(249, 250, 251); // #F9FAFB
  doc.setDrawColor(229, 231, 235); // #E5E7EB
  doc.setLineWidth(0.3);
  doc.roundedRect(marginL, partyBoxY, contentW, partyBoxH, 1.5, 1.5, "FD");

  // Left Column
  doc.setFont(activeFont, "bold");
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128); // #6B7280
  doc.text("ACCOUNT / PARTY DETAILS", marginL + 4, partyBoxY + 4.5);

  doc.setFont(activeFont, "bold");
  doc.setFontSize(11);
  doc.setTextColor(11, 37, 69);
  doc.text(data.partyName, marginL + 4, partyBoxY + 10);

  doc.setFont(activeFont, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99);
  doc.text(`Group: ${groupLabel}`, marginL + 4, partyBoxY + 14.5);
  if (data.partyPhone) {
    doc.text(`Contact: ${data.partyPhone}`, marginL + 4, partyBoxY + 18);
  }

  // Right Column
  const rightColX = pageW - marginR - 60;
  doc.setFont(activeFont, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text("Credit Terms:", rightColX, partyBoxY + 5.5);
  doc.setFont(activeFont, "bold");
  doc.setTextColor(17, 24, 39);
  doc.text(
    data.partyCreditDays ? `${data.partyCreditDays} Days` : "Net 30 Days",
    pageW - marginR - 4,
    partyBoxY + 5.5,
    { align: "right" },
  );

  doc.setFont(activeFont, "normal");
  doc.setTextColor(107, 114, 128);
  doc.text("Total Transactions:", rightColX, partyBoxY + 11);
  doc.setFont(activeFont, "bold");
  doc.setTextColor(17, 24, 39);
  doc.text(`${data.entries.length} Entries`, pageW - marginR - 4, partyBoxY + 11, {
    align: "right",
  });

  doc.setFont(activeFont, "normal");
  doc.setTextColor(107, 114, 128);
  doc.text("Firm Location:", rightColX, partyBoxY + 16.5);
  doc.setFont(activeFont, "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Shegaon, Maharashtra", pageW - marginR - 4, partyBoxY + 16.5, { align: "right" });

  // 3. SUMMARY ROW (4 equal white cards with navy left accent)
  const cardsY = partyBoxY + partyBoxH + 4; // 64
  const cardGap = 3;
  const cardW = (contentW - cardGap * 3) / 4; // ~42.75mm
  const cardH = 15;

  const isReceivable = data.closingType === "Dr";
  const isPayable = data.closingType === "Cr";

  const cards = [
    {
      label: "OPENING BALANCE",
      value: "₹0.00",
      sub: "Brought Forward",
    },
    {
      label: "TOTAL DEBITS (DR)",
      value: formatINR2(data.totalDebit),
      sub: "Billed / Charged",
    },
    {
      label: "TOTAL CREDITS (CR)",
      value: formatINR2(data.totalCredit),
      sub: "Paid / Received",
    },
    {
      label: "CLOSING BALANCE",
      value: `${formatINR2(data.closingBalance)} ${data.closingType}`,
      sub: isReceivable
        ? "(Receivable from party)"
        : isPayable
          ? "(Payable to party)"
          : "(Account Settled)",
    },
  ];

  cards.forEach((c, idx) => {
    const cx = marginL + idx * (cardW + cardGap);
    // Card background & border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, cardsY, cardW, cardH, 1.5, 1.5, "FD");

    // 4px Navy Left Accent
    doc.setFillColor(11, 37, 69);
    doc.rect(cx, cardsY, 1.2, cardH, "F");

    // Label
    doc.setFont(activeFont, "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(107, 114, 128);
    doc.text(c.label, cx + 3, cardsY + 4.5);

    // Value
    doc.setFont(activeFont, "bold");
    doc.setFontSize(9);
    doc.setTextColor(11, 37, 69);
    doc.text(c.value, cx + 3, cardsY + 9.5);

    // Subline
    doc.setFont(activeFont, "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(107, 114, 128);
    doc.text(c.sub, cx + 3, cardsY + 13.5);
  });

  // 4. LEDGER TABLE VIA AUTOTABLE
  const tableStartY = cardsY + cardH + 4; // ~83mm

  // Build table rows
  const tableRows: string[][] = [];

  // Opening Balance Row
  tableRows.push(["-", "Opening Balance", "-", "-", "-", "₹0.00 Dr"]);

  // Actual Ledger Entries
  data.entries.forEach((e) => {
    tableRows.push([
      formatDate(e.date),
      e.particulars,
      e.reference || "-",
      e.debit > 0 ? formatINR2(e.debit) : "-",
      e.credit > 0 ? formatINR2(e.credit) : "-",
      `${formatINR2(e.runningBalance)} ${e.balanceType}`,
    ]);
  });

  // Closing Balance Row
  tableRows.push([
    "-",
    "Closing Balance Carried Forward",
    "-",
    "-",
    "-",
    `${formatINR2(data.closingBalance)} ${data.closingType}`,
  ]);

  // Columns: Date (20mm) | Particulars (72mm) | Ref (24mm) | Debit (22mm) | Credit (22mm) | Balance (20mm) = 180mm
  autoTable(doc, {
    startY: tableStartY,
    margin: { left: marginL, right: marginR, top: 22, bottom: 18 },
    head: [
      ["DATE", "PARTICULARS / NARRATION", "REF / TRUCK", "DEBIT (DR)", "CREDIT (CR)", "BALANCE"],
    ],
    body: tableRows,
    foot: [
      [
        "TOTALS",
        "Total Debits, Credits & Net Balance",
        "-",
        formatINR2(data.totalDebit),
        formatINR2(data.totalCredit),
        `${formatINR2(data.closingBalance)} ${data.closingType}`,
      ],
    ],
    theme: "plain",
    styles: {
      font: activeFont,
      fontSize: 7.5,
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
      textColor: [31, 41, 55], // #1F2937
      lineWidth: 0.1,
      lineColor: [229, 231, 235], // #E5E7EB
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [11, 37, 69], // Navy #0B2545
      textColor: [255, 255, 255],
      font: activeFont,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "left",
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // #F9FAFB zebra
    },
    footStyles: {
      fillColor: [238, 242, 247], // Light navy #EEF2F7
      textColor: [11, 37, 69],
      font: activeFont,
      fontStyle: "bold",
      fontSize: 8,
      lineWidth: 0.2,
      lineColor: [11, 37, 69],
    },
    columnStyles: {
      0: { cellWidth: 20, halign: "left" },
      1: { cellWidth: 72, halign: "left" },
      2: { cellWidth: 24, halign: "left" },
      3: { cellWidth: 22, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 20, halign: "right" },
    },
    didDrawPage: (_dataHook) => {
      // If we are on page 2 or later, draw a clean compact running header
      const currentPage = doc.getNumberOfPages();
      if (currentPage > 1) {
        doc.setFont(activeFont, "bold");
        doc.setFontSize(8);
        doc.setTextColor(11, 37, 69);
        doc.text("AARAV TRADERS · STATEMENT OF ACCOUNT (CONTINUED)", marginL, 12);

        doc.setFont(activeFont, "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(107, 114, 128);
        doc.text(`Party: ${data.partyName}`, pageW - marginR, 12, { align: "right" });

        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.3);
        doc.line(marginL, 14, pageW - marginR, 14);
      }
    },
  });

  // 5. POST-TABLE FOOTER CONTENT (Amount in words, Bank box, Signature, Notes)
  // Get final Y from autoTable
  const autoTableDoc = doc as unknown as { lastAutoTable?: { finalY: number } };
  let currentY = (autoTableDoc.lastAutoTable?.finalY ?? tableStartY + 50) + 4;

  // Check if enough room for words + bank + signature (needs ~40mm)
  if (currentY + 42 > pageH - 18) {
    doc.addPage();
    currentY = 20;
  }

  // Amount in Words Box
  const wordsText = `Closing balance: ${numberToIndianWords(data.closingBalance)} (${data.closingType})`;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginL, currentY, contentW, 7, 1, 1, "FD");

  doc.setFont(activeFont, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(11, 37, 69);
  doc.text(wordsText, marginL + 3, currentY + 4.8);

  currentY += 10;

  // Bank Details (Left) and Signatory (Right)
  const bankBoxW = 95;
  const bankBoxH = 23;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(marginL, currentY, bankBoxW, bankBoxH, 1.5, 1.5, "FD");

  doc.setFont(activeFont, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(11, 37, 69);
  doc.text("BANK REMITTANCE DETAILS (AARAV TRADERS)", marginL + 3, currentY + 4.5);

  doc.setFont(activeFont, "normal");
  doc.setFontSize(7);
  doc.setTextColor(75, 85, 99);
  doc.text("Bank Name: State Bank of India (SBI)", marginL + 3, currentY + 8.5);
  doc.text("Account Name: AARAV TRADERS", marginL + 3, currentY + 12);
  doc.text("Account No: 39820150921", marginL + 3, currentY + 15.5);
  doc.text("Branch & IFSC: Shegaon APMC Branch  |  IFSC: SBIN0000481", marginL + 3, currentY + 19);

  // Signatory Block (Right)
  const sigX = pageW - marginR;
  doc.setFont(activeFont, "bold");
  doc.setFontSize(8);
  doc.setTextColor(11, 37, 69);
  doc.text("For AARAV TRADERS", sigX, currentY + 5, { align: "right" });

  doc.setFont(activeFont, "normal");
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text("Authorised Signatory", sigX, currentY + 20, { align: "right" });

  currentY += bankBoxH + 4;

  // Notes Block
  doc.setFont(activeFont, "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(107, 114, 128);
  doc.text(
    "Notes: Please verify this statement and report discrepancies within 7 days. This is a computer-generated statement.",
    marginL,
    currentY + 2,
  );

  // 6. GLOBAL FOOTER ON ALL PAGES
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Thin grey line
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(marginL, pageH - 10, pageW - marginR, pageH - 10);

    // Footer text
    doc.setFont(activeFont, "normal");
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);

    doc.text("AARAV TRADERS  |  GSTIN: 27AKIPM5661P1ZE", marginL, pageH - 6);
    doc.text("Confidential · Statement of Account", pageW / 2, pageH - 6, { align: "center" });
    doc.text(`Page ${i} of ${totalPages}`, pageW - marginR, pageH - 6, { align: "right" });
  }

  // Save PDF
  const cleanParty = data.partyName.replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `Aarav_Traders_Ledger_${cleanParty}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
