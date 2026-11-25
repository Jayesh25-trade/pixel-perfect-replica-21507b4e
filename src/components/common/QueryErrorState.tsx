import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryErrorStateProps {
  error: unknown;
  onRetry?: (() => void) | undefined;
  title?: string | undefined;
}

export function QueryErrorState({ error, onRetry, title }: QueryErrorStateProps) {
  const errMsg =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : error instanceof Error
        ? error.message
        : String(error ?? "");

  return (
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-4 max-w-md mx-auto my-4 shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-foreground">{title ?? "Unable to connect"}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {errMsg ? errMsg : "Please check your internet connection and try again."}
        </p>
      </div>

      {onRetry && (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          className="gap-2 text-xs font-semibold touch-target mx-auto rounded-xl"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}
