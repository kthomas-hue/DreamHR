import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { PersonRow } from "../types";
import { Avatar, Banner, Card, EmptyState, PageHeader, Pill, Spinner } from "../ui";
import { titleCase } from "../utils";

export function People() {
  const nav = useNavigate();
  const [people, setPeople] = useState<PersonRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [team, setTeam] = useState("All");

  useEffect(() => {
    api.people().then(setPeople).catch((e) => setError(e.message));
  }, []);

  const teams = useMemo(() => {
    if (!people) return ["All"];
    return ["All", ...Array.from(new Set(people.map((p) => p.team))).sort()];
  }, [people]);

  const filtered = useMemo(() => {
    if (!people) return [];
    const s = q.trim().toLowerCase();
    return people.filter((p) => {
      const mt = team === "All" || p.team === team;
      const ms = !s || p.name.toLowerCase().includes(s) || p.title.toLowerCase().includes(s) || p.workEmail.toLowerCase().includes(s);
      return mt && ms;
    });
  }, [people, q, team]);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!people) return <Spinner />;

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title="People"
        subtitle="Permission-aware directory. You only see people within your assigned scope."
      />
      <div className="toolbar">
        <input className="input search" placeholder="Search name, title or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" style={{ maxWidth: 220 }} value={team} onChange={(e) => setTeam(e.target.value)}>
          {teams.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <div className="grow" />
        <Pill tone="neutral">{filtered.length} of {people.length}</Pill>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon="◇" title="No people match your filters" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Title</th>
                <th>Team</th>
                <th>Site</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} onClick={() => nav(`/people/${p.id}`)}>
                  <td>
                    <div className="person-cell">
                      <Avatar name={p.name} />
                      <div>
                        <div className="pn">{p.name}</div>
                        <div className="muted small">{p.workEmail}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.title}</td>
                  <td><Pill tone="brand">{p.team}</Pill></td>
                  <td className="muted">{p.site}</td>
                  <td className="muted">{titleCase(p.employmentType)}</td>
                  <td><Pill tone={p.status === "active" ? "success" : "neutral"}>{titleCase(p.status)}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
