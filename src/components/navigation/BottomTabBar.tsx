import {
  Home,
  Truck,
  Plus,
  Users,
  BarChart3,
  FileText,
  Settings as SettingsIcon,
  WifiOff,
} from "lucide-react";
import { useOfflineStatus } from "@/lib/offline-queue";

export type ActiveTab = "home" | "loads" | "challans" | "parties" | "reports" | "settings";

interface BottomTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onNewLoadClick: () => void;
  pendingChallansCount?: number | undefined;
}

export function BottomTabBar({
  activeTab,
  onTabChange,
  onNewLoadClick,
  pendingChallansCount = 0,
}: BottomTabBarProps) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 dark:border-slate-800/80 bg-card/90 backdrop-blur-xl safe-bottom no-print shadow-xl"
      aria-label="Main Navigation"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-1.5">
        {/* 1. Home */}
        <button
          type="button"
          onClick={() => onTabChange("home")}
          className={`flex min-h-[50px] min-w-[46px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-all ${
            activeTab === "home"
              ? "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10"
              : "text-muted-foreground hover:text-foreground active:scale-95"
          }`}
          aria-label="Home Tab"
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px] leading-none">Home</span>
        </button>

        {/* 2. Loads */}
        <button
          type="button"
          onClick={() => onTabChange("loads")}
          className={`flex min-h-[50px] min-w-[46px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-all ${
            activeTab === "loads"
              ? "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10"
              : "text-muted-foreground hover:text-foreground active:scale-95"
          }`}
          aria-label="Loads Tab"
        >
          <Truck className="h-5 w-5" />
          <span className="text-[10px] leading-none">Trucks</span>
        </button>

        {/* 3. Center Elevated + New Load */}
        <div className="flex flex-1 items-center justify-center px-0.5">
          <button
            type="button"
            onClick={onNewLoadClick}
            style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 transition-transform active:scale-90 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            aria-label="Create New Load"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
        </div>

        {/* 4. Challans */}
        <button
          type="button"
          onClick={() => onTabChange("challans")}
          className={`relative flex min-h-[50px] min-w-[46px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-all ${
            activeTab === "challans"
              ? "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10"
              : "text-muted-foreground hover:text-foreground active:scale-95"
          }`}
          aria-label="Challans Tab"
        >
          <FileText className="h-5 w-5" />
          <span className="text-[10px] leading-none">Challans</span>
          {pendingChallansCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-white">
              {pendingChallansCount}
            </span>
          )}
        </button>

        {/* 5. Parties */}
        <button
          type="button"
          onClick={() => onTabChange("parties")}
          className={`flex min-h-[50px] min-w-[46px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-all ${
            activeTab === "parties"
              ? "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10"
              : "text-muted-foreground hover:text-foreground active:scale-95"
          }`}
          aria-label="Parties Tab"
        >
          <Users className="h-5 w-5" />
          <span className="text-[10px] leading-none font-medium">Parties</span>
        </button>

        {/* 6. Reports */}
        <button
          type="button"
          onClick={() => onTabChange("reports")}
          className={`flex min-h-[50px] min-w-[46px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 transition-all ${
            activeTab === "reports"
              ? "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10"
              : "text-muted-foreground hover:text-foreground active:scale-95"
          }`}
          aria-label="Reports Tab"
        >
          <BarChart3 className="h-5 w-5" />
          <span className="text-[10px] leading-none font-medium">Reports</span>
        </button>
      </div>
    </nav>
  );
}

export function AppHeader({
  onSettingsClick,
  activeTab,
  onTabChange,
  onNewLoadClick,
  pendingChallansCount = 0,
}: {
  onSettingsClick: () => void;
  activeTab?: ActiveTab;
  onTabChange?: (tab: ActiveTab) => void;
  onNewLoadClick?: () => void;
  realtimeStatus?: unknown;
  pendingChallansCount?: number | undefined;
}) {
  const { isOnline, queueCount } = useOfflineStatus();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-card/90 px-4 md:px-8 py-3 backdrop-blur-xl safe-top no-print shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 font-black text-white text-sm shadow-md shadow-emerald-600/25"
          >
            AT
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight leading-tight">Aarav Traders</h1>
            <p className="text-[11px] text-muted-foreground font-semibold">
              Coal & Biomass Logistics
            </p>
          </div>
        </div>

        {/* Desktop Navigation Tabs (Visible on MD+, hidden on mobile) */}
        {onTabChange && (
          <nav className="hidden md:flex items-center gap-1 bg-muted/60 p-1 rounded-2xl border border-border/60">
            <button
              type="button"
              onClick={() => onTabChange("home")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "home"
                  ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Home</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange("loads")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "loads"
                  ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              <Truck className="h-4 w-4" />
              <span>Trucks</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange("challans")}
              className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "challans"
                  ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Aarav Challans</span>
              {pendingChallansCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-white">
                  {pendingChallansCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onTabChange("parties")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "parties"
                  ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Parties</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange("reports")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "reports"
                  ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Reports</span>
            </button>
          </nav>
        )}

        {/* Right Side: Action + Status + Settings */}
        <div className="flex items-center gap-2.5">
          {/* Desktop New Load Action Button */}
          {onNewLoadClick && (
            <button
              type="button"
              onClick={onNewLoadClick}
              style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:brightness-105 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>New Consignment</span>
            </button>
          )}

          {!isOnline ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <WifiOff className="h-3 w-3" />
              Offline {queueCount > 0 ? `(${queueCount})` : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Auto-Saved
            </span>
          )}

          <button
            type="button"
            onClick={onSettingsClick}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 dark:border-slate-800 bg-card text-foreground transition-all hover:bg-muted active:scale-95 touch-target shadow-xs"
            aria-label="Settings"
          >
            <SettingsIcon className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
}
