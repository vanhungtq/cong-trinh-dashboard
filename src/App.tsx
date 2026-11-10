import { lazy, Suspense } from "react";
const VirtualOffice = lazy(() => import("./VirtualOffice"));
import { demoBoards } from "../shared/demo";
import Personnel from "./Personnel";
import { Login, AccountSettings } from "./auth-ui";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cloud,
  Download,
  ExternalLink,
  FileText,
  FolderClosed,
  FolderOpen,
  LayoutDashboard,
  Link2,
  ListFilter,
  Loader2,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Target,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type {
  Workspace,
  Session,
  Project,
  Task,
  TaskStatus,
  Person,
  TrelloWorkspace,
} from "../shared/types";
import { roleLabels, taskLabels } from "../shared/types";
import {
  csv,
  dateLabel,
  healthLabels,
  isOverdue,
  localDate,
  money,
  onTimeRate,
  plannedProgress,
  projectHealth,
  projectProgress,
  totals,
} from "../shared/metrics";
import {
  documentSchema,
  memberSchema,
  projectSchema,
  receiptSchema,
  taskSchema,
  termSchema,
} from "../worker/validation";
import {
  demoPreview,
  ApiError,
  bootstrap,
  persistDemo,
  request,
  resetDemo,
} from "./api";
import {
  Avatar,
  Badge,
  Empty,
  Field,
  Kpi,
  Modal,
  Progress,
} from "./components";
import EntryForm, { type FormKind } from "./forms";

type Page =
  | "overview"
  | "projects"
  | "finance"
  | "team"
  | "documents"
  | "settings"
  | "office";
