export type PaletteKey =
  | "purple_teal"
  | "deep_teal_sage"
  | "plum_stone"
  | "charcoal_neutral";

export interface PaletteTokens {
  brand: string;
  brandStrong: string;
  brandSoft: string;
  brandContrast: string;
  accent: string;
  gradFrom: string;
  gradTo: string;
}

// Four tested directions (BRD-01). Status colours stay consistent across
// palettes (BRD-02); only brand/accent tokens change.
export const PALETTES: Record<PaletteKey, { label: string; tokens: PaletteTokens }> = {
  purple_teal: {
    label: "DreamStoneHR purple & teal",
    tokens: {
      brand: "#6d28d9",
      brandStrong: "#5b21b6",
      brandSoft: "#f3f0ff",
      brandContrast: "#ffffff",
      accent: "#0d9488",
      gradFrom: "#7c3aed",
      gradTo: "#0d9488",
    },
  },
  deep_teal_sage: {
    label: "Deep teal & sage",
    tokens: {
      brand: "#0f766e",
      brandStrong: "#115e59",
      brandSoft: "#effaf7",
      brandContrast: "#ffffff",
      accent: "#84a98c",
      gradFrom: "#0f766e",
      gradTo: "#84a98c",
    },
  },
  plum_stone: {
    label: "Plum & stone",
    tokens: {
      brand: "#86326a",
      brandStrong: "#6b2453",
      brandSoft: "#fbf1f7",
      brandContrast: "#ffffff",
      accent: "#a8a29e",
      gradFrom: "#86326a",
      gradTo: "#a8a29e",
    },
  },
  charcoal_neutral: {
    label: "Charcoal & warm neutral",
    tokens: {
      brand: "#374151",
      brandStrong: "#1f2937",
      brandSoft: "#f4f4f5",
      brandContrast: "#ffffff",
      accent: "#b45309",
      gradFrom: "#374151",
      gradTo: "#b45309",
    },
  },
};

export function applyPalette(key: PaletteKey): void {
  const tokens = (PALETTES[key] ?? PALETTES.purple_teal).tokens;
  const root = document.documentElement;
  root.style.setProperty("--brand", tokens.brand);
  root.style.setProperty("--brand-strong", tokens.brandStrong);
  root.style.setProperty("--brand-soft", tokens.brandSoft);
  root.style.setProperty("--brand-contrast", tokens.brandContrast);
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--grad-from", tokens.gradFrom);
  root.style.setProperty("--grad-to", tokens.gradTo);
}
