import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { LoginView } from "@/components/auth/LoginView";
import { UnauthorizedView } from "@/components/auth/UnauthorizedView";
import { useLoadAccounts, type LoadDetail } from "@/hooks/use-load-accounts";
import { AppHeader, BottomTabBar, type ActiveTab } from "@/components/navigation/BottomTabBar";
import { HomeView } from "@/components/home/HomeView";
import { LoadsView } from "@/components/loads/LoadsView";
import { PartiesView } from "@/components/parties/PartiesView";
import { ReportsView } from "@/components/reports/ReportsView";
import { SettingsView } from "@/components/settings/SettingsView";
import { ChallansView } from "@/components/challans/ChallansView";
import { useFormomaticChallans, type EnrichedChallan } from "@/hooks/use-formomatic-challans";
import { NewLoadWizard } from "@/components/loads/NewLoadWizard";
import { LoadDetailSheet } from "@/components/loads/LoadDetailSheet";
import { EditLoadModal } from "@/components/loads/EditLoadModal";
import { PaymentModal } from "@/components/loads/PaymentModal";
import type { PaymentKind } from "@/lib/calculations";
import type { NewLoadDraft } from "@/lib/draft-storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aarav Traders – Load Accounts" },
      {
        name: "description",
        content: "Mobile-first PWA for partner load accounts, truck accounting and cash tracking.",
      },
    ],
  }),
  component: AppIndex,
});

