export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  department: string;
  location: string;
  status: "active" | "on_leave" | "terminated";
  startDate: string;
  salary: number;
  managerId: string | null;
}

export type NewEmployee = Omit<Employee, "id">;

export interface Stats {
  headcount: number;
  activeCount: number;
  departmentCount: number;
  averageSalary: number;
  byDepartment: Record<string, number>;
}