const pageNames: Record<Page, string> = {
  overview: "Tổng quan",
  office: "Văn phòng 3D",
  projects: "Dự án",
  finance: "Tài chính",
  team: "Nhân sự",
  documents: "Hồ sơ",
  settings: "Kết nối & cài đặt",
};
const nav = [
  { id: "overview", icon: LayoutDashboard },
  { id: "office", icon: Building2 },
  { id: "projects", icon: BriefcaseBusiness },
  { id: "finance", icon: Wallet },
  { id: "team", icon: Users },
  { id: "documents", icon: FolderClosed },
] as const;
const modalNames: Record<FormKind, string> = {
  project: "Dự án",
  receipt: "Ghi nhận tiền đã thu",
  term: "Thêm đợt thanh toán",
  document: "Thêm hồ sơ từ Drive",
  member: "Thêm thành viên",
  task: "Xác nhận khối lượng công việc",
};
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const u = URL.createObjectURL(
    new Blob([csv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(u);
}
function initials(name: string) {
  return name.split(" ").at(-1) || name;
}
function Architecture({ variant = 0 }: { variant?: number }) {
  return (
    <svg viewBox="0 0 250 125" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.2" opacity=".65">
        <path d="M17 104h220M35 104V52l86-30 88 30v52M35 52l86 29 88-29M121 81v23M35 67l86 29 88-29M61 62v42M86 72v32M147 73v31M175 63v41M198 56v48M35 52l86 29M121 22v59" />
        {variant % 2 === 0 ? (
          <>
            <path d="M21 65V39l100-33 102 33v25M21 39l100 34 102-34M121 6v16" />
            <path d="M50 45l71-24 72 24M70 52l51-17 52 17" />
          </>
        ) : (
          <>
            <path d="M69 40V17l52-15 52 15v23M69 17l52 19 52-19M121 2v20" />
            <path d="M24 106V75M226 106V75M18 76l6-11 6 11M220 76l6-11 6 11" />
          </>
        )}
        <path
          d="M17 117h219M10 111v12M242 111v12M29 115v4M221 115v4"
          strokeDasharray="3 3"
        />
      </g>
    </svg>
  );
}

export default function App() {
  const [w, setW] = useState<Workspace | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [loadError, setLoadError] = useState(""),
    [authRequired, setAuthRequired] = useState(false),
    [authMode, setAuthMode] = useState("password");
  const [page, setPage] = useState<Page>("overview"),
    [search, setSearch] = useState(""),
    [statusFilter, setStatusFilter] = useState("all"),
    [month, setMonth] = useState("all"),
    [projectFilter, setProjectFilter] = useState("all");
  const [mobile, setMobile] = useState(false),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [notifications, setNotifications] = useState(false),
    [help, setHelp] = useState(false),
    [resetConfirm, setResetConfirm] = useState(false);
  const [form, setForm] = useState<{
      kind: FormKind;
      initial?: Project | Task | Person;
      projectId?: string;
    } | null>(null),
    [detail, setDetail] = useState<string | null>(null),
    [detailTab, setDetailTab] = useState("tasks");
  const [boards, setBoards] = useState<
      Array<{
        id: string;
        name: string;
        url: string;
        lists: { id: string; name: string }[];
      }>
    >([]),
    [trelloWorkspaces, setTrelloWorkspaces] = useState<TrelloWorkspace[]>([]),
    [trelloWorkspaceId, setTrelloWorkspaceId] = useState(""),
    [boardTargets, setBoardTargets] = useState<Record<string, string>>({}),
    [importStart, setImportStart] = useState(""),
    [importDue, setImportDue] = useState(""),
    [mapping, setMapping] = useState<Record<string, TaskStatus>>({}),
    [company, setCompany] = useState(""),
    [settingsError, setSettingsError] = useState(""),
    [settingsRecovery, setSettingsRecovery] = useState(false);
  const [driveView, setDriveView] = useState<{
    projectId: string;
    files: {
      id: string;
      name: string;
      webViewLink?: string;
      mimeType: string;
      modifiedTime: string;
    }[];
    nextPageToken?: string;
  } | null>(null);
  useEffect(() => {
    const expired = () => {
      setW(null);
      setSession(null);
      setAuthRequired(true);
    };
    window.addEventListener("cong-trinh-auth-required", expired);
    (async () => {
      const status =
        import.meta.env.DEV || demoPreview()
          ? { mode: "demo" }
          : await request<{ mode: string }>("/auth/status");
      setAuthMode(status.mode);
      const d = await bootstrap();
      setW(d.workspace);
      setSession(d.session);
      setCompany(d.workspace.settings.companyName);
      setMapping(d.workspace.settings.listMapping);
      setTrelloWorkspaceId(d.workspace.settings.trelloWorkspaceId || "");
      if (d.session.mode === "demo") setBoards(demoBoards(d.workspace));
    })().catch((e) => {
      if (e instanceof ApiError && e.kind === "auth") setAuthRequired(true);
      else setLoadError(e.message);
    });
    return () =>
      window.removeEventListener("cong-trinh-auth-required", expired);
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const finance = session?.user.role !== "staff",
    canMoney = ["admin", "finance"].includes(session?.user.role || ""),
    admin = session?.user.role === "admin",
    canManage = ["admin", "manager"].includes(session?.user.role || "");
  const changePage = (p: Page) => {
    setPage(p);
    setSearch("");
    setStatusFilter("all");
    setProjectFilter("all");
    setMobile(false);
  };
  function commit(next: Workspace) {
    if (session?.mode === "demo") persistDemo(next);
    setW(next);
  }
  async function refresh() {
    const d = await bootstrap();
    setW(d.workspace);
    setSession(d.session);
  }
  async function save(
    kind: FormKind,
    data: Record<string, unknown>,
    id?: string,
  ) {
    if (!w || !session) return;
    const paths = {
      project: "/projects",
      receipt: "/receipts",
      term: "/terms",
      document: "/documents",
      member: "/members",
      task: "/tasks",
    };
    if (session.mode === "live") {
      await request(
        paths[kind] + (id ? "/" + id : ""),
        id ? (kind === "task" ? "PATCH" : "PUT") : "POST",
        data,
      );
      await refresh();
      setToast("Đã lưu thông tin.");
      return;
    }
    const next = structuredClone(w),
      newId = id || crypto.randomUUID();
    if (kind === "project") {
      const d = projectSchema.parse(data);
      if (
        next.projects.some(
          (p) =>
            p.id !== id &&
            (p.code.toLowerCase() === d.code.toLowerCase() ||
              (d.boardId && p.boardId === d.boardId)),
        )
      )
        throw Error("Mã dự án hoặc bảng Trello đã tồn tại.");
      const p = { ...d, id: newId };
      if (id) next.projects = next.projects.map((x) => (x.id === id ? p : x));
      else next.projects.push(p);
    }
    if (kind === "receipt") {
      const d = receiptSchema.parse(data);
      if (
        next.receipts.some(
          (r) =>
            r.projectId === d.projectId &&
            r.reference.toLowerCase() === d.reference.toLowerCase(),
        )
      )
        throw Error("Mã chứng từ đã được ghi nhận trong dự án này.");
      if (d.termId) {
        const t = next.terms.find(
          (t) => t.id === d.termId && t.projectId === d.projectId,
        );
        if (!t) throw Error("Đợt thanh toán không hợp lệ.");
        if (t.received + d.amount > t.amount)
          throw Error("Số tiền vượt phần còn lại của đợt thanh toán.");
        t.received += d.amount;
      }
      next.receipts.push({ ...d, id: newId });
    }
    if (kind === "term")
      next.terms.push({ ...termSchema.parse(data), id: newId, received: 0 });
    if (kind === "document")
      next.documents.push({
        ...documentSchema.parse(data),
        id: newId,
        updatedAt: new Date().toISOString(),
      });
    if (kind === "member") {
      const d = memberSchema.parse(data);
      if (next.people.some((p) => p.email === d.email && p.id !== id))
        throw Error("Email này đã có trong đội ngũ.");
      if (id)
        next.people = next.people.map((p) => (p.id === id ? { ...d, id } : p));
      else next.people.push({ ...d, id: newId });
    }
    if (kind === "task") {
      const d = taskSchema.parse(data);
      next.tasks = next.tasks.map((t) => (t.id === id ? { ...t, ...d } : t));
    }
    commit(next);
    setToast("Đã lưu trong bản dùng thử trên thiết bị này.");
  }
  async function sync() {
    if (session?.mode === "demo") {
      setToast(
        "Bản dùng thử chưa kết nối Trello. Xem hướng dẫn tại Kết nối & cài đặt.",
      );
      return;
    }
    setBusy(true);
    try {
      const r = await request<{ count: number }>("/trello/sync", "POST", {});
      await refresh();
      setToast(`Đã đồng bộ ${r.count} công việc từ Trello.`);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openDrive(p: Project, more = false) {
    if (session?.mode === "demo") {
      setToast("Hồ sơ minh họa chưa liên kết với tài liệu thật.");
      return;
    }
    setBusy(true);
    try {
      const r = await request<{
        files: NonNullable<typeof driveView>["files"];
        nextPageToken?: string;
      }>(
        "/drive/files?projectId=" +
          encodeURIComponent(p.id) +
          (more && driveView?.nextPageToken
            ? "&pageToken=" + encodeURIComponent(driveView.nextPageToken)
            : ""),
      );
      setDriveView({
        projectId: p.id,
        files: [...(more ? driveView?.files || [] : []), ...r.files],
        nextPageToken: r.nextPageToken,
      });
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const tasksFor = (id: string) =>
    w?.tasks.filter(
      (t) => t.projectId === id && (!t.archived || t.status === "done"),
    ) || [];
  const openProject = (id: string) => {
    setDetail(id);
    setDetailTab("tasks");
  };
  const openUrl = (url: string) => {
    if (!url) {
      setToast("Đây là hồ sơ minh họa, chưa có liên kết tài liệu thật.");
      return;
    }
    try {
      const u = new URL(url);
      if (
        u.protocol !== "https:" ||
        !["trello.com", "drive.google.com", "docs.google.com"].includes(
          u.hostname,
        )
      )
        throw Error();
      window.open(u.href, "_blank", "noopener,noreferrer");
    } catch {
      setToast("Liên kết không hợp lệ.");
    }
  };
  const filteredProjects = useMemo(
    () =>
      w?.projects.filter(
        (p) =>
          [p.code, p.name, p.client, p.location]
            .join(" ")
            .toLocaleLowerCase("vi")
            .includes(search.toLocaleLowerCase("vi")) &&
          (statusFilter === "all" ||
            projectHealth(
              p,
              w.tasks.filter((t) => t.projectId === p.id),
            ) === statusFilter),
      ) || [],
    [w, search, statusFilter],
  );
  if (authRequired && authMode === "password") return <Login />;
  if (!w || !session)
    return (
      <div className="loading-screen">
        <Building2 size={36} />
        <h1>
          Công Trình<span> / workspace</span>
        </h1>
        {loadError ? (
          <>
            <p className="form-error">{loadError}</p>
            <button className="button" onClick={() => location.reload()}>
              Thử lại
            </button>
          </>
        ) : (
          <>
            <span className="spinner" />
            <p>Đang mở không gian làm việc…</p>
          </>
        )}
      </div>
    );
  const summary = totals(w.projects, w.receipts, w.terms),
    overdue = w.tasks.filter((t) => isOverdue(t)),
    riskProjects = w.projects.filter((p) =>
      ["late", "risk"].includes(projectHealth(p, tasksFor(p.id))),
    );
  const person = (id: string) => w.people.find((p) => p.id === id),
    project = (id: string) => w.projects.find((p) => p.id === id);
  const selected = project(detail || "");
  const months = [...new Set(w.receipts.map((r) => r.date.slice(0, 7)))]
    .sort()
    .reverse();
  const filteredReceipts = w.receipts
    .filter(
      (r) =>
        (month === "all" || r.date.startsWith(month)) &&
        (projectFilter === "all" || r.projectId === projectFilter) &&
        [r.reference, r.note, project(r.projectId)?.name]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const exportProjects = () => {
    downloadCsv("du-an-" + localDate() + ".csv", [
      [
        "Mã",
        "Dự án",
        "Chủ đầu tư",
        "Tiến độ (%)",
        "Trạng thái",
        "Hạn bàn giao",
        ...(finance ? ["Giá trị hợp đồng", "Đã nghiệm thu"] : []),
      ],
      ...filteredProjects.map((p) => [
        p.code,
        p.name,
        p.client,
        projectProgress(tasksFor(p.id)),
        healthLabels[projectHealth(p, tasksFor(p.id))],
        p.due,
        ...(finance ? [p.contract, p.accepted] : []),
      ]),
    ]);
    setToast("Đã xuất danh sách dự án.");
  };
  const filteredDocs = w.documents.filter(
    (d) =>
      (projectFilter === "all" || d.projectId === projectFilter) &&
      (statusFilter === "all" || d.category === statusFilter) &&
      [d.name, d.category, project(d.projectId)?.name]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const projectTable = (projects: Project[], compact = false) => (
    <div className="table-scroll">
      <table className="data-table projects-table">
        <thead>
          <tr>
            <th>Dự án / Chủ đầu tư</th>
            <th>Chủ nhiệm</th>
            <th>Tiến độ</th>
            <th>Hạn bàn giao</th>
            <th>Trạng thái</th>
            <th aria-label="Chi tiết" />
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} onClick={() => openProject(p.id)}>
              <td>
                <button
                  className="project-name"
                  onClick={(e) => {
                    e.stopPropagation();
                    openProject(p.id);
                  }}
                >
                  <span
                    className="project-symbol"
                    style={{ background: p.color + "18", color: p.color }}
                  >
                    <Building2 size={19} />
                  </span>
                  <span>
                    <b>{p.name}</b>
                    <small>
                      {p.code}
                      <i /> {compact ? p.phase : p.client}
                    </small>
                  </span>
                </button>
              </td>
              <td>
                <div className="person-inline">
                  <Avatar person={person(p.managerId)} size={29} />
                  <span>
                    {initials(person(p.managerId)?.name || "Chưa giao")}
                  </span>
                </div>
              </td>
              <td>
                <div className="progress-cell">
                  <span>{projectProgress(tasksFor(p.id))}%</span>
                  <Progress value={projectProgress(tasksFor(p.id))} />
                </div>
              </td>
              <td>
                <span
                  className={
                    p.due < localDate() && p.status !== "completed"
                      ? "text-danger"
                      : ""
                  }
                >
                  {dateLabel(p.due)}
                </span>
              </td>
              <td>
                <Badge status={projectHealth(p, tasksFor(p.id))} />
              </td>
              <td>
                <ChevronRight size={17} className="muted" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!projects.length && (
        <Empty
          title="Chưa có dự án phù hợp"
          detail="Thử đổi bộ lọc hoặc tạo dự án đầu tiên."
        />
      )}
    </div>
  );
  const taskList = (tasks: Task[]) => (
    <div className="task-list">
      {tasks.map((t) => (
        <div className="task-row" key={t.id}>
          <span className={"task-dot " + t.status}>
            {t.status === "done" ? <Check size={13} /> : null}
          </span>
          <div className="task-content">
            <button
              className="text-button task-title"
              onClick={() => {
                setNotifications(false);
                if (canManage) setForm({ kind: "task", initial: t });
                else openUrl(t.url);
              }}
            >
              {t.title}
            </button>
            <div className="task-meta">
              <span>{project(t.projectId)?.code}</span>
              <span>{taskLabels[t.status]}</span>
              {t.blockReason && (
                <span className="text-warning">{t.blockReason}</span>
              )}
            </div>
          </div>
          <Avatar person={person(t.assigneeId)} size={28} />
          <span className={"task-date " + (isOverdue(t) ? "text-danger" : "")}>
            {dateLabel(t.due)}
          </span>
          <button
            className="icon-button"
            title="Mở thẻ Trello"
            aria-label={"Mở thẻ " + t.title}
            onClick={() => openUrl(t.url)}
          >
            <ArrowUpRight size={16} />
          </button>
        </div>
      ))}
      {!tasks.length && (
        <Empty
          title="Không có công việc"
          detail="Kết nối bảng Trello để bắt đầu theo dõi."
        />
      )}
    </div>
  );
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-overlay" onClick={() => setMobile(false)} />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            changePage("overview");
          }}
        >
          <span className="brand-mark">
            <Building2 size={25} strokeWidth={1.7} />
          </span>
          <span>
            CÔNG TRÌNH<small>PROJECT WORKSPACE</small>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-icon">CT</span>
          <div>
            <b>{w.settings.companyName}</b>
            <small>Không gian quản trị</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <span className="nav-label">KHÔNG GIAN LÀM VIỆC</span>
        <nav>
          {nav
            .filter((n) => n.id !== "finance" || finance)
            .map((n) => (
              <button
                key={n.id}
                className={"nav-item " + (page === n.id ? "active" : "")}
                onClick={() => changePage(n.id)}
              >
                <n.icon size={19} />
                <span>{pageNames[n.id]}</span>
                {n.id === "projects" && <em>{w.projects.length}</em>}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="pulse-dot" />
            <b>Mỗi dự án, một bức tranh rõ ràng.</b>
            <p>Tiến độ, con người và dòng tiền trong cùng một nơi.</p>
            <Architecture />
          </div>
          <button
            className={"nav-item " + (page === "settings" ? "active" : "")}
            onClick={() => changePage("settings")}
          >
            <Settings2 size={19} />
            <span>Kết nối & cài đặt</span>
          </button>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={19} />
            <span>Hướng dẫn sử dụng</span>
          </button>
          {session.mode === "live" && authMode === "password" && (
            <button
              className="nav-item"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await request("/auth/logout", "POST", {});
                  setW(null);
                  setSession(null);
                  setAuthRequired(true);
                } catch (e) {
                  setToast((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Đăng xuất
            </button>
          )}
          <a
            className="nav-item"
            href={session.mode === "demo" ? "/" : "/?demo=1"}
          >
            {session.mode === "demo" ? "Về dữ liệu thật" : "Khám phá bản demo"}
          </a>
          <div className="sidebar-user">
            <Avatar person={session.user} size={36} />
            <div>
              <b>{session.user.name}</b>
              <small>{roleLabels[session.user.role]}</small>
            </div>
            <span className="user-online" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Mở menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span>Không gian làm việc</span>
            <ChevronRight size={14} />
            <b>{pageNames[page]}</b>
          </div>
          <div className="topbar-right">
            <span className={"mode-label " + session.mode}>
              <i />
              {session.mode === "demo" ? "Dữ liệu mẫu" : "Đang hoạt động"}
            </span>
            <button
              className="notification-button icon-button"
              aria-label="Xem cảnh báo"
              onClick={() => setNotifications(true)}
            >
              <Bell size={19} />
              {overdue.length > 0 && <i />}
            </button>
            <div className="topbar-divider" />
            <Avatar person={session.user} size={32} />
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "overview"
                  ? "TỔNG QUAN ĐIỀU HÀNH"
                  : "QUẢN TRỊ / " + pageNames[page].toLocaleUpperCase("vi")}
              </div>
              <h1>
                {page === "overview"
                  ? `Chào ${initials(session.user.name)}, một ngày hiệu quả.`
                  : pageNames[page]}
              </h1>
              <p>
                {page === "overview"
                  ? "Nắm bắt tiến độ. Chủ động quyết định. Đồng hành cùng đội ngũ."
                  : page === "projects"
                    ? "Từ hồ sơ đầu tiên đến khi hoàn thành và bàn giao."
                    : page === "office"
                      ? "Không gian chibi theo phòng ban, kết nối với công việc của đội ngũ."
                      : page === "finance"
                        ? "Theo dõi hợp đồng, nghiệm thu và dòng tiền thực nhận."
                        : page === "team"
                          ? "Hiểu khối lượng công việc để phân bổ đúng người, đúng thời điểm."
                          : page === "documents"
                            ? "Hồ sơ đúng dự án, đúng phiên bản, luôn dễ tìm."
                            : "Kết nối nguồn dữ liệu và chuẩn hóa cách vận hành."}
              </p>
            </div>
            <div className="heading-actions">
              {page === "overview" ? (
                <button className="button" disabled={busy} onClick={sync}>
                  <RefreshCw size={16} className={busy ? "spin" : ""} />
                  {busy ? "Đang đồng bộ" : "Đồng bộ Trello"}
                </button>
              ) : page === "projects" && admin ? (
                <button
                  className="button primary"
                  onClick={() => setForm({ kind: "project" })}
                >
                  <Plus size={17} />
                  Tạo dự án
                </button>
              ) : page === "finance" && canMoney ? (
                <button
                  className="button primary"
                  onClick={() => setForm({ kind: "receipt" })}
                >
                  <Plus size={17} />
                  Ghi nhận thanh toán
                </button>
              ) : page === "documents" && session.user.role !== "finance" ? (
                <button
                  className="button primary"
                  onClick={() => setForm({ kind: "document" })}
                >
                  <Plus size={17} />
                  Thêm hồ sơ
                </button>
              ) : page === "team" && admin ? (
                <button
                  className="button primary"
                  onClick={() => setForm({ kind: "member" })}
                >
                  <Plus size={17} />
                  Thêm thành viên
                </button>
              ) : null}
            </div>
          </div>
          {session.mode === "demo" && (
            <div className="demo-banner">
              <span>
                <span className="demo-tag">DEMO</span>Bạn đang xem dữ liệu minh
                họa. Thay đổi chỉ được lưu trên trình duyệt này.
              </span>
              <button onClick={() => changePage("settings")}>
                Kết nối dữ liệu thật <ArrowRight size={14} />
              </button>
            </div>
          )}
          {page === "office" && (
            <Suspense
              fallback={<div className="info-box">Đang tải văn phòng 3D…</div>}
            >
              <VirtualOffice
                w={w}
                session={session}
                onRefresh={refresh}
                onEditTask={(t) => setForm({ kind: "task", initial: t })}
              />
            </Suspense>
          )}
          {page === "overview" && (
            <>
              {session.mode === "demo" && (
                <section className="panel demo-tour">
                  <h2>Khám phá toàn bộ ứng dụng</h2>
                  <p>
                    Bộ mẫu gồm 6 dự án, phòng ban/team, task đủ trạng thái, dòng
                    tiền và hồ sơ. Mọi tên và số liệu đều là minh họa.
                  </p>
                  <div>
                    {[
                      [
                        "office",
                        "Văn phòng 3D",
                        "Khám phá phòng ban chibi, chọn nhân vật để xem công việc và thử các bộ lọc.",
                      ],
                      [
                        "projects",
                        "Dự án & task",
                        "Mở Tân Trào để xem tiến độ; Kim Phú có vướng mắc; An Tường đã hoàn thành.",
                      ],
                      [
                        "team",
                        "Nhân sự & báo cáo",
                        "Chọn phòng/team và Báo cáo ngày. Có lịch sử 14 ngày, task hoàn thành đúng/chậm hạn và chưa phân công.",
                      ],
                      [
                        "finance",
                        "Tài chính & công nợ",
                        "Có đợt đã thu đủ, thu một phần, quá hạn và sắp đến hạn; dữ liệu thu trải nhiều tháng.",
                      ],
                      [
                        "documents",
                        "Hồ sơ & phiên bản",
                        "Có hợp đồng, thiết kế, nghiệm thu, nhiều phiên bản và trạng thái duyệt.",
                      ],
                      [
                        "settings",
                        "Kết nối & cài đặt",
                        "Xem cấu hình Trello/Drive và ánh xạ cột. Các kết nối mẫu không gọi tài khoản thật.",
                      ],
                    ].map(([key, title, note]) => (
                      <button key={key} onClick={() => changePage(key as Page)}>
                        <b>{title}</b>
                        <span>{note}</span>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  </div>
                  <small>
                    Link Drive/Trello mẫu không trỏ tới tài liệu thật. Có thể
                    sửa dữ liệu mẫu và khôi phục tại Kết nối & cài đặt.
                  </small>
                </section>
              )}

              <div className="kpi-grid">
                <Kpi
                  label={finance ? "Tổng giá trị hợp đồng" : "Tổng công việc"}
                  value={
                    finance
                      ? money(summary.contract, true)
                      : String(w.tasks.length)
                  }
                  icon={
                    finance ? (
                      <Wallet size={20} />
                    ) : (
                      <BriefcaseBusiness size={20} />
                    )
                  }
                  dark
                  note={
                    <>
                      <span className="tiny-dot" />
                      {w.projects.length} dự án trong danh mục
                    </>
                  }
                />
                <Kpi
                  label={finance ? "Tiền đã thu" : "Công việc hoàn thành"}
                  value={
                    finance
                      ? money(summary.received, true)
                      : String(
                          w.tasks.filter((t) => t.status === "done").length,
                        )
                  }
                  icon={<ArrowDownLeft size={20} />}
                  note={
                    <>
                      {finance
                        ? "Lũy kế giao dịch thực nhận"
                        : "Sản phẩm đã hoàn thành"}
                    </>
                  }
                />
                <Kpi
                  label="Dự án đang triển khai"
                  value={String(
                    w.projects.filter((p) => p.status === "active").length,
                  ).padStart(2, "0")}
                  icon={<Building2 size={20} />}
                  note={
                    <>
                      <span className="green-text">
                        {
                          w.projects.filter((p) => p.status === "completed")
                            .length
                        }{" "}
                        hoàn thành
                      </span>
                      <span className="note-separator">/</span>
                      {
                        w.projects.filter((p) => p.status === "paused").length
                      }{" "}
                      tạm dừng
                    </>
                  }
                />
                <Kpi
                  label="Dự án cần chú ý"
                  value={String(riskProjects.length).padStart(2, "0")}
                  icon={<TriangleAlert size={20} />}
                  note={
                    <>
                      <span className="amber-text">
                        {overdue.length} công việc quá hạn
                      </span>
                      <ArrowUpRight size={14} />
                    </>
                  }
                />
              </div>
              <div className="overview-charts">
                <section className="panel cash-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        {finance
                          ? "Dòng tiền thực nhận"
                          : "Phân bổ trạng thái công việc"}
                      </h2>
                      <p>
                        {finance
                          ? "Theo tháng · đơn vị: triệu đồng"
                          : "Tình trạng công việc trong các dự án được phân công"}
                      </p>
                    </div>
                    <span className="soft-label">6 tháng gần nhất</span>
                  </div>
                  {finance ? (
                    <CashChart receipts={w.receipts} />
                  ) : (
                    <div className="status-bars">
                      {Object.entries(taskLabels).map(([key, label]) => (
                        <div key={key}>
                          <span>{label}</span>
                          <Progress
                            value={
                              (w.tasks.filter((t) => t.status === key).length /
                                Math.max(1, w.tasks.length)) *
                              100
                            }
                          />
                          <b>
                            {w.tasks.filter((t) => t.status === key).length}
                          </b>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="chart-footer">
                    <span>
                      <i className="legend-dot" />
                      Tiền thực nhận
                    </span>
                    <span>Chỉ tính giao dịch đã ghi nhận</span>
                  </div>
                </section>
                <section className="panel portfolio-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Sức khỏe danh mục</h2>
                      <p>Nhìn nhanh tình trạng dự án</p>
                    </div>
                    <Activity size={18} className="muted" />
                  </div>
                  <Portfolio w={w} />
                  <button
                    className="text-link"
                    onClick={() => changePage("projects")}
                  >
                    Xem tất cả dự án <ArrowRight size={15} />
                  </button>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      Dự án đang theo dõi{" "}
                      <span className="count-pill">{w.projects.length}</span>
                    </h2>
                    <p>Tiến độ được tính theo trọng số công việc</p>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => changePage("projects")}
                  >
                    Tất cả dự án <ArrowUpRight size={16} />
                  </button>
                </div>
                {projectTable(w.projects.slice(0, 5), true)}
              </section>
              <div className="bottom-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Cần xử lý sớm</h2>
                      <p>Công việc quá hạn và đang vướng</p>
                    </div>
                    <span className="alert-count">
                      {
                        w.tasks.filter(
                          (t) =>
                            isOverdue(t) ||
                            (!t.archived && t.status === "blocked"),
                        ).length
                      }
                    </span>
                  </div>
                  {taskList(
                    w.tasks
                      .filter(
                        (t) =>
                          isOverdue(t) ||
                          (!t.archived && t.status === "blocked"),
                      )
                      .slice(0, 4),
                  )}
                </section>
                <section className="panel quick-panel">
                  <div className="panel-heading">
                    <h2>Truy cập nhanh</h2>
                  </div>
                  {[
                    {
                      icon: BriefcaseBusiness,
                      title: "Danh mục dự án",
                      text: "Tiến độ và các mốc bàn giao",
                      page: "projects",
                    },
                    {
                      icon: FolderOpen,
                      title: "Kho hồ sơ dự án",
                      text: `${w.documents.length} hồ sơ được quản lý`,
                      page: "documents",
                    },
                    {
                      icon: Users,
                      title: "Đội ngũ & khối lượng",
                      text: `${w.people.length} thành viên trong không gian`,
                      page: "team",
                    },
                  ].map((x) => (
                    <button
                      className="quick-item"
                      key={x.page}
                      onClick={() => changePage(x.page as Page)}
                    >
                      <span>
                        <x.icon size={19} />
                      </span>
                      <div>
                        <b>{x.title}</b>
                        <small>{x.text}</small>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </section>
              </div>
            </>
          )}
          {page === "projects" && (
            <>
              <div className="project-summary-strip">
                <span>
                  <b>{w.projects.length}</b> Tổng dự án
                </span>
                <span>
                  <i className="dot green" />
                  <b>
                    {w.projects.filter((p) => p.status === "active").length}
                  </b>{" "}
                  Đang triển khai
                </span>
                <span>
                  <i className="dot amber" />
                  <b>{riskProjects.length}</b> Cần chú ý
                </span>
                {finance && (
                  <span className="strip-right">
                    Giá trị hợp đồng <b>{money(summary.contract, true)}</b>
                  </span>
                )}
              </div>
              <div className="toolbar">
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder="Tìm theo tên, mã dự án, chủ đầu tư…"
                />
                <select
                  className="filter-select"
                  aria-label="Lọc trạng thái"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Tất cả trạng thái</option>
                  {Object.entries(healthLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <button className="button" onClick={exportProjects}>
                  <Download size={16} />
                  Xuất CSV
                </button>
              </div>
              <div className="project-cards">
                {filteredProjects.map((p, i) => (
                  <button
                    className="project-card"
                    key={p.id}
                    onClick={() => openProject(p.id)}
                  >
                    <div
                      className="project-card-visual"
                      style={{ background: p.color + "16", color: p.color }}
                    >
                      <span className="project-code">{p.code}</span>
                      <Architecture variant={i} />
                      <span className="card-location">{p.location}</span>
                    </div>
                    <div className="project-card-body">
                      <div className="card-status">
                        <Badge status={projectHealth(p, tasksFor(p.id))} />
                        <ArrowUpRight size={18} />
                      </div>
                      <h3>{p.name}</h3>
                      <p>{p.client}</p>
                      <div className="project-card-progress">
                        <span>Tiến độ thực hiện</span>
                        <b>{projectProgress(tasksFor(p.id))}%</b>
                      </div>
                      <Progress value={projectProgress(tasksFor(p.id))} />
                      <div className="project-card-foot">
                        <div className="person-inline">
                          <Avatar person={person(p.managerId)} size={26} />
                          <span>
                            {initials(person(p.managerId)?.name || "Chưa giao")}
                          </span>
                        </div>
                        <span>
                          <CalendarDays size={13} />
                          {dateLabel(p.due)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {!filteredProjects.length && (
                <Empty
                  title="Không tìm thấy dự án"
                  detail="Thử một từ khóa hoặc trạng thái khác."
                />
              )}
            </>
          )}
          {page === "finance" && finance && (
            <>
              <div className="kpi-grid">
                <Kpi
                  label="Giá trị hợp đồng"
                  value={money(summary.contract, true)}
                  note="Tổng giá trị đang quản lý"
                  icon={<Wallet size={19} />}
                  dark
                />
                <Kpi
                  label="Giá trị đã nghiệm thu"
                  value={money(summary.accepted, true)}
                  note="Theo hồ sơ nghiệm thu"
                  icon={<CheckCheck size={19} />}
                />
                <Kpi
                  label="Tiền đã thu"
                  value={money(summary.received, true)}
                  note={`${w.receipts.length} giao dịch thực nhận`}
                  icon={<ArrowDownLeft size={19} />}
                />
                <Kpi
                  label="Đến hạn chưa thu"
                  value={money(summary.overdue, true)}
                  note="Theo các đợt thanh toán đã nhập"
                  icon={<Clock3 size={19} />}
                />
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Kế hoạch thu tiền</h2>
                    <p>
                      Số phải thu sau điều chỉnh tạm ứng và giữ lại theo hợp
                      đồng
                    </p>
                  </div>
                  {canMoney && (
                    <button
                      className="button small"
                      onClick={() => setForm({ kind: "term" })}
                    >
                      <Plus size={15} />
                      Thêm đợt
                    </button>
                  )}
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Dự án / Đợt thanh toán</th>
                        <th>Phải thu</th>
                        <th>Đã phân bổ</th>
                        <th>Còn lại</th>
                        <th>Ngày đến hạn</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {w.terms.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <b>{t.title}</b>
                            <small>{project(t.projectId)?.name}</small>
                          </td>
                          <td>{money(t.amount)}</td>
                          <td>{money(t.received)}</td>
                          <td>
                            <b>{money(Math.max(0, t.amount - t.received))}</b>
                          </td>
                          <td>{dateLabel(t.due)}</td>
                          <td>
                            <span
                              className={
                                "badge " +
                                (t.received >= t.amount
                                  ? "completed"
                                  : t.due < localDate()
                                    ? "late"
                                    : "ontrack")
                              }
                            >
                              {t.received >= t.amount
                                ? "Đã thu đủ"
                                : t.due < localDate()
                                  ? "Quá hạn"
                                  : "Chưa đến hạn"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!w.terms.length && (
                    <Empty
                      title="Chưa có đợt thanh toán"
                      detail="Thêm các mốc thu tiền theo hợp đồng để theo dõi công nợ."
                    />
                  )}
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Sổ tiền thực nhận</h2>
                    <p>
                      {money(
                        filteredReceipts.reduce((s, r) => s + r.amount, 0),
                      )}{" "}
                      · {filteredReceipts.length} giao dịch trong bộ lọc
                    </p>
                  </div>
                  <button
                    className="button small"
                    onClick={() =>
                      downloadCsv("thu-tien.csv", [
                        ["Ngày", "Dự án", "Chứng từ", "Nội dung", "Số tiền"],
                        ...filteredReceipts.map((r) => [
                          r.date,
                          project(r.projectId)?.name || "",
                          r.reference,
                          r.note,
                          r.amount,
                        ]),
                      ])
                    }
                  >
                    <Download size={15} />
                    Xuất CSV
                  </button>
                </div>
                <div className="toolbar inset">
                  <SearchBox
                    value={search}
                    onChange={setSearch}
                    placeholder="Tìm chứng từ, dự án…"
                  />
                  <select
                    aria-label="Lọc dự án"
                    className="filter-select"
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                  >
                    <option value="all">Tất cả dự án</option>
                    {w.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Lọc tháng"
                    className="filter-select"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  >
                    <option value="all">Tất cả thời gian</option>
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {m.split("-").reverse().join("/")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ngày nhận</th>
                        <th>Dự án</th>
                        <th>Mã chứng từ</th>
                        <th>Nội dung</th>
                        <th className="right">Số tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReceipts.map((r) => (
                        <tr key={r.id}>
                          <td>{dateLabel(r.date)}</td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() => openProject(r.projectId)}
                            >
                              {project(r.projectId)?.name}
                            </button>
                          </td>
                          <td>
                            <span className="code">{r.reference}</span>
                          </td>
                          <td>{r.note || "—"}</td>
                          <td className="right received">+{money(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredReceipts.length && (
                    <Empty title="Chưa có giao dịch phù hợp" />
                  )}
                </div>
              </section>
              <p className="section-note">
                <CircleHelp size={15} />
                Các số liệu trên phục vụ quản trị. Doanh thu kế toán cần đối
                chiếu với sổ kế toán của công ty.
              </p>
            </>
          )}
          {page === "team" && (
            <Personnel
              w={w}
              session={session}
              onEdit={(p) => setForm({ kind: "member", initial: p })}
              onEditTask={(t) => setForm({ kind: "task", initial: t })}
            />
          )}
          {page === "documents" && (
            <>
              <div className="document-summary">
                <div className="drive-icon">
                  <Cloud size={25} />
                </div>
                <div>
                  <h3>Hồ sơ tập trung. Tài liệu nằm trên Drive.</h3>
                  <p>
                    Dashboard quản lý danh mục, phiên bản và liên kết; quyền
                    truy cập được giữ theo Drive.
                  </p>
                </div>
                <span className="soft-label">{w.documents.length} hồ sơ</span>
              </div>
              <div className="toolbar">
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder="Tìm tên hồ sơ, nhóm hoặc dự án…"
                />
                <select
                  className="filter-select"
                  aria-label="Lọc dự án"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                >
                  <option value="all">Tất cả dự án</option>
                  {w.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code}
                    </option>
                  ))}
                </select>
                <select
                  className="filter-select"
                  aria-label="Lọc nhóm hồ sơ"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Tất cả nhóm hồ sơ</option>
                  {[...new Set(w.documents.map((d) => d.category))].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <section className="panel">
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tên hồ sơ</th>
                        <th>Dự án</th>
                        <th>Nhóm</th>
                        <th>Phiên bản</th>
                        <th>Trạng thái</th>
                        <th>Cập nhật</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocs.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <button
                              className="file-name"
                              onClick={() => openUrl(d.url)}
                            >
                              <span className="file-icon">
                                <FileText size={20} />
                              </span>
                              <b>{d.name}</b>
                            </button>
                          </td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() => openProject(d.projectId)}
                            >
                              {project(d.projectId)?.code}
                            </button>
                          </td>
                          <td>{d.category}</td>
                          <td>
                            <span className="code">{d.version}</span>
                          </td>
                          <td>
                            <span
                              className={
                                "badge " +
                                (["Phát hành", "Đã ký"].includes(d.status)
                                  ? "completed"
                                  : "paused")
                              }
                            >
                              {d.status}
                            </span>
                          </td>
                          <td>{dateLabel(d.updatedAt)}</td>
                          <td>
                            <button
                              className="icon-button"
                              aria-label={"Mở " + d.name}
                              onClick={() => openUrl(d.url)}
                            >
                              <ArrowUpRight size={17} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredDocs.length && (
                    <Empty
                      title="Chưa có hồ sơ phù hợp"
                      detail="Thêm liên kết Drive và thông tin phiên bản để bắt đầu."
                    />
                  )}
                </div>
              </section>
            </>
          )}
          {page === "settings" && (
            <>
              <div className="settings-grid">
                <section className="panel settings-card">
                  <div className="connection-head">
                    <span className="connection-logo trello-logo">
                      <span />
                      <span />
                    </span>
                    <div>
                      <h2>Trello</h2>
                      <p>Nguồn công việc & tiến độ</p>
                    </div>
                    <span
                      className={
                        "badge " +
                        (session.integrations.trello ? "completed" : "paused")
                      }
                    >
                      {session.integrations.trello
                        ? "Đã cấu hình"
                        : "Chưa kết nối"}
                    </span>
                  </div>
                  <p>
                    Đọc bảng, công việc, người phụ trách và thời hạn. Đồng bộ tự
                    động mỗi 15 phút khi chạy trên Cloudflare của bạn.
                  </p>
                  <dl>
                    <div>
                      <dt>Chiều đồng bộ</dt>
                      <dd>Trello → Dashboard</dd>
                    </div>
                    <div>
                      <dt>Đồng bộ gần nhất</dt>
                      <dd>
                        {w.settings.lastSync
                          ? new Date(w.settings.lastSync).toLocaleString(
                              "vi-VN",
                            )
                          : "Chưa đồng bộ"}
                      </dd>
                    </div>
                  </dl>
                  {w.settings.syncError && (
                    <div className="form-error">{w.settings.syncError}</div>
                  )}
                  <button
                    className="button"
                    disabled={busy || !admin}
                    onClick={sync}
                  >
                    <RefreshCw size={16} className={busy ? "spin" : ""} />
                    Đồng bộ ngay
                  </button>
                </section>
                <section className="panel settings-card">
                  <div className="connection-head">
                    <span className="connection-logo drive-logo">
                      <Cloud size={25} />
                    </span>
                    <div>
                      <h2>Google Drive</h2>
                      <p>Nguồn tài liệu & hồ sơ</p>
                    </div>
                    <span
                      className={
                        "badge " +
                        (session.integrations.drive ? "completed" : "paused")
                      }
                    >
                      {session.integrations.drive
                        ? "Đã cấu hình"
                        : "Chưa kết nối"}
                    </span>
                  </div>
                  <p>
                    Gắn thư mục theo dự án để liệt kê tài liệu. Liên kết hồ sơ
                    có thể thêm ngay cả khi chưa cấu hình API.
                  </p>
                  <dl>
                    <div>
                      <dt>Lưu trữ tệp gốc</dt>
                      <dd>Google Drive</dd>
                    </div>
                    <div>
                      <dt>Quyền truy cập tài liệu</dt>
                      <dd>Theo tài khoản Drive</dd>
                    </div>
                  </dl>
                  <button
                    className="button"
                    onClick={() => changePage("documents")}
                  >
                    <FolderOpen size={16} />
                    Mở danh mục hồ sơ
                  </button>
                </section>
              </div>
              <section className="panel settings-card">
                <div className="panel-heading no-pad">
                  <div>
                    <h2>Thiết lập không gian làm việc</h2>
                    <p>
                      {admin
                        ? "Chỉ quản trị viên được thay đổi cấu hình."
                        : "Liên hệ quản trị viên để thay đổi cấu hình."}
                    </p>
                  </div>
                  <ShieldCheck size={21} />
                </div>
                <Field label="Tên công ty">
                  <input
                    value={company}
                    disabled={!admin}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </Field>
                <div className="settings-subhead">
                  <div>
                    <h3>Chọn Workspace Trello</h3>
                    <p>
                      Chọn Workspace, tải các bảng rồi chọn bảng muốn đưa vào
                      Dashboard. Mỗi bảng tương ứng một dự án.
                    </p>
                  </div>
                  <button
                    className="button small"
                    disabled={!admin || busy || session.mode === "demo"}
                    onClick={async () => {
                      setBusy(true);
                      setSettingsError("");
                      setSettingsRecovery(false);
                      try {
                        setTrelloWorkspaces(
                          await request("/trello/workspaces"),
                        );
                      } catch (e) {
                        setSettingsError((e as Error).message);
                        setSettingsRecovery(
                          e instanceof ApiError &&
                            (e.kind === "auth" || e.kind === "network"),
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <RefreshCw size={15} />
                    Tải Workspace
                  </button>
                </div>
                {session.mode === "demo" && (
                  <div className="info-box">
                    Chọn Workspace và đồng bộ Trello cần chế độ dữ liệu thật
                    cùng khóa Trello trên Cloudflare.
                  </div>
                )}
                {session.mode === "live" && !session.integrations.trello && (
                  <div className="form-error">
                    Thêm TRELLO_API_KEY và TRELLO_TOKEN tại Cloudflare Worker →
                    Settings → Variables and Secrets, sau đó tải lại trang.
                  </div>
                )}
                <div className="trello-workspace-controls">
                  <Field label="Workspace Trello">
                    <select
                      value={trelloWorkspaceId}
                      disabled={!admin || busy || !trelloWorkspaces.length}
                      onChange={(e) => {
                        setTrelloWorkspaceId(e.target.value);
                        setBoards([]);
                        setBoardTargets({});
                        setSettingsError("");
                        setSettingsRecovery(false);
                      }}
                    >
                      <option value="">Chọn Workspace</option>
                      {!trelloWorkspaces.some(
                        (x) => x.id === trelloWorkspaceId,
                      ) &&
                        trelloWorkspaceId && (
                          <option value={trelloWorkspaceId}>
                            Workspace đã lưu — tải danh sách để xem tên
                          </option>
                        )}
                      {trelloWorkspaces.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.displayName}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button
                    className="button small"
                    disabled={
                      !admin ||
                      busy ||
                      !trelloWorkspaceId ||
                      session.mode === "demo"
                    }
                    onClick={async () => {
                      setBusy(true);
                      setSettingsError("");
                      setSettingsRecovery(false);
                      setBoards([]);
                      setBoardTargets({});
                      try {
                        const loaded = await request<typeof boards>(
                          "/trello/boards?workspaceId=" +
                            encodeURIComponent(trelloWorkspaceId),
                        );
                        setBoards(loaded);
                        setBoardTargets(
                          Object.fromEntries(
                            loaded.map((b) => [
                              b.id,
                              w.projects.find((p) => p.boardId === b.id)?.id ||
                                "",
                            ]),
                          ),
                        );
                        if (!loaded.length)
                          setSettingsError(
                            "Workspace này chưa có bảng đang mở mà tài khoản Trello có thể đọc.",
                          );
                      } catch (e) {
                        setSettingsError((e as Error).message);
                        setSettingsRecovery(
                          e instanceof ApiError &&
                            (e.kind === "auth" || e.kind === "network"),
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <RefreshCw size={15} />
                    Tải bảng trong Workspace
                  </button>
                </div>
                {!!boards.length && (
                  <div className="settings-subhead">
                    <div>
                      <h3>Chọn bảng và ánh xạ cột</h3>
                      <p>
                        Chỉ chọn “Hoàn thành” cho cột đã qua kiểm tra. Bỏ chọn
                        bảng không xóa dự án đã gắn.
                      </p>
                    </div>
                  </div>
                )}
                {boards.map((b) => (
                  <div className="mapping-board" key={b.id}>
                    <h4>
                      {b.name}
                      <code>{b.id}</code>
                    </h4>
                    <div className="trello-board-target">
                      <label htmlFor={"target-" + b.id}>Đưa vào dự án</label>
                      <select
                        id={"target-" + b.id}
                        value={boardTargets[b.id] || ""}
                        disabled={!admin || busy || session.mode === "demo"}
                        onChange={(e) =>
                          setBoardTargets({
                            ...boardTargets,
                            [b.id]: e.target.value,
                          })
                        }
                      >
                        <option value="">Không chọn bảng này</option>
                        {!w.projects.some((p) => p.boardId === b.id) && (
                          <option value="__new__">
                            Tạo dự án mới từ tên bảng
                          </option>
                        )}
                        {w.projects
                          .filter((p) => !p.boardId || p.boardId === b.id)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.boardId ? "Đã gắn: " : "Gắn vào: "}
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    {(session.mode === "demo" || !!boardTargets[b.id]) &&
                      b.lists.map((l) => (
                        <div key={l.id}>
                          <label htmlFor={l.id}>{l.name}</label>
                          <select
                            id={l.id}
                            disabled={!admin || busy}
                            value={mapping[l.id] || ""}
                            onChange={(e) =>
                              setMapping({
                                ...mapping,
                                [l.id]: e.target.value as TaskStatus,
                              })
                            }
                          >
                            <option value="" disabled>
                              Chọn trạng thái
                            </option>
                            {Object.entries(taskLabels).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                  </div>
                ))}
                {!!boards.length && admin && (
                  <div className="trello-import-actions">
                    {Object.values(boardTargets).includes("__new__") && (
                      <>
                        <p>
                          Dự án mới dùng bạn làm người phụ trách, giá trị hợp
                          đồng bằng 0. Chọn ngày dự kiến; sau khi tạo có thể sửa
                          thông tin trong Dự án.
                        </p>
                        <div className="trello-workspace-controls">
                          <Field label="Ngày bắt đầu dự án mới">
                            <input
                              type="date"
                              value={importStart}
                              disabled={busy}
                              onChange={(e) => setImportStart(e.target.value)}
                            />
                          </Field>
                          <Field label="Hạn bàn giao dự án mới">
                            <input
                              type="date"
                              value={importDue}
                              disabled={busy}
                              min={importStart}
                              onChange={(e) => setImportDue(e.target.value)}
                            />
                          </Field>
                        </div>
                      </>
                    )}
                    <button
                      className="button primary"
                      disabled={
                        busy ||
                        session.mode === "demo" ||
                        !Object.values(boardTargets).some(Boolean)
                      }
                      onClick={async () => {
                        setSettingsError("");
                        setSettingsRecovery(false);
                        const targets = boards
                          .filter((b) => boardTargets[b.id])
                          .map((b) => ({
                            boardId: b.id,
                            ...(boardTargets[b.id] === "__new__"
                              ? {}
                              : { projectId: boardTargets[b.id] }),
                          }));
                        if (targets.length > 20) {
                          setSettingsError("Chọn tối đa 20 bảng mỗi lần.");
                          return;
                        }
                        if (
                          targets.some((t) => !t.projectId) &&
                          (!importStart ||
                            !importDue ||
                            importDue < importStart)
                        ) {
                          setSettingsError(
                            "Chọn ngày bắt đầu và hạn bàn giao hợp lệ cho dự án mới.",
                          );
                          return;
                        }
                        if (
                          boards
                            .filter((b) => boardTargets[b.id])
                            .some((b) => b.lists.some((l) => !mapping[l.id]))
                        ) {
                          setSettingsError(
                            "Chọn trạng thái cho tất cả cột của các bảng đã chọn.",
                          );
                          return;
                        }
                        setBusy(true);
                        try {
                          const result = await request<{
                            created: number;
                            linked: number;
                            existing: number;
                          }>("/trello/import", "POST", {
                            workspaceId: trelloWorkspaceId,
                            targets,
                            listMapping: mapping,
                            start: importStart || localDate(),
                            due: importDue || importStart || localDate(),
                          });
                          const latest = await bootstrap();
                          setW(latest.workspace);
                          setSession(latest.session);
                          setMapping(latest.workspace.settings.listMapping);
                          setBoardTargets(
                            Object.fromEntries(
                              boards.map((b) => [
                                b.id,
                                boardTargets[b.id]
                                  ? latest.workspace.projects.find(
                                      (p) => p.boardId === b.id,
                                    )?.id || ""
                                  : "",
                              ]),
                            ),
                          );
                          setToast(
                            `Đã tạo ${result.created} dự án, gắn ${result.linked} bảng và giữ ${result.existing} liên kết. Bấm Đồng bộ ngay để tải công việc.`,
                          );
                        } catch (e) {
                          setSettingsError((e as Error).message);
                          setSettingsRecovery(
                            e instanceof ApiError &&
                              (e.kind === "auth" || e.kind === "network"),
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Check size={16} />
                      Lưu bảng & ánh xạ
                    </button>
                    <button
                      className="button"
                      disabled={busy || !w.projects.some((p) => p.boardId)}
                      onClick={sync}
                    >
                      <RefreshCw size={16} />
                      Đồng bộ ngay
                    </button>
                    <p>
                      Đồng bộ lấy công việc từ tất cả dự án đã gắn bảng Trello,
                      kể cả bảng thuộc Workspace khác.
                    </p>
                  </div>
                )}
                {!boards.length && (
                  <div className="info-box">
                    <Link2 size={18} />
                    <span>
                      {Object.keys(mapping).length
                        ? `Đã lưu ${Object.keys(mapping).length} ánh xạ cột. Tải danh sách bảng để chỉnh sửa.`
                        : "Tải Workspace, chọn Workspace và tải bảng để bắt đầu kết nối dự án."}
                    </span>
                  </div>
                )}
                {settingsError && (
                  <div className="form-error" role="alert">
                    <p>{settingsError}</p>
                    {settingsRecovery && (
                      <a className="button small" href="/">
                        Mở lại Dashboard / đăng nhập lại
                      </a>
                    )}
                  </div>
                )}
                {admin && (
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={async () => {
                      setSettingsError("");
                      setSettingsRecovery(false);
                      if (!company.trim()) {
                        setSettingsError("Tên công ty không được để trống.");
                        return;
                      }
                      setBusy(true);
                      try {
                        if (session.mode === "demo")
                          commit({
                            ...w,
                            settings: {
                              ...w.settings,
                              companyName: company.trim(),
                              listMapping: mapping,
                            },
                          });
                        else {
                          await request("/settings", "PUT", {
                            companyName: company.trim(),
                            listMapping: mapping,
                          });
                          await refresh();
                        }
                        setToast("Đã lưu cấu hình.");
                      } catch (e) {
                        setSettingsError((e as Error).message);
                        setSettingsRecovery(
                          e instanceof ApiError &&
                            (e.kind === "auth" || e.kind === "network"),
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Check size={16} />
                    Lưu cấu hình
                  </button>
                )}
              </section>
              {session.mode === "live" && authMode === "password" && (
                <AccountSettings people={w.people} user={session.user} />
              )}
              <section className="panel settings-card">
                <div className="panel-heading no-pad">
                  <div>
                    <h2>Đưa vào vận hành</h2>
                    <p>
                      Mã nguồn gồm Worker, D1, cấu hình triển khai và hướng dẫn
                      chi tiết.
                    </p>
                  </div>
                  <BookOpen size={20} />
                </div>
                <ol className="setup-steps">
                  <li>
                    <span>01</span>
                    <div>
                      <b>Triển khai trên Cloudflare</b>
                      <p>
                        Tạo cơ sở dữ liệu D1, chạy migrations và deploy Worker.
                        Thiết lập tài khoản quản trị và mật khẩu.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>02</span>
                    <div>
                      <b>Cấu hình kết nối ở máy chủ</b>
                      <p>
                        Đặt khóa Trello và OAuth Google Drive bằng Wrangler
                        secrets. Bật APP_MODE=live sau khi cấu hình đăng nhập.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>03</span>
                    <div>
                      <b>Chuẩn hóa dữ liệu dự án</b>
                      <p>
                        Thêm nhân sự, dự án, Board ID, Folder ID. Ánh xạ cột,
                        đồng bộ và xác nhận trọng số từng công việc.
                      </p>
                    </div>
                  </li>
                </ol>
                {session.mode === "demo" && (
                  <div className="reset-row">
                    <div>
                      <b>Khôi phục dữ liệu minh họa</b>
                      <p>
                        Xóa những thay đổi của bản dùng thử trên thiết bị này.
                      </p>
                    </div>
                    <button
                      className="button"
                      onClick={() => setResetConfirm(true)}
                    >
                      Khôi phục demo
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
          <footer className="footer">
            <span>
              <span className="footer-logo">CT</span> Công Trình{" "}
              <span className="footer-slash">/</span> Project Workspace
            </span>
            <span>
              {session.mode === "demo"
                ? "Bản dùng thử · Dữ liệu minh họa"
                : "Cloudflare Workers · Dữ liệu công ty"}{" "}
              <span className="footer-dot" /> v1.0
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Đóng thông báo"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {form && (
        <Modal
          title={
            form.initial && form.kind === "project"
              ? "Chỉnh sửa dự án"
              : form.initial && form.kind === "member"
                ? "Cập nhật nhân sự"
                : modalNames[form.kind]
          }
          subtitle={
            form.kind === "task"
              ? (form.initial as Task)?.title
              : session.mode === "demo"
                ? "Dữ liệu được lưu trong bản dùng thử."
                : undefined
          }
          onClose={() => setForm(null)}
        >
          <EntryForm
            kind={form.kind}
            w={w}
            initial={form.initial}
            projectId={form.projectId}
            onSave={save}
            onClose={() => setForm(null)}
          />
        </Modal>
      )}
      {selected && !form && (
        <Modal
          wide
          title={selected.name}
          subtitle={`${selected.code} · ${selected.client}`}
          onClose={() => setDetail(null)}
        >
          <div className="project-detail">
            <div className="detail-top">
              <Badge status={projectHealth(selected, tasksFor(selected.id))} />
              <span>{selected.phase}</span>
              {admin && (
                <button
                  className="text-link"
                  onClick={() =>
                    setForm({ kind: "project", initial: selected })
                  }
                >
                  Chỉnh sửa
                </button>
              )}
            </div>
            <div className="detail-kpis">
              <div>
                <small>Tiến độ thực hiện</small>
                <strong>{projectProgress(tasksFor(selected.id))}%</strong>
                <Progress value={projectProgress(tasksFor(selected.id))} />
              </div>
              <div>
                <small>Kế hoạch theo thời gian*</small>
                <strong>{plannedProgress(selected)}%</strong>
                <span>
                  {dateLabel(selected.start)} → {dateLabel(selected.due)}
                </span>
              </div>
              {finance && (
                <>
                  <div>
                    <small>Giá trị hợp đồng</small>
                    <strong>{money(selected.contract, true)}</strong>
                    <span>Đã nghiệm thu {money(selected.accepted, true)}</span>
                  </div>
                  <div>
                    <small>Tiền đã thu</small>
                    <strong>
                      {money(
                        w.receipts
                          .filter((r) => r.projectId === selected.id)
                          .reduce((s, r) => s + r.amount, 0),
                        true,
                      )}
                    </strong>
                    <span>Theo giao dịch thực nhận</span>
                  </div>
                </>
              )}
            </div>
            <p className="section-note">
              * Mốc tham chiếu tuyến tính theo thời gian, chưa phải kế hoạch
              khối lượng chi tiết.
            </p>
            {tasksFor(selected.id).some((t) => t.weight === 0) && (
              <div className="info-box">
                <TriangleAlert size={17} />
                <span>
                  Có công việc chưa được gán trọng số. Hoàn thiện trọng số để
                  tiến độ phản ánh đủ khối lượng.
                </span>
              </div>
            )}
            <div className="detail-tabs">
              {[
                ["tasks", "Công việc"],
                ["files", "Hồ sơ"],
                ...(finance ? [["finance", "Thanh toán"]] : []),
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={detailTab === id ? "active" : ""}
                  onClick={() => setDetailTab(id)}
                >
                  {label}
                </button>
              ))}
              <button
                className="text-link"
                onClick={() =>
                  openUrl(
                    selected.boardUrl ||
                      (selected.boardId
                        ? "https://trello.com/b/" + selected.boardId
                        : ""),
                  )
                }
              >
                Mở Trello <ExternalLink size={13} />
              </button>
            </div>
            {detailTab === "tasks" && taskList(tasksFor(selected.id))}
            {detailTab === "files" && (
              <>
                <div className="toolbar">
                  <span>
                    {
                      w.documents.filter((d) => d.projectId === selected.id)
                        .length
                    }{" "}
                    hồ sơ trong danh mục
                  </span>
                  {canManage && (
                    <button
                      className="button small"
                      disabled={busy}
                      onClick={() => openDrive(selected)}
                    >
                      <Cloud size={15} />
                      Đọc thư mục Drive
                    </button>
                  )}
                  {session.user.role !== "finance" && (
                    <button
                      className="button small"
                      onClick={() =>
                        setForm({ kind: "document", projectId: selected.id })
                      }
                    >
                      <Plus size={15} />
                      Thêm hồ sơ
                    </button>
                  )}
                </div>
                {w.documents
                  .filter((d) => d.projectId === selected.id)
                  .map((d) => (
                    <button
                      className="detail-file"
                      key={d.id}
                      onClick={() => openUrl(d.url)}
                    >
                      <FileText size={20} />
                      <span>
                        <b>{d.name}</b>
                        <small>
                          {d.category} · {d.version} · {d.status}
                        </small>
                      </span>
                      <ArrowUpRight size={18} />
                    </button>
                  ))}
              </>
            )}
            {detailTab === "finance" && (
              <>
                <div className="toolbar">
                  <span>Giao dịch thực nhận của dự án</span>
                  {canMoney && (
                    <button
                      className="button small"
                      onClick={() =>
                        setForm({ kind: "receipt", projectId: selected.id })
                      }
                    >
                      <Plus size={15} />
                      Ghi nhận
                    </button>
                  )}
                </div>
                {w.receipts
                  .filter((r) => r.projectId === selected.id)
                  .map((r) => (
                    <div className="detail-receipt" key={r.id}>
                      <span>
                        <b>{r.note || r.reference}</b>
                        <small>
                          {dateLabel(r.date)} · {r.reference}
                        </small>
                      </span>
                      <b className="green-text">+{money(r.amount)}</b>
                    </div>
                  ))}
              </>
            )}
          </div>
        </Modal>
      )}
      {notifications && (
        <Modal
          title="Cần chú ý"
          subtitle="Công việc quá hạn và vướng mắc cần tháo gỡ"
          onClose={() => setNotifications(false)}
        >
          {taskList(
            w.tasks.filter(
              (t) => isOverdue(t) || (!t.archived && t.status === "blocked"),
            ),
          )}
        </Modal>
      )}
      {help && (
        <Modal title="Bắt đầu với Công Trình" onClose={() => setHelp(false)}>
          <div className="help-content">
            <h3>1. Khai báo danh mục</h3>
            <p>
              Thêm nhân sự và dự án. Mỗi dự án liên kết với một bảng Trello và
              một thư mục Drive.
            </p>
            <h3>2. Theo dõi công việc</h3>
            <p>
              Nhân viên cập nhật Trello. Chủ nhiệm xác nhận trọng số và phần
              trăm hoàn thành trên dashboard. Tiến độ = tổng (trọng số × phần
              trăm hoàn thành) / tổng trọng số.
            </p>
            <h3>3. Theo dõi tiền</h3>
            <p>
              Kế toán nhập đợt thanh toán đến hạn, sau đó ghi nhận khoản thực
              nhận và phân bổ vào đợt tương ứng. Giá trị nghiệm thu được cập
              nhật trong thông tin dự án.
            </p>
            <h3>4. Quản lý hồ sơ</h3>
            <p>
              Thêm liên kết Drive, nhóm hồ sơ và phiên bản. Dashboard không thay
              thế việc ký, phê duyệt hoặc nghiệm thu hồ sơ.
            </p>
            <div className="info-box">
              Bản dùng thử có thể chỉnh sửa và khôi phục ở phần Kết nối & cài
              đặt. Dữ liệu mẫu được lưu riêng trên trình duyệt hiện tại.
            </div>
          </div>
        </Modal>
      )}
      {resetConfirm && (
        <Modal
          title="Khôi phục bản dùng thử?"
          subtitle="Các thay đổi dữ liệu mẫu trên trình duyệt này sẽ được thay bằng bộ dữ liệu ban đầu."
          onClose={() => setResetConfirm(false)}
        >
          <div className="form-actions">
            <button className="button" onClick={() => setResetConfirm(false)}>
              Giữ lại
            </button>
            <button
              className="button primary"
              onClick={() => {
                const fresh = resetDemo();
                commit(fresh);
                setCompany(fresh.settings.companyName);
                setMapping({});
                setResetConfirm(false);
                setToast("Đã khôi phục dữ liệu minh họa.");
              }}
            >
              Khôi phục
            </button>
          </div>
        </Modal>
      )}
      {driveView && (
        <Modal
          title="Tài liệu trong thư mục Drive"
          subtitle={project(driveView.projectId)?.name}
          onClose={() => setDriveView(null)}
        >
          <div className="drive-files">
            {driveView.files.map((f) => (
              <button
                key={f.id}
                className="detail-file"
                onClick={() =>
                  openUrl(
                    f.webViewLink ||
                      "https://drive.google.com/file/d/" + f.id + "/view",
                  )
                }
              >
                <FileText size={18} />
                <span>
                  <b>{f.name}</b>
                  <small>{dateLabel(f.modifiedTime)}</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
            {!driveView.files.length && (
              <Empty title="Thư mục chưa có tài liệu" />
            )}
            {driveView.nextPageToken && (
              <button
                className="button"
                disabled={busy}
                onClick={() => openDrive(project(driveView.projectId)!, true)}
              >
                Tải thêm
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-box">
      <Search size={17} />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button aria-label="Xóa tìm kiếm" onClick={() => onChange("")}>
          <X size={14} />
        </button>
      )}
    </label>
  );
}
function CashChart({ receipts }: { receipts: Workspace["receipts"] }) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 15);
    const key =
      date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
    return {
      key,
      label: "T" + (date.getMonth() + 1),
      amount:
        receipts
          .filter((r) => r.date.startsWith(key))
          .reduce((s, r) => s + r.amount, 0) / 1e6,
    };
  });
  const max = Math.max(
    100,
    Math.ceil(Math.max(...months.map((m) => m.amount)) / 100) * 100,
  );
  return (
    <div className="cash-chart">
      <div className="y-labels">
        {[max, max * 0.75, max * 0.5, max * 0.25, 0].map((v, i) => (
          <span key={i}>{Math.round(v).toLocaleString("vi-VN")}</span>
        ))}
      </div>
      <div className="chart-plot">
        <div className="chart-grid">
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} />
          ))}
        </div>
        <div className="chart-bars">
          {months.map((m, i) => (
            <div className="chart-column" key={m.key}>
              <div
                className={"bar " + (i === 5 ? "current" : "")}
                style={{
                  height:
                    Math.max(m.amount > 0 ? 2 : 0, (m.amount / max) * 100) +
                    "%",
                }}
                tabIndex={0}
                aria-label={`${m.key}: ${money(m.amount * 1e6)}`}
              >
                <span className="bar-tooltip">
                  {money(m.amount * 1e6, true)}
                </span>
              </div>
              <span className="x-label">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function Portfolio({ w }: { w: Workspace }) {
  const groups = [
    { id: "ontrack", label: "Đúng tiến độ", color: "#345e50" },
    { id: "late", label: "Chậm tiến độ", color: "#c28a53" },
    { id: "risk", label: "Cần chú ý", color: "#dbc078" },
    { id: "paused", label: "Tạm dừng", color: "#c1c8bc" },
    { id: "completed", label: "Hoàn thành", color: "#9eaf8d" },
  ].map((g) => ({
    ...g,
    count: w.projects.filter(
      (p) =>
        projectHealth(
          p,
          w.tasks.filter((t) => t.projectId === p.id),
        ) === g.id,
    ).length,
  }));
  let offset = 0;
  const total = Math.max(1, w.projects.length);
  return (
    <div className="portfolio-content">
      <div className="donut">
        <svg viewBox="0 0 160 160" aria-label="Phân bố tình trạng dự án">
          <circle
            cx="80"
            cy="80"
            r="62"
            fill="none"
            stroke="#edf0e9"
            strokeWidth="15"
          />
          {groups.map((g) => {
            const start = offset;
            offset += (g.count / total) * 389.56;
            return (
              <circle
                key={g.id}
                cx="80"
                cy="80"
                r="62"
                fill="none"
                stroke={g.color}
                strokeWidth="15"
                strokeDasharray={`${Math.max(0, (g.count / total) * 389.56 - 3)} ${389.56}`}
                strokeDashoffset={-start}
                transform="rotate(-90 80 80)"
              />
            );
          })}
        </svg>
        <div>
          <strong>{w.projects.length.toString().padStart(2, "0")}</strong>
          <span>Dự án</span>
        </div>
      </div>
      <div className="donut-legend">
        {groups
          .filter((g) => g.count > 0)
          .map((g) => (
            <div key={g.id}>
              <i style={{ background: g.color }} />
              <span>{g.label}</span>
              <b>{g.count.toString().padStart(2, "0")}</b>
            </div>
          ))}
      </div>
    </div>
  );
}
