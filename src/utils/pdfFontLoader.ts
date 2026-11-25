import type jsPDF from "jspdf";

let cachedRegBase64: string | null = null;
let cachedBoldBase64: string | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(binary);
  }
  return Buffer.from(buffer).toString("base64");
}

export async function ensureRobotoFonts(doc: jsPDF): Promise<boolean> {
  try {
    // 1. If already cached in memory
    if (cachedRegBase64 && cachedBoldBase64) {
      doc.addFileToVFS("Roboto-Regular.ttf", cachedRegBase64);
      doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
      doc.addFileToVFS("Roboto-Bold.ttf", cachedBoldBase64);
      doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
      doc.setFont("Roboto", "normal");
      return true;
    }

    // 2. In browser environment: fetch from static public directory
    if (typeof window !== "undefined" && typeof window.fetch === "function") {
      const [regRes, boldRes] = await Promise.all([
        fetch("/fonts/Roboto-Regular.ttf"),
        fetch("/fonts/Roboto-Bold.ttf"),
      ]);

      if (regRes.ok && boldRes.ok) {
        const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);

        cachedRegBase64 = arrayBufferToBase64(regBuf);
        cachedBoldBase64 = arrayBufferToBase64(boldBuf);

        doc.addFileToVFS("Roboto-Regular.ttf", cachedRegBase64);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        doc.addFileToVFS("Roboto-Bold.ttf", cachedBoldBase64);
        doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
        doc.setFont("Roboto", "normal");
        return true;
      }
    }

    // 3. In Node environment (testing)
    if (typeof process !== "undefined" && process.versions?.node) {
      const fs = await import("fs");
      const path = await import("path");
      const regPath = path.resolve(process.cwd(), "public/fonts/Roboto-Regular.ttf");
      const boldPath = path.resolve(process.cwd(), "public/fonts/Roboto-Bold.ttf");

      if (fs.existsSync(regPath) && fs.existsSync(boldPath)) {
        cachedRegBase64 = fs.readFileSync(regPath).toString("base64");
        cachedBoldBase64 = fs.readFileSync(boldPath).toString("base64");

        doc.addFileToVFS("Roboto-Regular.ttf", cachedRegBase64);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        doc.addFileToVFS("Roboto-Bold.ttf", cachedBoldBase64);
        doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
        doc.setFont("Roboto", "normal");
        return true;
      }
    }
  } catch (err) {
    console.error("Font loading error:", err);
  }

  // Fallback to standard Helvetica if custom font fails to load
  doc.setFont("helvetica", "normal");
  return false;
}
