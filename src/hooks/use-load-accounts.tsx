import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Views, Tables, TablesInsert } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { validatePaymentCap } from "@/lib/calculations";

export type LoadDetail = Views<"load_details_view">;
export type MonthlyReport = Views<"monthly_reports_view">;
export type UnsoldStock = Views<"unsold_stock_view">;
export type PartyBalance = Views<"party_balances_view">;
export type Party = Tables<"parties">;
export type Payment = Tables<"payments">;
export type Settings = Tables<"settings">;
export type AuditLog = Tables<"audit_logs">;

export type RealtimeStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR" | "CONNECTING";

export function useLoadAccounts(options?: { enabled?: boolean }) {
  const isEnabled = options?.enabled ?? true;
  const queryClient = useQueryClient();
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("CONNECTING");

  // Helper to ensure Supabase session token is resolved before calling queries
  const ensureSessionReady = async () => {
    try {
      await supabase.auth.getSession();
    } catch {
      // ignore
    }
  };

  // 1. Settings Query (Authoritative parameters from settings table - NO fallback)
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    enabled: isEnabled,
    queryFn: async (): Promise<Settings> => {
      await ensureSessionReady();
      const { data, error } = await supabase.from("settings").select("*").limit(1).maybeSingle();

      if (error) {
        throw error;
      }
      if (!data) {
        throw new Error("Settings configuration row missing in database.");
      }

      return data as Settings;
    },
    staleTime: 60 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // 2. Loads Details View Query
  const loadsQuery = useQuery({
    queryKey: ["loads"],
    enabled: isEnabled,
    queryFn: async (): Promise<LoadDetail[]> => {
      await ensureSessionReady();
      const { data, error } = await supabase
        .from("load_details_view")
        .select("*")
        .order("load_date", { ascending: false });

      if (error) throw error;
      return (data as unknown as LoadDetail[]) ?? [];
    },
    staleTime: 30 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // 3. Parties Query (Active non-deleted parties)
  const partiesQuery = useQuery({
    queryKey: ["parties"],
    enabled: isEnabled,
    queryFn: async (): Promise<Party[]> => {
      await ensureSessionReady();
      const { data, error } = await supabase
        .from("parties")
        .select("*")
        .is("deleted_at", null)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data as unknown as Party[]) ?? [];
    },
    staleTime: 30 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // 4. Party Balances View Query
  const partyBalancesQuery = useQuery({
    queryKey: ["party_balances"],
    enabled: isEnabled,
    queryFn: async (): Promise<PartyBalance[]> => {
      await ensureSessionReady();
      const { data, error } = await supabase
        .from("party_balances_view")
        .select("*")
        .order("pending_balance", { ascending: false });

      if (error) throw error;
      return (data as unknown as PartyBalance[]) ?? [];
    },
    staleTime: 30 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // 5. Monthly Reports View Query
  const monthlyReportsQuery = useQuery({
    queryKey: ["monthly_reports"],
    enabled: isEnabled,
    queryFn: async (): Promise<MonthlyReport[]> => {
      await ensureSessionReady();
      const { data, error } = await supabase
        .from("monthly_reports_view")
        .select("*")
        .order("sale_month", { ascending: false });

      if (error) throw error;
      return (data as unknown as MonthlyReport[]) ?? [];
    },
    staleTime: 30 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // 6. Unsold Stock View Query
  const unsoldStockQuery = useQuery({
    queryKey: ["unsold_stock"],
    enabled: isEnabled,
    queryFn: async (): Promise<UnsoldStock | null> => {
      await ensureSessionReady();
      const { data, error } = await supabase.from("unsold_stock_view").select("*").maybeSingle();

      if (error) throw error;
      return (data as unknown as UnsoldStock) ?? null;
    },
    staleTime: 30 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // 7. Audit Logs Query
  const auditLogsQuery = useQuery({
    queryKey: ["audit_logs"],
    enabled: isEnabled,
    queryFn: async (): Promise<AuditLog[]> => {
      await ensureSessionReady();
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data as unknown as AuditLog[]) ?? [];
    },
    staleTime: 30 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // 7b. Payments Query for Tally-Style Party Ledgers
  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    enabled: isEnabled,
    queryFn: async (): Promise<Payment[]> => {
      await ensureSessionReady();
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .is("deleted_at", null)
        .order("payment_date", { ascending: true });

      if (error) throw error;
      return (data as unknown as Payment[]) ?? [];
    },
    staleTime: 30 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // 8. Realtime Subscriptions for Multi-Partner Instant Sync
  useEffect(() => {
    if (!isEnabled) return;
    const channel = supabase
      .channel("aarav-traders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "loads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["loads"] });
        queryClient.invalidateQueries({ queryKey: ["monthly_reports"] });
        queryClient.invalidateQueries({ queryKey: ["unsold_stock"] });
        queryClient.invalidateQueries({ queryKey: ["party_balances"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["payments"] });
        queryClient.invalidateQueries({ queryKey: ["loads"] });
        queryClient.invalidateQueries({ queryKey: ["party_balances"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "parties" }, () => {
        queryClient.invalidateQueries({ queryKey: ["parties"] });
        queryClient.invalidateQueries({ queryKey: ["party_balances"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        queryClient.invalidateQueries({ queryKey: ["settings"] });
        queryClient.invalidateQueries({ queryKey: ["loads"] });
      })
      .subscribe((status) => {
        setRealtimeStatus(status as RealtimeStatus);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, isEnabled]);

  // Mutations

  // Create Load Mutation
  const createLoadMutation = useMutation({
    mutationFn: async (newLoad: TablesInsert<"loads">) => {
      const { data, error } = await supabase.from("loads").insert(newLoad).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loads"] });
      queryClient.invalidateQueries({ queryKey: ["monthly_reports"] });
      queryClient.invalidateQueries({ queryKey: ["unsold_stock"] });
      queryClient.invalidateQueries({ queryKey: ["party_balances"] });
      toast.success("Load created successfully!");
    },
    onError: (err: Error) => {
      toast.error(`Failed to create load: ${err.message}`);
    },
  });

  // Update Load Mutation
  const updateLoadMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<TablesInsert<"loads">>;
    }) => {
      const { data, error } = await supabase
        .from("loads")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loads"] });
      queryClient.invalidateQueries({ queryKey: ["monthly_reports"] });
      queryClient.invalidateQueries({ queryKey: ["unsold_stock"] });
      queryClient.invalidateQueries({ queryKey: ["party_balances"] });
      toast.success("Load updated successfully!");
    },
    onError: (err: Error) => {
      toast.error(`Failed to update load: ${err.message}`);
    },
  });

  // Soft-Delete Load Mutation (deleted_at = now())
  const softDeleteLoadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("loads")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loads"] });
      queryClient.invalidateQueries({ queryKey: ["monthly_reports"] });
      queryClient.invalidateQueries({ queryKey: ["unsold_stock"] });
      queryClient.invalidateQueries({ queryKey: ["party_balances"] });
      toast.success("Load removed successfully.");
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete load: ${err.message}`);
    },
  });

  // Create Party Mutation
  const createPartyMutation = useMutation({
    mutationFn: async (party: TablesInsert<"parties">) => {
      const { data, error } = await supabase.from("parties").insert(party).select().single();

      if (error) throw error;
      return data as Party;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      queryClient.invalidateQueries({ queryKey: ["party_balances"] });
      toast.success("Party added successfully!");
    },
    onError: (err: Error) => {
      toast.error(`Failed to add party: ${err.message}`);
    },
  });

  // Record Payment Mutation (Enforcing client guard and trigger guard)
  const recordPaymentMutation = useMutation({
    mutationFn: async ({
      payment,
      billTotal,
      existingPayments,
    }: {
      payment: TablesInsert<"payments">;
      billTotal: number;
      existingPayments: number;
    }) => {
      // 1. Client-side cap validation
      const capCheck = validatePaymentCap({
        bill_total: billTotal,
        existing_payments: existingPayments,
        new_payment: payment.amount,
      });

      if (!capCheck.valid) {
        throw new Error(capCheck.error ?? "Payment exceeds remaining balance.");
      }

      // 2. Database Insert (Trigger will enforce on server side as well)
      const { data, error } = await supabase.from("payments").insert(payment).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["loads"] });
      queryClient.invalidateQueries({ queryKey: ["party_balances"] });
      toast.success("Payment recorded successfully!");
    },
    onError: (err: Error) => {
      toast.error(`Payment rejected: ${err.message}`);
    },
  });

  // Delete / Void Payment Mutation (Soft-delete via deleted_at)
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("payments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["loads"] });
      queryClient.invalidateQueries({ queryKey: ["party_balances"] });
      queryClient.invalidateQueries({ queryKey: ["monthly_reports"] });
      toast.success("Payment removed / voided successfully.");
    },
    onError: (err: Error) => {
      toast.error(`Failed to void payment: ${err.message}`);
    },
  });

  // Update Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<TablesInsert<"settings">>) => {
      const current = settingsQuery.data;
      if (!current?.id || current.id === "default") {
        const { error } = await supabase.from("settings").insert(updates);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("settings")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", current.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["loads"] });
      toast.success("Settings updated successfully!");
    },
    onError: (err: Error) => {
      toast.error(`Failed to update settings: ${err.message}`);
    },
  });

  return {
    realtimeStatus,
    settings: settingsQuery.data,
    isLoadingSettings: settingsQuery.isLoading,
    errorSettings: settingsQuery.error,
    settingsError: settingsQuery.error,
    refetchSettings: settingsQuery.refetch,
    loads: loadsQuery.data ?? [],
    isLoadingLoads: loadsQuery.isLoading,
    errorLoads: loadsQuery.error,
    refetchLoads: loadsQuery.refetch,
    parties: partiesQuery.data ?? [],
    isLoadingParties: partiesQuery.isLoading,
    errorParties: partiesQuery.error,
    refetchParties: partiesQuery.refetch,
    partyBalances: partyBalancesQuery.data ?? [],
    isLoadingPartyBalances: partyBalancesQuery.isLoading,
    errorPartyBalances: partyBalancesQuery.error,
    payments: paymentsQuery.data ?? [],
    isLoadingPayments: paymentsQuery.isLoading,
    errorPayments: paymentsQuery.error,
    monthlyReports: monthlyReportsQuery.data ?? [],
    isLoadingMonthlyReports: monthlyReportsQuery.isLoading,
    errorMonthlyReports: monthlyReportsQuery.error,
    refetchMonthlyReports: monthlyReportsQuery.refetch,
    unsoldStock: unsoldStockQuery.data,
    isLoadingUnsoldStock: unsoldStockQuery.isLoading,
    errorUnsoldStock: unsoldStockQuery.error,
    auditLogs: auditLogsQuery.data ?? [],
    isLoadingAuditLogs: auditLogsQuery.isLoading,
    errorAuditLogs: auditLogsQuery.error,
    // Actions
    createLoad: createLoadMutation.mutateAsync,
    isCreatingLoad: createLoadMutation.isPending,
    updateLoad: updateLoadMutation.mutateAsync,
    isUpdatingLoad: updateLoadMutation.isPending,
    softDeleteLoad: softDeleteLoadMutation.mutateAsync,
    createParty: createPartyMutation.mutateAsync,
    recordPayment: recordPaymentMutation.mutateAsync,
    isRecordingPayment: recordPaymentMutation.isPending,
    deletePayment: deletePaymentMutation.mutateAsync,
    isDeletingPayment: deletePaymentMutation.isPending,
    updateSettings: updateSettingsMutation.mutateAsync,
  };
}
