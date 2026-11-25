import { useQuery } from "@tanstack/react-query";
import type { FormomaticChallan } from "@/types/challan";
import type { LoadDetail } from "./use-load-accounts";

const FORMOMATIC_SUPABASE_URL = "https://jhupnoogsqvitcdpwihs.supabase.co";
const FORMOMATIC_ANON_KEY = "sb_publishable_V1i_NZHXPuCb-mGq-wBzNw_tKRPfTAk";

export interface EnrichedChallan extends FormomaticChallan {
  isAaravTrader: boolean;
  isConverted: boolean;
  matchedLoad?: LoadDetail | undefined;
}

export function normalizeTruck(truck?: string | null): string {
  return (truck ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function findMatchingChallan(
  load: { truck_number?: string | null } | null | undefined,
  challans: EnrichedChallan[] = [],
): EnrichedChallan | undefined {
  if (!load?.truck_number) return undefined;
  const lTruck = normalizeTruck(load.truck_number);
  if (!lTruck) return undefined;
  return challans.find((c) => normalizeTruck(c.truck_no) === lTruck);
}

export function useFormomaticChallans(existingLoads: LoadDetail[] = []) {
  return useQuery({
    queryKey: ["formomatic-challans", existingLoads.length],
    queryFn: async (): Promise<EnrichedChallan[]> => {
      const response = await fetch(
        `${FORMOMATIC_SUPABASE_URL}/rest/v1/challans?select=*&order=created_at.desc`,
        {
          headers: {
            apikey: FORMOMATIC_ANON_KEY,
            Authorization: `Bearer ${FORMOMATIC_ANON_KEY}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to load Formomatic challans: ${response.statusText}`);
      }

      const rows: FormomaticChallan[] = await response.json();

      // STRICT FILTER: Only Aarav Traders bills (pc_no starts with AT, e.g. AT/4, AT/5).
      // STRICTLY EXCLUDE all Parth Fuel Corporation bills (PC/...) even if party name mentions Aarav.
      const aaravRows = rows.filter((r) => {
        const pc = (r.pc_no ?? "").trim().toUpperCase();
        return pc.startsWith("AT");
      });

      // Match each challan to existing loads
      return aaravRows.map((c) => {
        const cTruckNorm = normalizeTruck(c.truck_no);
        const matchedLoad = existingLoads.find((l) => {
          const lTruckNorm = normalizeTruck(l.truck_number);
          if (cTruckNorm && lTruckNorm === cTruckNorm) {
            // Match if truck numbers match
            return true;
          }
          return false;
        });

        return {
          ...c,
          isAaravTrader: true,
          isConverted: Boolean(matchedLoad),
          matchedLoad,
        };
      });
    },
    staleTime: 30 * 1000,
    retry: 2,
  });
}
