import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Employee, NewEmployee, Stats } from "./types";

const STATUS_LABELS: Record<Employee["status"], string> = {
  active: "Active",
  on_leave: "On leave",
  terminated: "Terminated",
};

const EMPTY_FORM: NewEmployee = {
  firstName: "",
  lastName: "",
  email: "",
  title: "",
  department: "Engineering",
  location: "Remote",
  status: "active",
  startDate: new Date().toISOString().slice(0, 10),
  salary: 0,
  managerId: null,
};

const DEPARTMENTS = [
  "Executive",
  "Engineering",
  "Design",
  "People",
  "Sales",
  "Finance",
  "Marketing",
];

function initials(e: Employee): string {
  return `${e.firstName[0] ?? ""}${e.lastName[0] ?? ""}`.toUpperCase();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewEmployee>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    try {
      setError(null);
      const [emps, s] = await Promise.all([api.listEmployees(), api.getStats()]);
      setEmployees(emps);
      setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const departments = useMemo(() => {
    const set = new Set(employees.map((e) => e.department));
    return ["All", ...Array.from(set).sort()];
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesDept = departmentFilter === "All" || e.department === departmentFilter;
      const matchesSearch =
        !q ||
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q);
      return matchesDept && matchesSearch;
    });
  }, [employees, search, departmentFilter]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.createEmployee({ ...form, salary: Number(form.salary) || 0 });
      setShowForm(false);
      setForm(EMPTY_FORM);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add employee");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const target = employees.find((e) => e.id === id);
    if (!target) return;
    if (!confirm(`Remove ${target.firstName} ${target.lastName} from DreamHR?`)) return;
    try {
      await api.deleteEmployee(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete employee");
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◆</span>
          <div>
            <h1>DreamHR</h1>
            <p>People operations, simplified</p>
          </div>
        </div>
        <button className="btn primary" onClick={() => setShowForm(true)}>
          + Add employee
        </button>
      </header>

      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}

      <section className="stats">
        <StatCard label="Total headcount" value={stats ? String(stats.headcount) : "—"} />
        <StatCard label="Active" value={stats ? String(stats.activeCount) : "—"} accent="green" />
        <StatCard label="Departments" value={stats ? String(stats.departmentCount) : "—"} accent="purple" />
        <StatCard
          label="Avg. salary"
          value={stats ? formatCurrency(stats.averageSalary) : "—"}
          accent="amber"
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Employee directory</h2>
          <div className="controls">
            <input
              className="input search"
              placeholder="Search name, email, or title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="input"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="muted pad">Loading employees…</p>
        ) : filtered.length === 0 ? (
          <p className="muted pad">No employees match your filters.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Title</th>
                <th>Department</th>
                <th>Location</th>
                <th>Status</th>
                <th className="right">Salary</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="person">
                      <span className="avatar">{initials(e)}</span>
                      <div>
                        <div className="name">
                          {e.firstName} {e.lastName}
                        </div>
                        <div className="muted small">{e.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{e.title}</td>
                  <td>
                    <span className="tag">{e.department}</span>
                  </td>
                  <td className="muted">{e.location}</td>
                  <td>
                    <span className={`status ${e.status}`}>{STATUS_LABELS[e.status]}</span>
                  </td>
                  <td className="right">{formatCurrency(e.salary)}</td>
                  <td className="right">
                    <button
                      className="btn ghost small"
                      onClick={() => handleDelete(e.id)}
                      aria-label={`Remove ${e.firstName} ${e.lastName}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="panel-footer muted small">
          Showing {filtered.length} of {employees.length} employees
        </div>
      </section>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add employee</h2>
            <form onSubmit={handleSubmit}>
              <div className="grid">
                <Field label="First name">
                  <input
                    className="input"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                </Field>
                <Field label="Last name">
                  <input
                    className="input"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <input
                    className="input"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </Field>
                <Field label="Title">
                  <input
                    className="input"
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </Field>
                <Field label="Department">
                  <select
                    className="input"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Location">
                  <input
                    className="input"
                    required
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </Field>
                <Field label="Start date">
                  <input
                    className="input"
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </Field>
                <Field label="Salary (USD)">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={form.salary}
                    onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? "Saving…" : "Save employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "purple" | "amber";
}) {
  return (
    <div className={`stat-card ${accent ?? ""}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
