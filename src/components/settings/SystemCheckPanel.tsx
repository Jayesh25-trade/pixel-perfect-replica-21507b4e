import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  Database,
  Radio,
  UserCheck,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Settings, RealtimeStatus } from "@/hooks/use-load-accounts";

interface SystemCheckPanelProps {
  settings?: Settings | undefined;
  userEmail?: string | undefined;
  isFirmMember?: boolean | undefined;
  realtimeStatus?: RealtimeStatus | undefined;
}

const REQUIRED_TABLES = [
  "settings",
  "parties",
  "loads",
  "payments",
  "firm_members",
  "allowed_emails",
  "audit_logs",
] as const;

const REQUIRED_VIEWS = [
  "load_details_view",
  "monthly_reports_view",
  "unsold_stock_view",
  "party_balances_view",
] as const;

export type EntityStatusKind =
  "present_with_data" | "present_empty" | "missing" | "rls_denied" | "error";

export interface EntityCheckResult {
  kind: EntityStatusKind;
  detail: string;
  count?: number | undefined;
}

export function SystemCheckPanel({
  settings,
  userEmail,
  isFirmMember,
  realtimeStatus = "CONNECTING",
}: SystemCheckPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // Extract host dynamically from VITE_SUPABASE_URL
  const supabaseUrl = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ?? "";
  let projectHost = "Not configured";
  try {
    if (supabaseUrl) {
      projectHost = new URL(supabaseUrl).hostname;
    }
  } catch {
    projectHost = supabaseUrl;
  }

  // Live database reachability probe
  const {
    data: dbReachability,
    isLoading: isCheckingReachability,
    refetch: refetchReachability,
  } = useQuery({
    queryKey: ["system-check-reachability"],
    queryFn: async () => {
      if (!supabaseUrl) return { reachable: false, reason: "VITE_SUPABASE_URL is not set" };
      try {
        const apiKey =
          (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ?? "";
        const res = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/rest/v1/`, {
          method: "GET",
          headers: { apikey: apiKey },
        });
        // Any HTTP response from the Supabase host (200, 404, etc.) proves server is reachable
        return { reachable: res.status > 0, reason: `HTTP ${res.status} OK` };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { reachable: false, reason: msg };
      }
    },
    staleTime: 10000,
  });

  // Probe each required table and view: distinguish missing from RLS empty
  const {
    data: entityStatus,
    isLoading: isCheckingEntities,
    refetch: refetchEntities,
    isRefetching,
  } = useQuery({
    queryKey: ["system-check-schema"],
    queryFn: async () => {
      const results: Record<string, EntityCheckResult> = {};

      const checkEntity = async (
        name: (typeof REQUIRED_TABLES)[number] | (typeof REQUIRED_VIEWS)[number],
      ): Promise<EntityCheckResult> => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error, count } = await (supabase.from as any)(name).select("*", {
            count: "exact",
            head: true,
          });

          if (error) {
            if (
              error.code === "PGRST205" ||
              error.message.includes("schema cache") ||
              error.message.includes("does not exist") ||
              error.code === "404"
            ) {
              return {
                kind: "missing",
                detail: `Table/view not found in database (${error.code || "PGRST205"})`,
              };
            }
            if (error.code === "42501" || error.code === "PGRST301") {
              return {
                kind: "rls_denied",
                detail: `Access denied by RLS policy (${error.code})`,
              };
            }
            return {
              kind: "error",
              detail: `${error.code || "ERROR"}: ${error.message}`,
            };
          }

          if (count !== null && count > 0) {
            return {
              kind: "present_with_data",
              detail: `${count} row(s) visible`,
              count,
            };
          }

          return {
            kind: "present_empty",
            detail: "Present (0 rows visible / RLS filtered)",
            count: 0,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
            return { kind: "error", detail: "Network fetch failed" };
          }
          return { kind: "missing", detail: msg };
        }
      };

      for (const table of REQUIRED_TABLES) {
        results[table] = await checkEntity(table);
      }

      for (const view of REQUIRED_VIEWS) {
        results[view] = await checkEntity(view);
      }

      return results;
    },
    staleTime: 10000,
  });

  const handleRefreshAll = () => {
    refetchReachability();
    refetchEntities();
  };

  const missingEntities = entityStatus
    ? Object.entries(entityStatus)
        .filter(([_, result]) => result.kind === "missing")
        .map(([name]) => name)
    : [];

  const isSetupComplete = entityStatus && missingEntities.length === 0 && !!settings;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Panel Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">System & Database Diagnostics</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRefreshAll}
          disabled={isCheckingEntities || isRefetching}
          className="h-8 px-2 text-xs gap-1"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Overview Status Alert */}
      {!isSetupComplete ? (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <span className="font-semibold block">Database setup is incomplete</span>
            <span>
              The database tables or settings row have not been created in Supabase. Ask the admin
              to run{" "}
              <code className="font-mono bg-muted px-1 py-0.5 rounded">supabase/schema.sql</code> in
              the SQL Editor.
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 flex items-center gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium">
            All database tables, calculation views, and settings are operational.
          </span>
        </div>
      )}

      {/* Key Diagnostic Items */}
      <div className="space-y-2 text-xs divide-y divide-border">
        {/* Project Host */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" /> Database Host
          </span>
          <span className="font-mono text-foreground font-semibold">{projectHost}</span>
        </div>

        {/* Database Reachability */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-muted-foreground">Database Reachable</span>
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            {isCheckingReachability ? (
              <span className="text-muted-foreground">Checking…</span>
            ) : dbReachability?.reachable ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Yes
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 text-destructive" /> No (
                {dbReachability?.reason || "Unreachable"})
              </>
            )}
          </span>
        </div>

        {/* Settings Row */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-muted-foreground">Settings Row</span>
          <span className="font-semibold text-foreground">
            {settings ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                Coal: {settings.gst_rate_coal}% | Briquette: {settings.gst_rate_briquette}% |
                Credit: {settings.default_credit_days}d
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" /> Missing
              </span>
            )}
          </span>
        </div>

        {/* User Session */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5" /> Signed-in email
          </span>
          <span className="font-semibold text-foreground font-mono">
            {userEmail || "Signed Out"}
          </span>
        </div>

        {/* Member Status */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-muted-foreground">Authorized firm member</span>
          <span
            className={`font-semibold ${isFirmMember ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
          >
            {isFirmMember ? "Yes" : "No"}
          </span>
        </div>

        {/* Realtime Channel */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5" /> Realtime Channel
          </span>
          <span className="inline-flex items-center gap-1 font-semibold">
            {realtimeStatus === "SUBSCRIBED" ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live
              </span>
            ) : realtimeStatus === "CHANNEL_ERROR" ||
              realtimeStatus === "TIMED_OUT" ||
              realtimeStatus === "CLOSED" ? (
              <span className="text-amber-600 dark:text-amber-400">Reconnecting…</span>
            ) : (
              <span className="text-muted-foreground">Connecting…</span>
            )}
          </span>
        </div>

        {/* App Version */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-muted-foreground">App Version</span>
          <span className="font-mono font-semibold text-foreground">v1.0.1</span>
        </div>
      </div>

      {/* Collapsible Entity Details */}
      <div className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full text-xs h-8"
        >
          {expanded
            ? "Hide Entity Checklist"
            : `View Required Tables & Views (${11 - missingEntities.length}/11 present)`}
        </Button>

        {expanded && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Tables & Views Schema Cache & RLS Status
            </h4>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                ...REQUIRED_TABLES.map((t) => ({ name: t, type: "Table" })),
                ...REQUIRED_VIEWS.map((v) => ({ name: v, type: "View" })),
              ].map((item) => {
                const result = entityStatus ? entityStatus[item.name] : undefined;
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between py-1 px-2 rounded bg-muted/40 text-xs"
                  >
                    <div className="flex flex-col">
                      <span className="font-mono text-[11px]">
                        {item.name}{" "}
                        <span className="text-[10px] text-muted-foreground">({item.type})</span>
                      </span>
                      {result?.detail && (
                        <span className="text-[10px] text-muted-foreground">{result.detail}</span>
                      )}
                    </div>
                    {isCheckingEntities ? (
                      <span className="text-muted-foreground text-[10px]">Checking…</span>
                    ) : result?.kind === "present_with_data" ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="h-3 w-3" /> Present ({result.count} rows)
                      </span>
                    ) : result?.kind === "present_empty" ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="h-3 w-3" /> Present (0 rows)
                      </span>
                    ) : result?.kind === "rls_denied" ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1 text-[11px]">
                        <ShieldAlert className="h-3 w-3" /> RLS Restricted
                      </span>
                    ) : result?.kind === "missing" ? (
                      <span className="text-destructive font-medium inline-flex items-center gap-1 text-[11px]">
                        <XCircle className="h-3 w-3" /> Missing (PGRST205)
                      </span>
                    ) : (
                      <span className="text-destructive font-medium inline-flex items-center gap-1 text-[11px]">
                        <XCircle className="h-3 w-3" /> Error
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
