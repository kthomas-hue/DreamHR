import type { Employee, NewEmployee, Stats } from "./types";

const BASE = "/api";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Request failed with ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listEmployees: () => fetch(`${BASE}/employees`).then((r) => handle<Employee[]>(r)),
  getStats: () => fetch(`${BASE}/stats`).then((r) => handle<Stats>(r)),
  createEmployee: (payload: NewEmployee) =>
    fetch(`${BASE}/employees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => handle<Employee>(r)),
  deleteEmployee: (id: string) =>
    fetch(`${BASE}/employees/${id}`, { method: "DELETE" }).then((r) => handle<void>(r)),
};
