export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      settings: {
        Row: {
          id: string;
          gst_rate_coal: number;
          gst_rate_briquette: number;
          tcs_rate_purchase: number;
          default_credit_days: number;
          updated_at: string;
        };
        Insert: {
          id?: string | undefined;
          gst_rate_coal?: number | undefined;
          gst_rate_briquette?: number | undefined;
          tcs_rate_purchase?: number | undefined;
          default_credit_days?: number | undefined;
          updated_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          gst_rate_coal?: number | undefined;
          gst_rate_briquette?: number | undefined;
          tcs_rate_purchase?: number | undefined;
          default_credit_days?: number | undefined;
          updated_at?: string | undefined;
        };
        Relationships: [];
      };
      allowed_emails: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          email: string;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          email?: string | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      firm_members: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          user_id: string;
          email: string;
          role?: string | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          user_id?: string | undefined;
          email?: string | undefined;
          role?: string | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
      parties: {
        Row: {
          id: string;
          name: string;
          type: "supplier" | "agency" | "buyer";
          phone: string | null;
          credit_days: number | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string | undefined;
          name: string;
          type: "supplier" | "agency" | "buyer";
          phone?: string | null | undefined;
          credit_days?: number | null | undefined;
          created_at?: string | undefined;
          deleted_at?: string | null | undefined;
        };
        Update: {
          id?: string | undefined;
          name?: string | undefined;
          type?: "supplier" | "agency" | "buyer" | undefined;
          phone?: string | null | undefined;
          credit_days?: number | null | undefined;
          created_at?: string | undefined;
          deleted_at?: string | null | undefined;
        };
        Relationships: [];
      };
      loads: {
        Row: {
          id: string;
          load_date: string;
          material: "coal" | "briquette";
          supplier_id: string;
          tons_bought: number;
          buy_rate: number;
          agency_id: string;
          truck_number: string;
          tons_loaded: number;
          freight_rate: number;
          buyer_id: string | null;
          sale_date: string | null;
          tons_received: number | null;
          sale_rate: number | null;
          credit_days: number | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string | undefined;
          load_date?: string | undefined;
          material: "coal" | "briquette";
          supplier_id: string;
          tons_bought: number;
          buy_rate: number;
          agency_id: string;
          truck_number: string;
          tons_loaded: number;
          freight_rate: number;
          buyer_id?: string | null | undefined;
          sale_date?: string | null | undefined;
          tons_received?: number | null | undefined;
          sale_rate?: number | null | undefined;
          credit_days?: number | null | undefined;
          created_at?: string | undefined;
          updated_at?: string | undefined;
          deleted_at?: string | null | undefined;
        };
        Update: {
          id?: string | undefined;
          load_date?: string | undefined;
          material?: "coal" | "briquette" | undefined;
          supplier_id?: string | undefined;
          tons_bought?: number | undefined;
          buy_rate?: number | undefined;
          agency_id?: string | undefined;
          truck_number?: string | undefined;
          tons_loaded?: number | undefined;
          freight_rate?: number | undefined;
          buyer_id?: string | null | undefined;
          sale_date?: string | null | undefined;
          tons_received?: number | null | undefined;
          sale_rate?: number | null | undefined;
          credit_days?: number | null | undefined;
          created_at?: string | undefined;
          updated_at?: string | undefined;
          deleted_at?: string | null | undefined;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          load_id: string;
          party_id: string;
          kind: "purchase" | "freight" | "sale";
          amount: number;
          payment_date: string;
          mode: "UPI" | "Cheque";
          reference: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string | undefined;
          load_id: string;
          party_id: string;
          kind: "purchase" | "freight" | "sale";
          amount: number;
          payment_date?: string | undefined;
          mode: "UPI" | "Cheque";
          reference?: string | null | undefined;
          created_at?: string | undefined;
          deleted_at?: string | null | undefined;
        };
        Update: {
          id?: string | undefined;
          load_id?: string | undefined;
          party_id?: string | undefined;
          kind?: "purchase" | "freight" | "sale" | undefined;
          amount?: number | undefined;
          payment_date?: string | undefined;
          mode?: "UPI" | "Cheque" | undefined;
          reference?: string | null | undefined;
          created_at?: string | undefined;
          deleted_at?: string | null | undefined;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          table_name: string;
          record_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string | undefined;
          user_id?: string | null | undefined;
          action: string;
          table_name: string;
          record_id?: string | null | undefined;
          old_data?: Json | null | undefined;
          new_data?: Json | null | undefined;
          created_at?: string | undefined;
        };
        Update: {
          id?: string | undefined;
          user_id?: string | null | undefined;
          action?: string | undefined;
          table_name?: string | undefined;
          record_id?: string | null | undefined;
          old_data?: Json | null | undefined;
          new_data?: Json | null | undefined;
          created_at?: string | undefined;
        };
        Relationships: [];
      };
    };
    Views: {
      load_details_view: {
        Row: {
          id: string;
          load_date: string;
          material: "coal" | "briquette";
          supplier_id: string;
          supplier_name: string | null;
          tons_bought: number;
          buy_rate: number;
          agency_id: string;
          agency_name: string | null;
          truck_number: string;
          tons_loaded: number;
          freight_rate: number;
          buyer_id: string | null;
          buyer_name: string | null;
          sale_date: string | null;
          tons_received: number | null;
          sale_rate: number | null;
          credit_days: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          gst_rate: number;
          tcs_rate: number;
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
          due_date: string | null;
          purchase_paid: number;
          purchase_pending: number;
          freight_paid: number;
          freight_pending: number;
          sale_paid: number;
          sale_pending: number | null;
          is_overdue: boolean;
        };
        Relationships: [];
      };
      monthly_reports_view: {
        Row: {
          sale_month: string;
          month_start: string;
          loads_count: number;
          tons_bought: number;
          tons_sold: number;
          shortage_tons: number;
          purchase_amount: number;
          freight_amount: number;
          sale_amount: number;
          profit: number;
          gst_paid: number;
          gst_collected: number;
          net_gst: number;
        };
        Relationships: [];
      };
      unsold_stock_view: {
        Row: {
          unsold_loads: number;
          unsold_tons: number;
          unsold_purchase_cost: number;
          unsold_purchase_total_with_gst: number;
          unsold_freight_cost: number;
          total_unsold_cost_basis: number;
        };
        Relationships: [];
      };
      party_balances_view: {
        Row: {
          party_id: string;
          party_name: string;
          party_type: "supplier" | "agency" | "buyer";
          phone: string | null;
          credit_days: number | null;
          total_billed: number;
          total_paid: number;
          pending_balance: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_firm_member: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
