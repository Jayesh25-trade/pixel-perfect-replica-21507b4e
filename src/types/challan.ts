export type MaterialType = "coal" | "briquettes";

export interface FormomaticChallan {
  id: string;
  pc_no: string;
  pc_number?: number | null;
  date: string | null;
  party_name: string;
  material_type: MaterialType | string;
  truck_no: string;
  quantity: string;
  freight_rate?: string | null;
  lr_no?: string | null;
  lr_of?: string | null;
  purchase_order_no?: string | null;
  purchase_order_dated?: string | null;
  total_freight_amount?: string | null;
  advance?: string | null;
  balance_to_pay?: string | null;
  created_at?: string;
  updated_at?: string;
}
