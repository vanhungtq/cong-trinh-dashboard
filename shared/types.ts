export type Role = "admin" | "manager" | "finance" | "staff";
export type TaskStatus = "todo" | "doing" | "review" | "blocked" | "done";
export interface Person {
  id: string;
  name: string;
  email: string;
  role: Role;
  discipline: string;
  capacity: number;
  trelloId?: string;
}
export interface Project {
  id: string;
  code: string;
  name: string;
  client: string;
  location: string;
  managerId: string;
  contract: number;
  accepted: number;
  start: string;
  due: string;
  status: "active" | "paused" | "completed";
  phase: string;
  boardId: string;
  boardUrl: string;
  driveFolderId: string;
  color: string;
}
export interface Task {
  archived?: boolean;
  id: string;
  projectId: string;
  title: string;
  assigneeId: string;
  status: TaskStatus;
  due: string;
  completedAt: string;
  weight: number;
  progress: number;
  hours: number;
  reviewRounds: number;
  blockReason: string;
  url: string;
}
export interface Receipt {
  id: string;
  projectId: string;
  amount: number;
  date: string;
  reference: string;
  note: string;
}
export interface PaymentTerm {
  id: string;
  projectId: string;
  title: string;
  amount: number;
  due: string;
  received: number;
}
export interface Document {
  id: string;
  projectId: string;
  name: string;
  category: string;
  version: string;
  status: string;
  url: string;
  updatedAt: string;
}
export interface Settings {
  companyName: string;
  listMapping: Record<string, TaskStatus>;
  lastSync: string;
  syncError: string;
}
export interface Workspace {
  projects: Project[];
  tasks: Task[];
  people: Person[];
  receipts: Receipt[];
  terms: PaymentTerm[];
  documents: Document[];
  settings: Settings;
}
export interface Session {
  mode: "demo" | "live";
  user: Person;
  integrations: { trello: boolean; drive: boolean };
}
export const taskLabels: Record<TaskStatus, string> = {
  todo: "Chưa bắt đầu",
  doing: "Đang thực hiện",
  review: "Chờ kiểm tra",
  blocked: "Đang vướng",
  done: "Hoàn thành",
};
export const roleLabels: Record<Role, string> = {
  admin: "Giám đốc",
  manager: "Chủ nhiệm",
  finance: "Kế toán",
  staff: "Nhân viên",
};
