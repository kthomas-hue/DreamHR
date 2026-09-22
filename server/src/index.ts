import cors from "cors";
import express from "express";
import {
  createEmployee,
  deleteEmployee,
  getEmployee,
  listEmployees,
  loadStore,
  updateEmployee,
} from "./store.js";
import type { NewEmployee } from "./types.js";

loadStore();

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "dreamhr-api", time: new Date().toISOString() });
});

app.get("/api/employees", (_req, res) => {
  res.json(listEmployees());
});

app.get("/api/employees/:id", (req, res) => {
  const employee = getEmployee(req.params.id);
  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(employee);
});

const REQUIRED_FIELDS: (keyof NewEmployee)[] = [
  "firstName",
  "lastName",
  "email",
  "title",
  "department",
  "location",
  "startDate",
];

app.post("/api/employees", (req, res) => {
  const body = req.body as Partial<NewEmployee>;
  const missing = REQUIRED_FIELDS.filter((field) => !body[field]);
  if (missing.length > 0) {
    res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
    return;
  }
  const employee = createEmployee({
    firstName: String(body.firstName),
    lastName: String(body.lastName),
    email: String(body.email),
    title: String(body.title),
    department: String(body.department),
    location: String(body.location),
    status: (body.status as NewEmployee["status"]) ?? "active",
    startDate: String(body.startDate),
    salary: Number(body.salary ?? 0),
    managerId: body.managerId ?? null,
  });
  res.status(201).json(employee);
});

app.patch("/api/employees/:id", (req, res) => {
  const updated = updateEmployee(req.params.id, req.body as Partial<NewEmployee>);
  if (!updated) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(updated);
});

app.delete("/api/employees/:id", (req, res) => {
  const removed = deleteEmployee(req.params.id);
  if (!removed) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.status(204).end();
});

app.get("/api/stats", (_req, res) => {
  const employees = listEmployees();
  const byDepartment: Record<string, number> = {};
  let totalSalary = 0;
  let active = 0;
  for (const e of employees) {
    byDepartment[e.department] = (byDepartment[e.department] ?? 0) + 1;
    totalSalary += e.salary;
    if (e.status === "active") active += 1;
  }
  res.json({
    headcount: employees.length,
    activeCount: active,
    departmentCount: Object.keys(byDepartment).length,
    averageSalary: employees.length ? Math.round(totalSalary / employees.length) : 0,
    byDepartment,
  });
});

app.listen(PORT, () => {
  console.log(`DreamHR API listening on http://localhost:${PORT}`);
});
