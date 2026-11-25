import { useContext } from "react";
import { ThemeContext, type Theme, type ThemeContextType } from "@/context/theme-context";

export type { Theme, ThemeContextType };

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
