import { useEffect, useMemo, useState } from "react";
import {
  Users,
  CheckCheck,
  Clock3,
  TriangleAlert,
  Download,
  RefreshCw,
  Pencil,
  Search,
} from "lucide-react";
import type { Person, Workspace, Session, Task } from "../shared/types";
import { taskLabels, roleLabels } from "../shared/types";
import { localDate, isOverdue, csv } from "../shared/metrics";
import {
  organizationName,
  personnelMetrics,
  type PersonnelReport,
  taskMovement,
} from "../shared/personnel";
import { Avatar } from "./components";
import { request } from "./api";
function demoReport(w: Workspace, day: string): PersonnelReport {
  return {
    day,
    source: day === localDate() ? "current" : "snapshot",
    capturedAt: day + "T10:00:00Z",
    tasks: w.tasks,
    previousDay: new Date(Date.parse(day + "T00:00:00Z") - 86400000)
      .toISOString()
      .slice(0, 10),
    previousAvailable: false,
    previousTasks: [],
  };
}
const number = (v: number | null, suffix = "") =>
  v === null
    ? "—"
    : v.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + suffix;
export default function Personnel({
  w,
  session,
  onEdit,
  onEditTask,
}: {
  w: Workspace;
  session: Session;
  onEdit: (p: Person) => void;
  onEditTask: (t: Task) => void;
}) {
  const [day, setDay] = useState(localDate()),
    [department, setDepartment] = useState("all"),
    [team, setTeam] = useState("all"),
    [member, setMember] = useState("all"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [tab, setTab] = useState("overview");
  const [report, setReport] = useState<PersonnelReport | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const admin = session.user.role === "admin",
    manager = session.user.role === "manager";
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setReport(null);
    (session.mode === "demo"
      ? Promise.resolve(demoReport(w, day))
      : request<PersonnelReport>(
          "/personnel/report?day=" + encodeURIComponent(day),
        )
    )
      .then((r) => {
        if (active) setReport(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [day, version, w, session.mode]);
  const people = useMemo(
    () =>
      w.people.filter(
        (p) =>
          admin ||
          (manager
            ? (report?.tasks || w.tasks).some((t) => t.assigneeId === p.id)
            : p.id === session.user.id),
      ),
    [w, report, admin, manager, session.user.id],
  );
  const departments = [
    ...new Set(people.map((p) => organizationName(p, "department"))),
  ].sort();
  const teams = [
    ...new Set(
      people
        .filter(
          (p) =>
            department === "all" ||
            organizationName(p, "department") === department,
        )
        .map((p) => organizationName(p, "team")),
    ),
  ].sort();
  const filtered = people.filter(
    (p) =>
      (department === "all" ||
        organizationName(p, "department") === department) &&
      (team === "all" || organizationName(p, "team") === team) &&
      (member === "all" || p.id === member) &&
      [p.name, p.discipline, p.department, p.team]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const ids = new Set(filtered.map((p) => p.id));
  const tasks = (report?.tasks || []).filter((t) => ids.has(t.assigneeId));
  const unassigned =
    admin || manager
      ? (report?.tasks || []).filter((t) => !t.assigneeId).length
      : 0;
  const metrics = personnelMetrics(tasks, day);
  const previous = (report?.previousTasks || []).filter((t) =>
    ids.has(t.assigneeId),
  );
  const movement = taskMovement(tasks, previous, !!report?.previousAvailable);
  function exportCsv() {
    const rows: (string | number)[][] = [
      [
        "Ngày",
        "Nhân sự",
        "Phòng ban",
        "Team",
        "Đang mở",
        "Hoàn thành trong ngày",
        "Quá hạn",
        "Vướng mắc",
        "Tiến độ có trọng số (%)",
        "Đúng hạn (%)",
        "Mẫu đúng hạn",
        "Task tăng tiến độ so với hôm trước",
        "Task chuyển hoàn thành",
        "Task đổi trạng thái",
        "Giờ dự kiến đang mở",
      ],
    ];
    for (const p of filtered) {
      const m = personnelMetrics(
        tasks.filter((t) => t.assigneeId === p.id),
        day,
      );
      rows.push([
        day,
        p.name,
        organizationName(p, "department"),
        organizationName(p, "team"),
        m.open,
        m.done,
        m.overdue,
        m.blocked,
        m.progress ?? "",
        m.onTime ?? "",
        m.onTimeSample,
        taskMovement(
          tasks.filter((t) => t.assigneeId === p.id),
          previous,
          !!report?.previousAvailable,
        ).improved ?? "",
        taskMovement(
          tasks.filter((t) => t.assigneeId === p.id),
          previous,
          !!report?.previousAvailable,
        ).completed ?? "",
        taskMovement(
          tasks.filter((t) => t.assigneeId === p.id),
          previous,
          !!report?.previousAvailable,
        ).changed ?? "",
        m.estimated,
      ]);
    }
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + csv(rows)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "bao-cao-nhan-su-" + day + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const taskFiltered = tasks.filter(
    (t) =>
      !t.archived &&
      (status === "all" ||
        (status === "overdue" ? isOverdue(t, day) : t.status === status)),
  );
  return (
    <div className="personnel-page">
      <section className="personnel-hero">
        <div>
          <span className="eyebrow">NHÂN SỰ & HIỆU SUẤT</span>
          <h2>Mỗi ngày, rõ tiến độ từng người.</h2>
          <p>
            Theo dõi công việc, xử lý vướng mắc và tổng hợp báo cáo theo phòng
            ban.
          </p>
        </div>
        <div className="personnel-hero-count">
          <Users size={24} />
          <strong>{people.length}</strong>
          <span>thành viên trong phạm vi của bạn</span>
        </div>
      </section>
      <section className="personnel-filters panel" aria-label="Bộ lọc nhân sự">
        <label>
          Ngày báo cáo
          <input
            aria-label="Ngày báo cáo"
            type="date"
            value={day}
            max={localDate()}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
          />
        </label>
        <label>
          Phòng ban
          <select
            aria-label="Phòng ban"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setTeam("all");
              setMember("all");
            }}
          >
            <option value="all">Tất cả phòng ban</option>
            {departments.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Team
          <select
            aria-label="Team"
            value={team}
            onChange={(e) => {
              setTeam(e.target.value);
              setMember("all");
            }}
          >
            <option value="all">Tất cả team</option>
            {teams.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Nhân sự
          <select
            aria-label="Nhân sự"
            value={member}
            onChange={(e) => setMember(e.target.value)}
          >
            <option value="all">Tất cả nhân sự</option>
            {people
              .filter(
                (p) =>
                  (department === "all" ||
                    organizationName(p, "department") === department) &&
                  (team === "all" || organizationName(p, "team") === team),
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Tìm kiếm
          <input
            aria-label="Tìm nhân sự"
            placeholder="Tên, chuyên môn…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          className="button"
          disabled={loading}
          onClick={() => setVersion((v) => v + 1)}
        >
          <RefreshCw size={15} />
          Tải lại
        </button>
        <button
          className="button"
          disabled={!report || report.source === "missing" || loading}
          onClick={exportCsv}
        >
          <Download size={15} />
          Xuất CSV
        </button>
      </section>
      <div className="personnel-context">
        {session.mode === "demo"
          ? "Số liệu minh họa; báo cáo tự động tổng hợp từ trạng thái công việc."
          : report?.source === "snapshot"
            ? `Lịch sử ngày ${day}, chốt lần cuối lúc ${new Date(report.capturedAt).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}. Phòng ban/team dùng phân nhóm nhân sự hiện tại.`
            : "Số liệu hiện tại; lịch sử trạng thái được lưu tự động mỗi 15 phút, không phải chấm công."}
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {loading && (
        <div className="info-box" role="status">
          Đang tải báo cáo nhân sự…
        </div>
      )}
      {report?.source === "missing" && (
        <div className="info-box">
          Chưa có lịch sử công việc ngày {day}. Hệ thống bắt đầu lưu từ khi
          triển khai tính năng này; không suy diễn số liệu cho ngày chưa có dữ
          liệu.
        </div>
      )}
      {report && (
        <>
          <div className="personnel-kpis">
            {[
              {
                label: "Công việc đang mở",
                value: metrics.open,
                tone: "blue",
                icon: Clock3,
              },
              {
                label: "Hoàn thành trong ngày",
                value: metrics.done,
                tone: "green",
                icon: CheckCheck,
              },
              {
                label: "Công việc quá hạn",
                value: metrics.overdue,
                tone: "red",
                icon: TriangleAlert,
              },
              {
                label: "Đang vướng mắc",
                value: metrics.blocked,
                tone: "amber",
                icon: TriangleAlert,
              },
              {
                label: "Task tăng tiến độ",
                value: number(movement.improved),
                tone: "purple",
                icon: Clock3,
              },
            ].map((k) => (
              <div className={"personnel-kpi " + k.tone} key={k.label}>
                <k.icon size={20} />
                <strong>{report.source === "missing" ? "—" : k.value}</strong>
                <span>{k.label}</span>
              </div>
            ))}
          </div>
          {!!unassigned && (
            <div className="personnel-unassigned">
              {unassigned} công việc chưa được gán nhân sự trong phạm vi của
              bạn; chưa tính vào chỉ số từng người. Gán người phụ trách trong
              chi tiết dự án.
            </div>
          )}
          <nav className="personnel-tabs" aria-label="Chế độ xem nhân sự">
            {[
              ["overview", "Tổng quan đội ngũ"],
              ["tasks", "Theo dõi công việc"],
              ["reports", "Báo cáo ngày"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "overview" && (
            <>
              {!filtered.length && (
                <div className="info-box">
                  Không có nhân sự phù hợp với bộ lọc.
                </div>
              )}
              <div className="personnel-grid">
                {filtered.map((p) => {
                  const own = tasks.filter((t) => t.assigneeId === p.id),
                    m = personnelMetrics(own, day);
                  const risk = m.overdue
                    ? "red"
                    : m.blocked
                      ? "amber"
                      : "green";
                  return (
                    <article
                      className={"personnel-card risk-" + risk}
                      key={p.id}
                    >
                      <header>
                        <Avatar person={p} size={44} />
                        <div>
                          <h3>{p.name}</h3>
                          <small>
                            {roleLabels[p.role]} · {p.discipline}
                          </small>
                        </div>
                        {admin && (
                          <button
                            className="icon-button"
                            aria-label={"Sửa nhân sự " + p.name}
                            onClick={() => onEdit(p)}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                      </header>
                      <div className="personnel-org">
                        <span>{organizationName(p, "department")}</span>
                        <span>{organizationName(p, "team")}</span>
                      </div>
                      <div className="personnel-progress">
                        <span>Tiến độ có trọng số</span>
                        <b>
                          {number(
                            report.source === "missing" ? null : m.progress,
                            "%",
                          )}
                        </b>
                      </div>
                      <div className="personnel-progress-track">
                        <i style={{ width: (m.progress || 0) + "%" }} />
                      </div>
                      <div className="personnel-card-metrics">
                        <div>
                          <b>{report.source === "missing" ? "—" : m.open}</b>
                          <span>Đang mở</span>
                        </div>
                        <div className="green-text">
                          <b>{report.source === "missing" ? "—" : m.done}</b>
                          <span>Xong hôm nay</span>
                        </div>
                        <div className="red-text">
                          <b>{report.source === "missing" ? "—" : m.overdue}</b>
                          <span>Quá hạn</span>
                        </div>
                        <div className="amber-text">
                          <b>{report.source === "missing" ? "—" : m.blocked}</b>
                          <span>Vướng mắc</span>
                        </div>
                      </div>
                      <footer>
                        <span>
                          Đúng hạn: <b>{number(m.onTime, "%")}</b> (
                          {m.onTimeSample} việc)
                        </span>
                        <span>
                          Task tăng tiến độ:{" "}
                          <b>
                            {number(
                              taskMovement(
                                own,
                                previous,
                                !!report.previousAvailable,
                              ).improved,
                            )}
                          </b>
                        </span>
                      </footer>
                      <p className="personnel-card-note">
                        {m.estimated}h dự kiến còn mở · Năng lực {p.capacity}
                        h/tuần
                      </p>
                      <button
                        className="button small"
                        onClick={() => {
                          setMember(p.id);
                          setTab("tasks");
                        }}
                      >
                        Xem công việc
                      </button>
                    </article>
                  );
                })}
              </div>
              <p className="section-note">
                Tiến độ tính theo trọng số công việc được xác nhận; “—” khi chưa
                có trọng số. Đúng hạn chỉ tính việc hoàn thành trong ngày có đủ
                ngày hoàn thành và hạn bàn giao. Thay đổi tiến độ so với lần
                chụp cuối ngày trước; “—” khi thiếu dữ liệu đối chiếu. Giờ dự
                kiến lấy từ task, không phải giờ làm thực tế.
              </p>
            </>
          )}
          {tab === "tasks" && (
            <section className="panel personnel-table-panel">
              <div className="personnel-table-heading">
                <h3>Công việc theo nhân sự</h3>
                <label>
                  Trạng thái
                  <select
                    aria-label="Lọc trạng thái công việc"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="overdue">Quá hạn</option>
                    {Object.entries(taskLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="personnel-table-scroll">
                <table className="personnel-table">
                  <thead>
                    <tr>
                      <th>Công việc / dự án</th>
                      <th>Nhân sự</th>
                      <th>Trạng thái</th>
                      <th>Tiến độ xác nhận</th>
                      <th>Hạn</th>
                      <th>Giờ dự kiến</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taskFiltered.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.title}</strong>
                          {(admin || manager) && day === localDate() && (
                            <button
                              className="button small"
                              onClick={() => onEditTask(t)}
                            >
                              Cập nhật task
                            </button>
                          )}
                          <small>
                            {w.projects.find((p) => p.id === t.projectId)
                              ?.name || "Dự án"}
                          </small>
                          {t.blockReason && (
                            <small className="amber-text">
                              {t.blockReason}
                            </small>
                          )}
                        </td>
                        <td>
                          {w.people.find((p) => p.id === t.assigneeId)?.name ||
                            "Chưa gán"}
                        </td>
                        <td>
                          <span className={"personnel-status " + t.status}>
                            {taskLabels[t.status]}
                          </span>
                          {isOverdue(t, day) && (
                            <span className="personnel-status overdue">
                              Quá hạn
                            </span>
                          )}
                        </td>
                        <td>{t.progress}%</td>
                        <td>{t.due || "Chưa có hạn"}</td>
                        <td>{t.hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!taskFiltered.length && (
                <div className="info-box">Không có công việc phù hợp.</div>
              )}
            </section>
          )}
          {tab === "reports" && (
            <section className="panel personnel-table-panel">
              <h3>Báo cáo tự động từ task · {day}</h3>
              <p className="section-note">
                Tổng hợp theo bộ lọc phòng ban, team và nhân sự. Tiến độ lấy từ
                task được xác nhận; số việc hoàn thành và đúng hạn dựa trên ngày
                hoàn thành quan sát được.
              </p>
              {!report.previousAvailable && (
                <div className="info-box">
                  Chưa có dữ liệu ngày {report.previousDay} để so sánh. Các chỉ
                  số thay đổi được để “—”.
                </div>
              )}
              <div className="personnel-table-scroll">
                <table className="personnel-table">
                  <thead>
                    <tr>
                      <th>Nhân sự / team</th>
                      <th>Đang mở</th>
                      <th>Xong trong ngày</th>
                      <th>Tiến độ</th>
                      <th>Task tăng tiến độ</th>
                      <th>Đổi trạng thái</th>
                      <th>Đúng hạn</th>
                      <th>Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const own = tasks.filter((t) => t.assigneeId === p.id),
                        m = personnelMetrics(own, day),
                        delta = taskMovement(
                          own,
                          previous,
                          report.previousAvailable,
                        );
                      const label =
                        report.source === "missing"
                          ? "Chưa có lịch sử"
                          : m.overdue
                            ? `${m.overdue} task quá hạn`
                            : m.blocked
                              ? `${m.blocked} task vướng mắc`
                              : m.open
                                ? "Đang triển khai"
                                : "Không có task đang mở";
                      const tone = m.overdue
                        ? "overdue"
                        : m.blocked
                          ? "blocked"
                          : "done";
                      const show = (n: number | null, suffix = "") =>
                        report.source === "missing" ? "—" : number(n, suffix);
                      return (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.name}</strong>
                            <small>
                              {organizationName(p, "department")} ·{" "}
                              {organizationName(p, "team")}
                            </small>
                          </td>
                          <td>{show(m.open)}</td>
                          <td>{show(m.done)}</td>
                          <td>{show(m.progress, "%")}</td>
                          <td>{show(delta.improved)}</td>
                          <td>{show(delta.changed)}</td>
                          <td>
                            {show(m.onTime, "%")}
                            <small>{m.onTimeSample} việc đủ dữ liệu</small>
                          </td>
                          <td>
                            <span className={"personnel-status " + tone}>
                              {label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!filtered.length && (
                <div className="info-box">Không có nhân sự phù hợp.</div>
              )}
              <h3 className="personnel-priority-heading">
                Task cần ưu tiên xử lý
              </h3>
              <div className="personnel-table-scroll">
                <table className="personnel-table">
                  <thead>
                    <tr>
                      <th>Công việc</th>
                      <th>Nhân sự</th>
                      <th>Vấn đề</th>
                      <th>Hạn</th>
                      <th>Vướng mắc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks
                      .filter(
                        (t) =>
                          !t.archived &&
                          (isOverdue(t, day) || t.status === "blocked"),
                      )
                      .sort((a, b) =>
                        (a.due || "9999").localeCompare(b.due || "9999"),
                      )
                      .map((t) => (
                        <tr key={t.id}>
                          <td>
                            {t.title}
                            <small>
                              {
                                w.projects.find((p) => p.id === t.projectId)
                                  ?.name
                              }
                            </small>
                          </td>
                          <td>
                            {w.people.find((p) => p.id === t.assigneeId)?.name}
                          </td>
                          <td>
                            {isOverdue(t, day) && (
                              <span className="personnel-status overdue">
                                Quá hạn
                              </span>
                            )}
                            {t.status === "blocked" && (
                              <span className="personnel-status blocked">
                                Vướng mắc
                              </span>
                            )}
                          </td>
                          <td>{t.due || "Chưa có hạn"}</td>
                          <td>
                            {t.blockReason || "Chưa ghi nhận nguyên nhân"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!tasks.some(
                (t) =>
                  !t.archived && (isOverdue(t, day) || t.status === "blocked"),
              ) &&
                report.source !== "missing" && (
                  <div className="info-box">
                    Không có task quá hạn hoặc vướng mắc trong bộ lọc.
                  </div>
                )}
              <p className="section-note">
                Báo cáo phản ánh dữ liệu task tại thời điểm đồng bộ. Không quy
                đổi tiến độ thành giờ làm thực tế hoặc điểm đánh giá nhân sự.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
