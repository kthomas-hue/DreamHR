import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Employee, NewEmployee } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const DATA_FILE = join(DATA_DIR, "employees.json");

const SEED: Employee[] = [
  {
    id: "e-1001",
    firstName: "Ada",
    lastName: "Okafor",
    email: "ada.okafor@dreamhr.io",
    title: "Chief Executive Officer",
    department: "Executive",
    location: "San Francisco, CA",
    status: "active",
    startDate: "2018-02-01",
    salary: 320000,
    managerId: null,
  },
  {
    id: "e-1002",
    firstName: "Marco",
    lastName: "Silva",
    email: "marco.silva@dreamhr.io",
    title: "VP of Engineering",
    department: "Engineering",
    location: "San Francisco, CA",
    status: "active",
    startDate: "2019-06-17",
    salary: 245000,
    managerId: "e-1001",
  },
  {
    id: "e-1003",
    firstName: "Priya",
    lastName: "Nair",
    email: "priya.nair@dreamhr.io",
    title: "Senior Software Engineer",
    department: "Engineering",
    location: "Remote",
    status: "active",
    startDate: "2021-03-08",
    salary: 178000,
    managerId: "e-1002",
  },
  {
    id: "e-1004",
    firstName: "Liam",
    lastName: "Chen",
    email: "liam.chen@dreamhr.io",
    title: "Product Designer",
    department: "Design",
    location: "New York, NY",
    status: "active",
    startDate: "2022-09-12",
    salary: 142000,
    managerId: "e-1002",
  },
  {
    id: "e-1005",
    firstName: "Sofia",
    lastName: "Rossi",
    email: "sofia.rossi@dreamhr.io",
    title: "People Operations Lead",
    department: "People",
    location: "Austin, TX",
    status: "active",
    startDate: "2020-11-02",
    salary: 138000,
    managerId: "e-1001",
  },
  {
    id: "e-1006",
    firstName: "Noah",
    lastName: "Williams",
    email: "noah.williams@dreamhr.io",
    title: "Account Executive",
    department: "Sales",
    location: "Chicago, IL",
    status: "on_leave",
    startDate: "2023-01-23",
    salary: 96000,
    managerId: "e-1001",
  },
  {
    id: "e-1007",
    firstName: "Emma",
    lastName: "Johansson",
    email: "emma.johansson@dreamhr.io",
    title: "Data Analyst",
    department: "Engineering",
    location: "Remote",
    status: "active",
    startDate: "2023-07-31",
    salary: 118000,
    managerId: "e-1002",
  },
  {
    id: "e-1008",
    firstName: "Diego",
    lastName: "Martinez",
    email: "diego.martinez@dreamhr.io",
    title: "Customer Success Manager",
    department: "Sales",
    location: "Miami, FL",
    status: "active",
    startDate: "2024-04-15",
    salary: 104000,
    managerId: "e-1006",
  },
];

let employees: Employee[] = [];

function persist(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(DATA_FILE, JSON.stringify(employees, null, 2), "utf-8");
}

export function loadStore(): void {
  if (existsSync(DATA_FILE)) {
    try {
      employees = JSON.parse(readFileSync(DATA_FILE, "utf-8")) as Employee[];
      return;
    } catch {
      // Fall through to seeding on parse failure.
    }
  }
  employees = [...SEED];
  persist();
}

export function listEmployees(): Employee[] {
  return [...employees].sort((a, b) =>
    `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`),
  );
}

export function getEmployee(id: string): Employee | undefined {
  return employees.find((e) => e.id === id);
}

export function createEmployee(input: NewEmployee): Employee {
  const employee: Employee = { id: `e-${randomUUID().slice(0, 8)}`, ...input };
  employees.push(employee);
  persist();
  return employee;
}

export function updateEmployee(
  id: string,
  patch: Partial<NewEmployee>,
): Employee | undefined {
  const employee = employees.find((e) => e.id === id);
  if (!employee) return undefined;
  Object.assign(employee, patch);
  persist();
  return employee;
}

export function deleteEmployee(id: string): boolean {
  const before = employees.length;
  employees = employees.filter((e) => e.id !== id);
  const removed = employees.length !== before;
  if (removed) persist();
  return removed;
}
