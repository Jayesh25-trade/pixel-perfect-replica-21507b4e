import type { Material } from "./calculations";

export interface NewLoadDraft {
  step: number;
  // Step 1: Purchase
  load_date: string;
  material: Material;
  supplier_id: string;
  supplier_name?: string;
  tons_bought: string;
  buy_rate: string;

  // Step 2: Truck
  agency_id: string;
  agency_name?: string;
  truck_number: string;
  tons_loaded: string;
  freight_rate: string;

  // Step 3: Sale (Optional)
  has_sale: boolean;
  buyer_id: string;
  buyer_name?: string;
  sale_date: string;
  tons_received: string;
  sale_rate: string;
  credit_days: string;
  challan_no?: string;
  updated_at?: number;
}

const DRAFT_KEY = "aarav_new_load_draft_v1";

export function getInitialDraft(): NewLoadDraft {
  const today = new Date().toISOString().split("T")[0]!;
  return {
    step: 1,
    load_date: today,
    material: "coal",
    supplier_id: "",
    tons_bought: "",
    buy_rate: "",
    agency_id: "",
    truck_number: "",
    tons_loaded: "",
    freight_rate: "",
    has_sale: false,
    buyer_id: "",
    sale_date: today,
    tons_received: "",
    sale_rate: "",
    credit_days: "30",
  };
}

export function saveLoadDraft(draft: NewLoadDraft): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, updated_at: Date.now() }));
  } catch (e) {
    console.error("Failed to save draft:", e);
  }
}

export function loadSavedDraft(): NewLoadDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NewLoadDraft;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLoadDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    console.error("Failed to clear draft:", e);
  }
}
