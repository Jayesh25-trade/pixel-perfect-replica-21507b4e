import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validatePaymentCap } from "@/lib/calculations";
import type { TablesInsert } from "@/integrations/supabase/types";

export interface QueuedWrite {
  id: string;
  type: "CREATE_LOAD" | "RECORD_PAYMENT" | "CREATE_PARTY";
  payload: Record<string, unknown>;
  status: "pending" | "failed";
  error?: string | undefined;
  timestamp: number;
}

const QUEUE_KEY = "aarav_offline_queue_v1";

export function getOfflineQueue(): QueuedWrite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedWrite[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("Failed saving offline queue:", err);
  }
}

/**
 * Enqueue an offline action safely.
 * For RECORD_PAYMENT, strictly checks the overpayment guard before queueing.
 */
export function enqueueOfflineWrite(
  write: Omit<QueuedWrite, "id" | "timestamp" | "status" | "error"> & {
    billTotal?: number | undefined;
    existingPaid?: number | undefined;
    amount?: number | undefined;
  },
): void {
  // Overpayment pre-validation guard for offline payments
  if (
    write.type === "RECORD_PAYMENT" &&
    write.billTotal !== undefined &&
    write.amount !== undefined
  ) {
    const check = validatePaymentCap({
      bill_total: write.billTotal,
      existing_payments: write.existingPaid ?? 0,
      new_payment: write.amount,
    });
    if (!check.valid) {
      const errMsg = check.error ?? "Payment exceeds bill total";
      toast.error(`Cannot save payment offline: ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  const queue = getOfflineQueue();
  const newItem: QueuedWrite = {
    id: Math.random().toString(36).substring(2, 9),
    type: write.type,
    payload: write.payload,
    status: "pending",
    timestamp: Date.now(),
  };

  queue.push(newItem);
  saveOfflineQueue(queue);
  toast.info("Offline: Changes queued locally. Will sync automatically when connection returns.");
}

/**
 * Process pending offline writes when online.
 * Nothing fails silently: failed items are marked with status='failed' and error details.
 */
export async function syncOfflineQueue(): Promise<{
  synced: number;
  failed: number;
}> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const remaining: QueuedWrite[] = [];
  let syncedCount = 0;
  let failedCount = 0;

  for (const item of queue) {
    if (item.status === "failed") {
      // Keep existing failed items until user explicitly reviews/fixes or discards them
      remaining.push(item);
      failedCount++;
      continue;
    }

    try {
      if (item.type === "CREATE_LOAD") {
        const { error } = await supabase
          .from("loads")
          .insert(item.payload as unknown as TablesInsert<"loads">);
        if (error) throw error;
      } else if (item.type === "RECORD_PAYMENT") {
        const { error } = await supabase
          .from("payments")
          .insert(item.payload as unknown as TablesInsert<"payments">);
        if (error) throw error;
      } else if (item.type === "CREATE_PARTY") {
        const { error } = await supabase
          .from("parties")
          .insert(item.payload as unknown as TablesInsert<"parties">);
        if (error) throw error;
      }

      syncedCount++;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Offline sync failed for item ${item.id}:`, errMsg);

      // Mark as failed and preserve error for user inspection
      item.status = "failed";
      item.error = errMsg;
      remaining.push(item);
      failedCount++;

      toast.error(`Offline sync error: ${errMsg}`, {
        duration: 8000,
        description: "A queued transaction was rejected by the database. Review in offline queue.",
      });
    }
  }

  saveOfflineQueue(remaining);

  if (syncedCount > 0) {
    toast.success(`Synced ${syncedCount} offline transaction(s) with server.`);
  }

  return { synced: syncedCount, failed: failedCount };
}

export function discardFailedWrite(id: string): void {
  const queue = getOfflineQueue().filter((item) => item.id !== id);
  saveOfflineQueue(queue);
  toast.info("Failed offline item discarded.");
}

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });

  const [queueCount, setQueueCount] = useState<number>(0);
  const [failedItems, setFailedItems] = useState<QueuedWrite[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateState = () => {
      const queue = getOfflineQueue();
      setQueueCount(queue.filter((q) => q.status === "pending").length);
      setFailedItems(queue.filter((q) => q.status === "failed"));
    };

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue().then(updateState);
    };

    const handleOffline = () => {
      setIsOnline(false);
      updateState();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    updateState();
    const interval = setInterval(updateState, 3000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  return {
    isOnline,
    queueCount,
    failedItems,
    discardFailedWrite,
    retrySync: syncOfflineQueue,
  };
}
