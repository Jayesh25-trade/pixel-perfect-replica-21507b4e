import { useState, useEffect } from "react";
import { Sun, Moon, Monitor, Shield, Save, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/hooks/use-theme";
import { QueryErrorState } from "@/components/common/QueryErrorState";
import { SystemCheckPanel } from "@/components/settings/SystemCheckPanel";
import type { Settings, AuditLog, RealtimeStatus } from "@/hooks/use-load-accounts";
import { formatDate } from "@/lib/calculations";

interface SettingsViewProps {
  settings?: Settings | undefined;
  settingsError?: unknown;
  onRetrySettings?: () => void;
  auditLogs: AuditLog[];
  onUpdateSettings: (updates: Partial<Settings>) => Promise<void>;
  onBack: () => void;
  onSignOut?: () => Promise<void>;
  userEmail?: string | undefined;
  isFirmMember?: boolean | undefined;
  realtimeStatus?: RealtimeStatus | undefined;
}

export function SettingsView({
  settings,
  settingsError,
  onRetrySettings,
  auditLogs,
  onUpdateSettings,
  onBack,
  onSignOut,
  userEmail,
  isFirmMember,
  realtimeStatus,
}: SettingsViewProps) {
  const { theme, setTheme } = useTheme();

  const [coalGst, setCoalGst] = useState(() => (settings ? String(settings.gst_rate_coal) : ""));
  const [briquetteGst, setBriquetteGst] = useState(() =>
    settings ? String(settings.gst_rate_briquette) : "",
  );
  const [tcsPurchase, setTcsPurchase] = useState(() =>
    settings ? String(settings.tcs_rate_purchase ?? 0) : "0",
  );
  const [creditDays, setCreditDays] = useState(() =>
    settings ? String(settings.default_credit_days) : "",
  );
  const [saving, setSaving] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    if (settings) {
      setCoalGst(String(settings.gst_rate_coal));
      setBriquetteGst(String(settings.gst_rate_briquette));
      setTcsPurchase(String(settings.tcs_rate_purchase ?? 0));
      setCreditDays(String(settings.default_credit_days));
    }
  }, [settings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await onUpdateSettings({
        gst_rate_coal: parseFloat(coalGst) || 18,
        gst_rate_briquette: parseFloat(briquetteGst) || 5,
        tcs_rate_purchase: parseFloat(tcsPurchase) || 2,
        default_credit_days: parseInt(creditDays) || 30,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 px-4 py-3 pb-28 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-lg font-bold">App Settings</h2>
          <p className="text-xs text-muted-foreground">Theme, Rates & Audit Trail</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onBack} className="min-h-9">
          Done
        </Button>
      </div>

      {/* Theme Selection: Clean Ledger vs Dark Industrial */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-bold">Design Theme</h3>
          <p className="text-xs text-muted-foreground">
            Clean Ledger (light) or Dark Industrial (dark charcoal & amber)
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border p-2 transition-all ${
              theme === "light"
                ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <Sun className="h-5 w-5" />
            <span className="text-xs">Clean Ledger</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border p-2 transition-all ${
              theme === "dark"
                ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <Moon className="h-5 w-5" />
            <span className="text-xs">Dark Industrial</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme("system")}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border p-2 transition-all ${
              theme === "system"
                ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <Monitor className="h-5 w-5" />
            <span className="text-xs">System Auto</span>
          </button>
        </div>
      </div>

      {/* Dynamic GST & Business Settings */}
      {(!settings || !!settingsError) && (
        <QueryErrorState
          error={settingsError ?? "Network issue loading settings."}
          onRetry={onRetrySettings}
          title="Cannot load settings"
        />
      )}

      <form
        onSubmit={handleSaveSettings}
        className="rounded-xl border border-border bg-card p-4 space-y-4"
      >
        <div>
          <h3 className="text-sm font-bold">Trading Tax Rates</h3>
          <p className="text-xs text-muted-foreground">Coal & Briquette Tax Rules</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="coal-gst">Coal GST (%)</Label>
            <Input
              id="coal-gst"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={coalGst}
              onChange={(e) => setCoalGst(e.target.value)}
              className="min-h-12 text-base font-semibold"
              disabled={!settings}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="briquette-gst">Briquette GST (%)</Label>
            <Input
              id="briquette-gst"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={briquetteGst}
              onChange={(e) => setBriquetteGst(e.target.value)}
              className="min-h-12 text-base font-semibold"
              disabled={!settings}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="purchase-tcs">Coal Purchase TCS (%)</Label>
            <Input
              id="purchase-tcs"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={tcsPurchase}
              onChange={(e) => setTcsPurchase(e.target.value)}
              className="min-h-12 text-base font-semibold"
              disabled={!settings}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="default-credit">Default Credit Days</Label>
            <Input
              id="default-credit"
              type="number"
              inputMode="numeric"
              min="0"
              max="365"
              value={creditDays}
              onChange={(e) => setCreditDays(e.target.value)}
              className="min-h-12 text-base font-semibold"
              disabled={!settings}
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={!settings || saving}
          className="w-full min-h-12 font-bold text-sm gap-1.5 rounded-xl shadow-sm"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Tax Rates"}
        </Button>
      </form>

      {/* Account & Session Actions */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="space-y-0.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Signed In Firm Account
          </h3>
          <p className="text-sm font-extrabold text-foreground font-mono">
            {userEmail ?? "aaravtraders81@gmail.com"}
          </p>
        </div>
        {onSignOut && (
          <Button
            type="button"
            variant="outline"
            onClick={onSignOut}
            className="w-full min-h-11 border-destructive/40 text-destructive hover:bg-destructive/10 font-bold rounded-xl"
          >
            Sign Out of Aarav Traders
          </Button>
        )}
      </div>

      {/* Discrete Technical Diagnostic Toggle for IT only */}
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground underline"
        >
          {showDiagnostics ? "Hide Technical Diagnostics" : "Technical Diagnostics (Admin only)"}
        </button>
      </div>

      {showDiagnostics && (
        <div className="space-y-4 pt-2 border-t border-border/50 animate-in fade-in duration-200">
          <SystemCheckPanel
            settings={settings}
            userEmail={userEmail}
            isFirmMember={isFirmMember}
            realtimeStatus={realtimeStatus}
          />

          <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-foreground">Partner Access & Security</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              All transactions enforce Row-Level Security checking the firm_members table.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Recent Audit History ({auditLogs.length})
            </h3>

            {auditLogs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                No audit records logged yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-border bg-card p-2.5 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                            log.action === "INSERT"
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                              : log.action === "UPDATE"
                                ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                                : "bg-destructive/20 text-destructive"
                          }`}
                        >
                          {log.action}
                        </span>
                        <strong className="text-foreground">{log.table_name}</strong>
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">
                        {formatDate(log.created_at)}
                      </span>
                    </div>

                    <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
