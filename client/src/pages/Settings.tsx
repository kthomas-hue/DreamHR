import { useEffect, useState } from "react";
import { api, type SettingsPayload } from "../api";
import { useAuth } from "../auth/AuthContext";
import { applyPalette, PALETTES, type PaletteKey } from "../theme/palettes";
import type { ModuleKey, ModuleState } from "../types";
import { Banner, Card, PageHeader, Pill, Spinner } from "../ui";
import { titleCase } from "../utils";

const OPTIONAL_MODULES: ModuleKey[] = ["policies", "credentials", "leave", "safety", "lifecycle", "reviews", "reporting"];
const MODULE_STATES: ModuleState[] = ["active", "configuring", "read_only", "off"];
const STATE_TONE: Record<ModuleState, "success" | "info" | "warning" | "neutral"> = {
  active: "success", configuring: "info", read_only: "warning", off: "neutral",
};

export function Settings() {
  const { me, refresh } = useAuth();
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setData(await api.settings());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function setModuleState(module: ModuleKey, state: ModuleState) {
    setSaving(true);
    try {
      await api.setModule(module, state);
      await load();
      await refresh(); // update navigation entitlements
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function selectPalette(palette: PaletteKey) {
    applyPalette(palette); // instant preview
    setSaving(true);
    try {
      await api.setBranding(palette);
      await refresh();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return <Spinner />;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        subtitle="Module entitlements and branding for this client workspace. Changes are audited."
      />

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <Card>
          <div className="card-header"><h3>Module controls</h3>{saving && <span className="muted small">Saving…</span>}</div>
          <div className="card-pad" style={{ display: "grid", gap: 10 }}>
            <div className="muted small">Core modules (people, permissions, files, audit) cannot be turned off.</div>
            {OPTIONAL_MODULES.map((m) => (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{titleCase(m)}</div>
                </div>
                <Pill tone={STATE_TONE[(data.modules[m] as ModuleState) ?? "off"]}>{titleCase(data.modules[m] ?? "off")}</Pill>
                <select
                  className="select"
                  style={{ maxWidth: 150 }}
                  value={data.modules[m]}
                  onChange={(e) => setModuleState(m, e.target.value as ModuleState)}
                >
                  {MODULE_STATES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: "grid", gap: 16 }}>
          <Card>
            <div className="card-header"><h3>Branding</h3></div>
            <div className="card-pad">
              <div className="muted small" style={{ marginBottom: 12 }}>
                Choose an accessible palette. The change applies instantly across the workspace, login and documents.
              </div>
              <div className="palette-grid">
                {(Object.keys(PALETTES) as PaletteKey[]).map((key) => {
                  const t = PALETTES[key].tokens;
                  const selected = me?.activeClient?.palette === key;
                  return (
                    <div key={key} className={`palette-card ${selected ? "selected" : ""}`} onClick={() => selectPalette(key)}>
                      <div className="swatch-row">
                        <div className="swatch" style={{ background: t.brand }} />
                        <div className="swatch" style={{ background: t.accent }} />
                        <div className="swatch" style={{ background: t.brandSoft, border: "1px solid var(--line)" }} />
                      </div>
                      <div className="pc-label">{PALETTES[key].label}</div>
                      {selected && <div className="eyebrow" style={{ marginTop: 4 }}>Selected</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-header"><h3>Organisation</h3></div>
            <div className="card-pad detail-grid">
              <div><div className="dk">Legal name</div><div className="dv">{data.client.legalName}</div></div>
              <div><div className="dk">ABN</div><div className="dv">{data.client.abn}</div></div>
              <div><div className="dk">Client code</div><div className="dv">{data.client.code}</div></div>
              <div><div className="dk">Time zone</div><div className="dv">{data.client.timezone}</div></div>
              <div><div className="dk">Sites</div><div className="dv">{data.sites.map((s) => s.name).join(", ")}</div></div>
              <div><div className="dk">Teams</div><div className="dv">{data.teams.map((t) => t.name).join(", ")}</div></div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
