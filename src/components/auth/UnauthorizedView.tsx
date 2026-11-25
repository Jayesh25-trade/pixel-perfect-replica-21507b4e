import { ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UnauthorizedViewProps {
  email?: string | undefined;
  onSignOut: () => Promise<void>;
}

export function UnauthorizedView({ email, onSignOut }: UnauthorizedViewProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center px-4 py-8 max-w-md mx-auto text-center">
      {/* Icon */}
      <div className="h-16 w-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-6 shadow-sm">
        <ShieldAlert className="h-8 w-8" />
      </div>

      {/* Main Copy */}
      <h1 className="text-2xl font-bold tracking-tight mb-2">Account Not Authorized</h1>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mb-6">
        Your email {email ? <strong className="text-foreground">{email}</strong> : "account"} is not
        authorized. Ask the partners to add you to the firm whitelist.
      </p>

      {/* Card Info */}
      <div className="w-full rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground text-left space-y-2 mb-8 shadow-sm">
        <div className="font-semibold text-foreground">Why am I seeing this?</div>
        <p>
          Aarav Traders operates on a strict invite-only model. Only email addresses pre-authorized
          in <code className="text-foreground">allowed_emails</code> can access loads, financial
          records, and reports.
        </p>
      </div>

      {/* Sign Out Button */}
      <Button
        type="button"
        variant="outline"
        onClick={onSignOut}
        className="w-full touch-target text-sm font-semibold gap-2 border-border hover:bg-muted"
      >
        <LogOut className="h-4 w-4" /> Sign Out
      </Button>
    </div>
  );
}
