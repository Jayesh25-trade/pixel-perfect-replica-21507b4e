import jsPDF from "jspdf";
import type { FormomaticChallan } from "@/types/challan";

export const AARAV_TRADERS_FIRM = {
  id: "aarav",
  displayName: "Aarav Traders",
  shortCode: "AT",
  invoicePrefix: "AT/",
  blessing: "||Jai Gajanan||",
  headerTitle: "AARAV TRADERS",
  subHeader: "SHEGAON",
  gstNo: "GST No. 27AKIPM5661P1ZE",
  address: "SHOP NO 11 APMC MARKET, SHEGAON – 444203",
  city: "SHEGAON - 444203",
  state: "Maharashtra",
  stateCode: "27",
  phoneText: "M : 9881125511 / 7020709696",
  branchText: "Maharashtra (State Code: 27)",
  inAccountOf: "AARAV TRADERS",
  signatoryTitle: "AARAV TRADERS",
  signatoryPhone: "Mob : 9881125511",
};

export function generateAaravChallanPdf(c: FormomaticChallan) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const margin = 20;
  let y = 18;

  // 1. Blessing - red bold italic
  doc.setFont("times", "bolditalic");
  doc.setFontSize(11);
  doc.setTextColor(200, 0, 0);
  doc.text(AARAV_TRADERS_FIRM.blessing, pageW / 2 - 20, y);

  // GST No - blue
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 180);
  doc.text(AARAV_TRADERS_FIRM.gstNo, pageW / 2 + 15, y);

  y += 10;

  // FIRM NAME - large red bold
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.setTextColor(180, 0, 0);
  doc.text(AARAV_TRADERS_FIRM.headerTitle, pageW / 2, y, { align: "center" });

  y += 8;

  // Subheader
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(AARAV_TRADERS_FIRM.subHeader, pageW / 2, y, { align: "center" });

  y += 6;

  // Address line
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text(AARAV_TRADERS_FIRM.address, pageW / 2, y, { align: "center" });

  y += 5;

  // Phone
  doc.text(AARAV_TRADERS_FIRM.phoneText, pageW / 2, y, { align: "center" });

  y += 5;

  // State
  doc.setTextColor(0, 0, 0);
  doc.setFont("times", "normal");
  doc.text("State:", pageW / 2 - 25, y);
  doc.setFont("times", "italic");
  doc.setTextColor(200, 0, 0);
  doc.text(AARAV_TRADERS_FIRM.branchText, pageW / 2 - 12, y);

  y += 8;

  // PC No and Date - right aligned
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.setTextColor(200, 0, 0);
  doc.text(c.pc_no || "___", pageW - margin, y, { align: "right" });
  y += 5;
  doc.setFontSize(10);
  const dateStr = c.date ? c.date : "___/___/______";
  doc.text(dateStr, pageW - margin, y, { align: "right" });

  y += 6;

  // Horizontal line
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);

  y += 7;

  // DELIVERY CHALLAN / FREIGHT ADVICE
  doc.setFont("times", "bolditalic");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  const titleText = "DELIVERY CHALLAN / FREIGHT ADVICE";
  const titleWidth = doc.getTextWidth(titleText);
  const titleX = (pageW - titleWidth) / 2;
  doc.text(titleText, pageW / 2, y, { align: "center" });
  doc.setLineWidth(0.4);
  doc.line(titleX, y + 1, titleX + titleWidth, y + 1);

  y += 5;

  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);

  y += 8;

  // Body text
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  // To,
  doc.text("To,", margin, y);
  y += 6;
  doc.text("The Store Department", margin, y);
  y += 7;

  // M/s line
  doc.text("M / s.", margin, y);
  doc.setFont("times", "bold");
  doc.text(c.party_name || "________________________________", margin + 14, y);
  doc.setLineWidth(0.2);
  doc.line(margin + 14, y + 1, pageW - margin, y + 1);

  y += 10;

  doc.setFont("times", "normal");
  doc.text("Dear sir,", margin, y);

  y += 7;

  // Truck line
  doc.text("We are Despatching Truck No.", margin, y);
  doc.setFont("times", "bold");
  doc.text(c.truck_no || "________________", margin + 56, y);
  doc.setFont("times", "normal");
  doc.setLineWidth(0.2);
  doc.line(margin + 56, y + 1, pageW - margin, y + 1);

  y += 7;

  // Material & Qty
  const isBriquette = String(c.material_type).toLowerCase().includes("briquette");
  const materialLabel = isBriquette
    ? "OF BRIQUETTES with Qty."
    : "OF INDIA COAL / IMPORT COAL with Qty.";
  doc.text(materialLabel, margin, y);
  const qtyX = margin + doc.getTextWidth(materialLabel) + 4;
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text(c.quantity ? `${c.quantity} M.T.` : "________ M.T.", qtyX, y);
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setLineWidth(0.2);
  doc.line(qtyX, y + 1, pageW - margin, y + 1);

  y += 7;

  // Freight Rate
  doc.text("@Freight Rate", margin, y);
  doc.text(c.freight_rate || "", margin + 30, y);
  doc.line(margin + 28, y + 1, pageW - margin, y + 1);

  y += 7;

  // LR No
  doc.text("Under L.R. No.", margin, y);
  doc.text(c.lr_no || "", margin + 30, y);
  doc.line(margin + 28, y + 1, margin + 65, y + 1);
  doc.text("Of", margin + 68, y);
  doc.text(c.lr_of || "", margin + 76, y);
  doc.line(margin + 74, y + 1, pageW - margin, y + 1);

  y += 8;

  // IN account of M/s
  doc.text("IN account of M/s.", margin, y);
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text(AARAV_TRADERS_FIRM.inAccountOf, margin + 38, y);
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.line(margin + 36, y + 1, pageW - margin, y + 1);

  y += 8;

  // Signatory
  y += 20;
  doc.setFont("times", "bold");
  doc.text(`For ${AARAV_TRADERS_FIRM.signatoryTitle}`, pageW - margin, y, { align: "right" });
  y += 15;
  doc.setFont("times", "normal");
  doc.text("Authorized Signatory", pageW - margin, y, { align: "right" });

  const safeFilename = `${(c.pc_no || "challan").replace(/[^a-zA-Z0-9_-]/g, "_")}_${c.truck_no || "truck"}.pdf`;
  doc.save(safeFilename);
}
