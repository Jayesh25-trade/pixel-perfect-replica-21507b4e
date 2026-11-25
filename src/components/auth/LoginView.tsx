import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginViewProps {
  onSignIn: (email: string, password: string) => Promise<unknown>;
}

const REMEMBERED_EMAIL_KEY = "aarav_traders_saved_email";

export function LoginView({ onSignIn }: LoginViewProps) {
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;

    try {
      setLoading(true);
      await onSignIn(trimmedEmail, password);
      try {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, trimmedEmail);
      } catch {
        // ignore storage errors
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign in";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center px-4 py-8 max-w-md mx-auto">
      {/* Brand Header */}
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black text-2xl shadow-lg">
          AT
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Aarav Traders</h1>
          <p className="text-sm text-muted-foreground font-medium">
            Load Accounts & Partner Ledger
          </p>
        </div>
      </div>

      {/* Auth Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Partner Sign In</h2>
          <p className="text-xs text-muted-foreground">
            Enter the firm account email and password to access loads and ledger accounts.
          </p>
        </div>

        {/* Error Alert Card */}
        {errorMessage && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 flex items-start gap-2.5 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold block">Sign In Failed</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div className="space-y-1.5">
            <Label htmlFor="login-email" className="text-xs font-semibold">
              Email Address
            </Label>
            <div className="relative">
              <Input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@aaravtraders.in"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                required
                autoFocus
                className="pl-9 touch-target"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Password Input with Show/Hide Toggle */}
          <div className="space-y-1.5">
            <Label htmlFor="login-password" className="text-xs font-semibold">
              Password
            </Label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                required
                className="pl-9 pr-10 touch-target"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="w-full touch-target text-sm font-semibold gap-2 mt-2"
          >
            {loading ? "Signing in..." : "Sign in"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Security Note */}
      <div className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <Shield className="h-3.5 w-3.5 shrink-0" />
        <span>Invite-only firm account protected by Row Level Security.</span>
      </div>
    </div>
  );
}
