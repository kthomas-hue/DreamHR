import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { ActionStream } from "../components/ActionStream";
import type { ActionItem } from "../types";
import { Banner, PageHeader, Spinner } from "../ui";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "urgent", label: "Urgent" },
  { key: "policy_ack", label: "Policies" },
  { key: "credential_renewal", label: "Credentials" },
  { key: "leave_approval", label: "Leave" },
];

export function Actions() {
  const [actions, setActions] = useState<ActionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.actions().then(setActions).catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!actions) return [];
    if (filter === "all") return actions;
    if (filter === "urgent") return actions.filter((a) => a.urgency === "urgent");
    return actions.filter((a) => a.category === filter || (filter === "credential_renewal" && a.category === "credential_verify"));
  }, [actions, filter]);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!actions) return <Spinner />;

  return (
    <>
      <PageHeader
        eyebrow="Shared task service"
        title="Action centre"
        subtitle="Assigned, delegated and overdue work across your enabled modules. Every item links to its source record."
      />
      <div className="tabs">
        {FILTERS.map((f) => (
          <div key={f.key} className={`tab ${filter === f.key ? "active" : ""}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </div>
        ))}
      </div>
      <ActionStream actions={filtered} />
    </>
  );
}