function AppIndex() {
  const { authStatus, user, isFirmMember, signInWithPassword, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab") as ActiveTab | null;
      if (tab && ["home", "loads", "challans", "parties", "reports", "settings"].includes(tab)) {
        return tab;
      }
    }
    return "home";
  });
  const [newLoadOpen, setNewLoadOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("newLoad") === "true";
    }
    return false;
  });
  const [initialDraftForLoad, setInitialDraftForLoad] = useState<Partial<NewLoadDraft> | undefined>(
    undefined,
  );
  const [selectedLoad, setSelectedLoad] = useState<LoadDetail | null>(null);
  const [editingLoad, setEditingLoad] = useState<LoadDetail | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<{
    load: LoadDetail;
    kind: PaymentKind;
  } | null>(null);

  const isAuthorized = authStatus === "authorized" && isFirmMember;

  const {
    realtimeStatus,
    settings,
    settingsError,
    refetchSettings,
    loads,
    isLoadingLoads,
    errorLoads,
    refetchLoads,
    parties,
    isLoadingParties,
    errorParties,
    refetchParties,
    partyBalances,
    payments,
    monthlyReports,
    isLoadingMonthlyReports,
    errorMonthlyReports,
    refetchMonthlyReports,
    unsoldStock,
    auditLogs,
    createLoad,
    updateLoad,
    createParty,
    softDeleteLoad,
    recordPayment,
    deletePayment,
    updateSettings,
  } = useLoadAccounts({ enabled: isAuthorized });

  // Live Sync from Formomatic delivery challans (Only Aarav Traders bills)
  const {
    data: challans = [],
    isLoading: isLoadingChallans,
    error: errorChallans,
    refetch: refetchChallans,
  } = useFormomaticChallans(loads, isAuthorized);

  const pendingChallansCount = challans.filter((c) => !c.isConverted).length;

  const handleCreateLoadFromChallan = (c: EnrichedChallan) => {
    const today = new Date().toISOString().split("T")[0]!;
    const isBriquette = String(c.material_type).toLowerCase().includes("briquette");

    const matchedBuyer = parties.find(
      (p) =>
        p.type === "buyer" &&
        p.name.trim().toLowerCase() === (c.party_name ?? "").trim().toLowerCase(),
    );

    setInitialDraftForLoad({
      step: 1, // Start on Step 1: User will enter Supplier & Buy Rate
      load_date: c.date ? c.date.slice(0, 10) : today,
      material: isBriquette ? "briquette" : "coal",
      truck_number: c.truck_no ?? "",
      tons_bought: c.quantity ?? "",
      tons_loaded: c.quantity ?? "",
      freight_rate: c.freight_rate ?? "",
      has_sale: true, // Step 3 Sale details are automatically filled from the challan!
      buyer_id: matchedBuyer?.id ?? "",
      buyer_name: c.party_name ?? "",
      sale_date: c.date ? c.date.slice(0, 10) : today,
      tons_received: c.quantity ?? "",
      sale_rate: "", // User enters sale rate in Step 3
      credit_days: matchedBuyer?.credit_days
        ? String(matchedBuyer.credit_days)
        : settings?.default_credit_days
          ? String(settings.default_credit_days)
          : "30",
      challan_no: c.pc_no,
    });

    setNewLoadOpen(true);
  };

  // 0. Loading gate: Checking persistent session
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-teal-700 dark:bg-teal-600 flex items-center justify-center text-white font-black text-xl shadow-md animate-pulse">
            AT
          </div>
          <p className="text-xs font-semibold text-muted-foreground">Resuming secure session...</p>
        </div>
      </div>
    );
  }

  // 1. Unauthenticated gate: User must sign in
  if (authStatus === "unauthenticated") {
    return <LoginView onSignIn={signInWithPassword} />;
  }

  // 2. Unauthorized non-member gate: Signed in but not in firm_members
  if (authStatus === "unauthorized") {
    return <UnauthorizedView email={user?.email ?? undefined} onSignOut={signOut} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Sticky App Header (Mobile + Desktop Navigation) */}
      <AppHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewLoadClick={() => {
          setInitialDraftForLoad(undefined);
          setNewLoadOpen(true);
        }}
        realtimeStatus={realtimeStatus}
        onSettingsClick={() => setActiveTab("settings")}
        pendingChallansCount={pendingChallansCount}
      />

      {/* Main Tab Screen */}
      <main className="flex-1">
        {activeTab === "home" && (
          <HomeView
            loads={loads}
            unsoldStock={unsoldStock}
            isLoading={isLoadingLoads}
            error={errorLoads}
            onRetry={refetchLoads}
            onNewLoadClick={() => {
              setInitialDraftForLoad(undefined);
              setNewLoadOpen(true);
            }}
            onSelectLoad={(load) => setSelectedLoad(load)}
            onViewAllLoads={() => setActiveTab("loads")}
          />
        )}

        {activeTab === "loads" && (
          <LoadsView
            loads={loads}
            isLoading={isLoadingLoads}
            error={errorLoads}
            onRetry={refetchLoads}
            onSelectLoad={(load) => setSelectedLoad(load)}
            onNewLoadClick={() => {
              setInitialDraftForLoad(undefined);
              setNewLoadOpen(true);
            }}
            onViewChallansClick={() => setActiveTab("challans")}
            pendingChallansCount={pendingChallansCount}
            challans={challans}
          />
        )}

        {activeTab === "challans" && (
          <ChallansView
            challans={challans}
            isLoading={isLoadingChallans}
            error={errorChallans}
            onRefresh={() => refetchChallans()}
            onCreateLoadFromChallan={handleCreateLoadFromChallan}
            onSelectLoad={(load) => setSelectedLoad(load)}
          />
        )}

        {activeTab === "parties" && (
          <PartiesView
            parties={parties}
            partyBalances={partyBalances}
            loads={loads}
            payments={payments}
            isLoading={isLoadingParties}
            error={errorParties}
            onRetry={refetchParties}
            onRecordPayment={(load, kind) => setPaymentTarget({ load, kind: kind ?? "purchase" })}
            onDeletePayment={deletePayment}
            onAddParty={async (p) => {
              await createParty({
                name: p.name,
                type: p.type,
                phone: p.phone ?? null,
                credit_days: p.credit_days ?? null,
              });
            }}
          />
        )}

        {activeTab === "reports" && (
          <ReportsView
            monthlyReports={monthlyReports}
            unsoldStock={unsoldStock}
            isLoading={isLoadingMonthlyReports}
            error={errorMonthlyReports}
            onRetry={refetchMonthlyReports}
            loads={loads}
          />
        )}

        {activeTab === "settings" && (
          <SettingsView
            settings={settings}
            settingsError={settingsError}
            onRetrySettings={refetchSettings}
            auditLogs={auditLogs}
            onUpdateSettings={updateSettings}
            onBack={() => setActiveTab("home")}
            onSignOut={signOut}
            userEmail={user?.email}
            isFirmMember={isFirmMember}
            realtimeStatus={realtimeStatus}
          />
        )}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onNewLoadClick={() => {
          setInitialDraftForLoad(undefined);
          setNewLoadOpen(true);
        }}
        pendingChallansCount={pendingChallansCount}
      />

      {/* New Load 3-Step Wizard Fullscreen Modal */}
      {newLoadOpen && (
        <NewLoadWizard
          parties={parties}
          settings={settings}
          settingsError={settingsError}
          initialDraft={initialDraftForLoad}
          onClose={() => {
            setInitialDraftForLoad(undefined);
            setNewLoadOpen(false);
          }}
          onSubmit={async (newLoad) => {
            await createLoad(newLoad);
            setInitialDraftForLoad(undefined);
            refetchChallans();
          }}
          onAddParty={async (newParty) => {
            const created = await createParty({
              name: newParty.name,
              type: newParty.type,
              phone: newParty.phone ?? null,
              credit_days: newParty.credit_days ?? null,
            });
            return created;
          }}
        />
      )}

      {/* Edit Load Modal */}
      {editingLoad && (
        <EditLoadModal
          open={!!editingLoad}
          onOpenChange={(open) => {
            if (!open) setEditingLoad(null);
          }}
          load={editingLoad}
          parties={parties}
          onUpdateLoad={async (id, updates) => {
            await updateLoad({ id, updates });
          }}
        />
      )}

      {/* Load Details Bottom Sheet */}
      {selectedLoad && (
        <LoadDetailSheet
          load={selectedLoad}
          open={!!selectedLoad}
          payments={payments}
          challans={challans}
          onOpenChange={(open) => {
            if (!open) setSelectedLoad(null);
          }}
          onEditLoadClick={(load) => {
            setSelectedLoad(null);
            setEditingLoad(load);
          }}
          onRecordPaymentClick={(load, kind) => {
            setSelectedLoad(null);
            setPaymentTarget({
              load,
              kind: kind ?? (load.buyer_id ? "sale" : "purchase"),
            });
          }}
          onDeletePayment={deletePayment}
          onSoftDelete={async (id) => {
            await softDeleteLoad(id);
          }}
        />
      )}

      {/* Record Payment Sheet */}
      {paymentTarget && (
        <PaymentModal
          key={`${paymentTarget.load.id}-${paymentTarget.kind}`}
          open={!!paymentTarget}
          onOpenChange={(open) => {
            if (!open) setPaymentTarget(null);
          }}
          load={paymentTarget.load}
          defaultKind={paymentTarget.kind}
          onRecordPayment={async (p) => {
            let bill = 0;
            let existing = 0;
            if (p.kind === "purchase") {
              bill = paymentTarget.load.purchase_total;
              existing = paymentTarget.load.purchase_paid;
            } else if (p.kind === "freight") {
              bill = paymentTarget.load.freight_amount;
              existing = paymentTarget.load.freight_paid;
            } else if (p.kind === "sale") {
              bill = paymentTarget.load.sale_total ?? 0;
              existing = paymentTarget.load.sale_paid;
            }

            await recordPayment({
              payment: {
                load_id: p.load_id,
                party_id: p.party_id,
                kind: p.kind,
                amount: p.amount,
                payment_date: p.payment_date,
                mode: p.mode,
                reference: p.reference ?? null,
              },
              billTotal: bill,
              existingPayments: existing,
            });
          }}
        />
      )}
    </div>
  );
}
