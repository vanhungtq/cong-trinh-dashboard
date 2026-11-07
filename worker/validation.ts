import { z } from "zod";
const text = z.string().trim().min(1).max(300);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v);
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Ngày không hợp lệ");
const amount = z.number().int().min(0).max(1e14);
export const projectSchema = z
  .object({
    code: text,
    name: text,
    client: text,
    location: z.string().max(200).default(""),
    managerId: text,
    contract: amount,
    accepted: amount.default(0),
    start: date,
    due: date,
    status: z.enum(["active", "paused", "completed"]).default("active"),
    phase: text,
    boardId: z
      .string()
      .regex(/^([a-zA-Z0-9]{8,32})?$/)
      .default(""),
    boardUrl: z.string().default(""),
    driveFolderId: z
      .string()
      .regex(/^([\w-]{10,200})?$/)
      .default(""),
    color: z
      .string()
      .regex(/^#[\da-f]{6}$/i)
      .default("#547562"),
  })
  .refine((p) => p.due >= p.start, "Hạn bàn giao phải sau ngày bắt đầu");
export const receiptSchema = z.object({
  projectId: text,
  amount: amount.refine((n) => n > 0),
  date,
  reference: text,
  note: z.string().max(1000).default(""),
  termId: z.string().optional(),
});
export const termSchema = z.object({
  projectId: text,
  title: text,
  amount: amount.refine((n) => n > 0),
  due: date,
});
export const documentSchema = z.object({
  projectId: text,
  name: text,
  category: text,
  version: text,
  status: text,
  url: z
    .string()
    .url()
    .refine((v) => {
      const u = new URL(v);
      return (
        u.protocol === "https:" &&
        ["drive.google.com", "docs.google.com"].includes(u.hostname)
      );
    }, "Chỉ nhận liên kết Google Drive hoặc Google Docs"),
});
export const memberSchema = z.object({
  name: text,
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  role: z.enum(["admin", "manager", "finance", "staff"]),
  discipline: text,
  department: z.string().trim().max(100).default(""),
  team: z.string().trim().max(100).default(""),
  capacity: z.number().min(1).max(100),
  trelloId: z
    .string()
    .regex(/^([a-zA-Z0-9]{24})?$/)
    .optional(),
});
export const taskSchema = z.object({
  weight: z.number().min(0).max(1000),
  progress: z.number().min(0).max(100),
  hours: z.number().min(0).max(10000),
  assigneeId: z.string(),
  blockReason: z.string().max(1000),
});
export const settingsSchema = z.object({
  companyName: text,
  listMapping: z.record(
    z.string().regex(/^[a-zA-Z0-9]{24}$/),
    z.enum(["todo", "doing", "review", "blocked", "done"]),
  ),
});

const trelloId = z.string().regex(/^[a-f0-9]{24}$/i);
export const trelloImportSchema = z
  .object({
    workspaceId: trelloId,
    targets: z
      .array(
        z.object({
          boardId: trelloId,
          projectId: z.string().min(1).optional(),
        }),
      )
      .min(1)
      .max(20),
    listMapping: settingsSchema.shape.listMapping,
    start: date,
    due: date,
  })
  .refine((v) => v.due >= v.start, "Hạn bàn giao phải sau ngày bắt đầu");
