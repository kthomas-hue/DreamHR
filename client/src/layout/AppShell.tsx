import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import type { ModuleKey, ModuleState, Role } from "../types";
import { titleCase } from "../utils";

interface NavDef {
  to: string;
  label: string;
  icon: string;
  module?: ModuleKey;
  roles?: Role[];
  showBadge?: boolean;
}

const NAV: NavDef[] = [
  { to: "/", label: "Home", icon: "⌂" },
  { to: "/people", label: "People", icon: "◇", roles: ["client_admin", "manager", "consultant", "platform_owner", "auditor", "safety_officer"] },
  { to: "/actions", label: "Action centre", icon: "◎", showBadge: true },
  { to: "/policies", label: "Policies", icon: "▤", module: "policies" },
  { to: "/credentials", label: "Credentials", icon: "✦", module: "credentials" },
  { to: "/leave", label: "Leave", icon: "◷", module: "leave" },
  { to: "/reports", label: "Reports", icon: "▦", module: "reporting", roles: ["client_admin", "manager", "consultant", "platform_owner", "auditor"] },
  { to: "/settings", label: "Settings", icon: "⚙", roles: ["client_admin", "consultant", "platform_owner"] },
];

function moduleVisible(state: ModuleState | undefined, role: Role | null): boolean {
  if (!state) return false;
  if (state === "off") return false;
  if (state === "configuring") return role === "client_admin" || role === "consultant" || role === "platform_owner";
  return true;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { me, logout, switchClient } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [urgentCount, setUrgentCount] = useState(0);

  const active = me?.activeClient ?? null;
  const role = me?.role ?? null;

  useEffect(() => {
    if (!active) {
      setUrgentCount(0);
      return;
    }
    api
      .home()
      .then((h) => setUrgentCount(h.summary.urgent + h.summary.high))
      .catch(() => setUrgentCount(0));
  }, [active, loc.pathname]);

  const visibleNav = useMemo(() => {
    if (!active) return []; // portfolio (no client) — nav hidden, home is portfolio
    return NAV.filter((item) => {
      if (item.roles && (!role || !item.roles.includes(role))) return false;
      if (item.module && !moduleVisible(active.modules[item.module], role)) return false;
      return true;
    });
  }, [active, role]);

  const roleLabel = me?.user.isDreamStone
    ? active
      ? "DreamStoneHR consultant"
      : "DreamStoneHR"
    : role
      ? titleCase(role)
      : "";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-brand">
          <div className="logo-mark">DH</div>
          <div>
            <div className="b-name">DreamHR</div>
            <div className="b-sub">by DreamStoneHR</div>
          </div>
        </div>

        {/* Client switcher (SEC-03: active client always visible) */}
        <div className="client-switch" onClick={() => setMenuOpen((v) => !v)}>
          <div className="cs-label">{active ? "Active client" : "Workspace"}</div>
          <div className="cs-row">
            <div className="cs-name">{active ? active.displayName : "DreamStoneHR Portfolio"}</div>
            <div className="cs-caret">▾</div>
          </div>
          {menuOpen && me && (
            <div className="cs-menu" onClick={(e) => e.stopPropagation()}>
              {me.user.isDreamStone && (
                <div
                  className="cs-item"
                  onClick={async () => {
                    setMenuOpen(false);
                    await switchClient(null);
                    nav("/");
                  }}
                >
                  <span className="cs-badge">DS</span>
                  <span className="cs-name">DreamStoneHR Portfolio</span>
                </div>
              )}
              {me.clients.map((c) => (
                <div
                  key={c.id}
                  className="cs-item"
                  onClick={async () => {
                    setMenuOpen(false);
                    await switchClient(c.id);
                    nav("/");
                  }}
                >
                  <span className="cs-badge">{c.logoText}</span>
                  <span className="cs-name">{c.displayName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <nav className="nav">
          {visibleNav.map((item) => {
            const isActive = item.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(item.to);
            return (
              <div
                key={item.to}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => nav(item.to)}
              >
                <span className="nav-ico">{item.icon}</span>
                <span>{item.label}</span>
                {item.showBadge && urgentCount > 0 && <span className="badge-count">{urgentCount}</span>}
              </div>
            );
          })}
        </nav>

        <div className="side-user">
          <span className="avatar sm">{me?.user.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}</span>
          <div>
            <div className="su-name">{me?.user.name}</div>
            <div className="su-role">{roleLabel}</div>
          </div>
          <span className="su-logout" onClick={() => logout()}>
            Sign out
          </span>
        </div>
      </aside>

      <main className="content">
        <div className="content-inner">{children}</div>
      </main>
    </div>
  );
}
