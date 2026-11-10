import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  RefreshCw,
  RotateCcw,
  Plus,
  Minus,
  Search,
  Layers,
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Workspace, Session, Task } from "../shared/types";
import { taskLabels } from "../shared/types";
import {
  officePeople,
  officePerson,
  officeRooms,
  officeStates,
  type OfficeState,
} from "../shared/office";
import { Avatar } from "./components";
import { request } from "./api";
import type { createOfficeScene } from "./office-scene";
export default function VirtualOffice({
  w,
  session,
  onRefresh,
  onEditTask,
}: {
  w: Workspace;
  session: Session;
  onRefresh: () => Promise<void>;
  onEditTask: (t: Task) => void;
}) {
  const [department, setDepartment] = useState("all"),
    [team, setTeam] = useState("all"),
    [search, setSearch] = useState(""),
    [state, setState] = useState("all"),
    [selected, setSelected] = useState(""),
    [page, setPage] = useState(0);
  const [sceneError, setSceneError] = useState(""),
    [loadingScene, setLoadingScene] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [updated, setUpdated] = useState<Date | null>(null),
    [poll, setPoll] = useState(true),
    [autoTrello, setAutoTrello] = useState(true),
    [activities, setActivities] = useState(true);
  const activitiesRef = useRef(activities);
  activitiesRef.current = activities;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<ReturnType<typeof createOfficeScene> | null>(null),
    running = useRef(false),
    alive = useRef(true);
  const latest = useRef({ onRefresh, session, w });
  latest.current = { onRefresh, session, w };
  const people = useMemo(
    () => officePeople(w, session.user).map((p) => officePerson(p, w.tasks)),
    [w, session.user],
  );
  const departments = [
    ...new Set(
      people.map((p) => p.person.department?.trim() || "Chưa phân phòng"),
    ),
  ].sort();
  const teams = [
    ...new Set(
      people
        .filter(
          (p) =>
            department === "all" ||
            (p.person.department?.trim() || "Chưa phân phòng") === department,
        )
        .map((p) => p.person.team?.trim() || "Chưa phân team"),
    ),
  ].sort();
  const filtered = useMemo(
    () =>
      people.filter(
        (p) =>
          (department === "all" ||
            (p.person.department?.trim() || "Chưa phân phòng") ===
              department) &&
          (team === "all" ||
            (p.person.team?.trim() || "Chưa phân team") === team) &&
          (state === "all" || p.state === state) &&
          [p.person.name, p.person.discipline, p.person.team]
            .join(" ")
            .toLocaleLowerCase("vi")
            .includes(search.toLocaleLowerCase("vi")),
      ),
    [people, department, team, state, search],
  );
  const allRooms = useMemo(() => officeRooms(filtered), [filtered]);
  const pages = Math.max(1, Math.ceil(allRooms.length / 4)),
    currentPage = Math.min(page, pages - 1);
  const rooms = useMemo(
    () => allRooms.slice(currentPage * 4, currentPage * 4 + 4),
    [allRooms, currentPage],
  );
  const shown = rooms.flatMap((r) => r.people),
    person = filtered.find((p) => p.person.id === selected) || null;
  useEffect(() => {
    setPage(0);
  }, [department, team, state, search]);
  const sceneKey = JSON.stringify(
    rooms.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      people: r.people.map((p) => [
        p.person.id,
        p.person.name,
        p.state,
        p.open,
        p.overdue,
      ]),
    })),
  );
  useEffect(() => {
    let cancelled = false;
    setLoadingScene(true);
    setSceneError("");
    if (!rooms.length) {
      setLoadingScene(false);
      return;
    }
    import("./office-scene")
      .then(({ createOfficeScene }) => {
        if (cancelled || !host.current) return;
        try {
          scene.current = createOfficeScene(
            host.current,
            rooms,
            setSelected,
            setSceneError,
          );
          scene.current.setActivities(activitiesRef.current);
          if (selectedRef.current) scene.current.focus(selectedRef.current);
          setLoadingScene(false);
        } catch {
          setSceneError(
            "Thiết bị này chưa mở được WebGL. Danh sách nhân sự và task bên cạnh vẫn dùng được.",
          );
          setLoadingScene(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSceneError(
            "Chưa tải được cảnh 3D. Kiểm tra mạng và mở lại màn hình.",
          );
          setLoadingScene(false);
        }
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [sceneKey]);
  useEffect(() => {
    if (selected) scene.current?.focus(selected);
  }, [selected]);
  useEffect(() => {
    scene.current?.setActivities(activities);
  }, [activities]);
  async function update(sync = false) {
    if (running.current || document.hidden) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const current = latest.current;
      if (sync && current.session.mode === "live")
        await request("/trello/sync", "POST", {});
      if (current.session.mode === "live") await current.onRefresh();
      if (alive.current) setUpdated(new Date());
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const updateRef = useRef(update);
  updateRef.current = update;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const canSync =
    session.mode === "live" &&
    session.user.role === "admin" &&
    session.integrations.trello;
  const lastTrelloAttempt = useRef(Date.now());
  useEffect(() => {
    if (!poll || session.mode !== "live") return;
    const tick = () => {
      if (document.hidden || running.current) return;
      const sync =
        autoTrello &&
        canSync &&
        Date.now() - lastTrelloAttempt.current >= 60000;
      if (sync) lastTrelloAttempt.current = Date.now();
      void updateRef.current(sync);
    };
    const id = setInterval(tick, 30000);
    const visible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [poll, session.mode, autoTrello, canSync]);
  const open = filtered.reduce((s, p) => s + p.open, 0),
    overdue = filtered.reduce((s, p) => s + p.overdue, 0),
    blocked = filtered.reduce((s, p) => s + p.blocked, 0);
  return (
    <div className="virtual-office">
      <section className="office-intro">
        <div>
          <span className="eyebrow">CÔNG TRÌNH / VĂN PHÒNG SỐ</span>
          <h2>Một văn phòng. Cùng nhịp công việc.</h2>
          <p>
            Gặp đội ngũ tại từng phòng ban, chọn một nhân vật để theo dõi công
            việc được giao.
          </p>
        </div>
        <div className="office-source">
          <i className={session.mode === "live" && poll ? "pulse" : ""} />
          <b>
            {session.mode === "demo"
              ? "Văn phòng minh họa"
              : poll
                ? "Đang cập nhật dữ liệu"
                : "Đã tạm dừng cập nhật"}
          </b>
          <small>
            {updated
              ? "Dashboard cập nhật " +
                updated.toLocaleTimeString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                })
              : "Dùng dữ liệu theo quyền truy cập hiện tại"}
          </small>
        </div>
      </section>
      <div className="office-stat-strip">
        <span>
          <b>{filtered.length}</b> nhân sự
        </span>
        <span>
          <b>{allRooms.length}</b> khu làm việc
        </span>
        <span className="office-blue">
          <b>{open}</b> task đang mở
        </span>
        <span className="office-red">
          <b>{overdue}</b> quá hạn
        </span>
        <span className="office-amber">
          <b>{blocked}</b> vướng mắc
        </span>
      </div>
      <section className="office-toolbar panel">
        <label>
          Phòng ban
          <select
            aria-label="Phòng ban văn phòng"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setTeam("all");
            }}
          >
            <option value="all">Tất cả phòng ban</option>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Team
          <select
            aria-label="Team văn phòng"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          >
            <option value="all">Tất cả team</option>
            {teams.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Tình trạng task
          <select
            aria-label="Tình trạng văn phòng"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="all">Tất cả tình trạng</option>
            {Object.entries(officeStates).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tìm nhân sự
          <input
            aria-label="Tìm nhân sự văn phòng"
            placeholder="Tên hoặc chuyên môn…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          className="button"
          disabled={busy}
          onClick={() => void update(false)}
        >
          <RefreshCw size={15} />
          {busy ? "Đang cập nhật…" : "Cập nhật dữ liệu"}
        </button>
        <button
          className="button"
          aria-pressed={activities}
          onClick={() => setActivities((v) => !v)}
        >
          <Layers size={15} />
          {activities ? "Ẩn nhân viên ảo" : "Hiện nhân viên ảo"}
        </button>
        {session.mode === "live" && (
          <button className="button" onClick={() => setPoll(!poll)}>
            {poll ? <Pause size={15} /> : <Play size={15} />}{" "}
            {poll ? "Tạm dừng" : "Tiếp tục"}
          </button>
        )}
      </section>
      {error && (
        <div className="form-error" role="alert">
          {error} Dữ liệu trước đó vẫn được giữ; thời gian cập nhật không thay
          đổi.
        </div>
      )}
      <div className="office-layout">
        <section className="office-stage panel">
          <header>
            <span>
              <Building2 size={16} />
              Sơ đồ văn phòng 3D
            </span>
            <div>
              <button
                className="icon-button"
                aria-label="Thu nhỏ văn phòng"
                onClick={() => scene.current?.zoom(1.2)}
              >
                <Minus size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Phóng to văn phòng"
                onClick={() => scene.current?.zoom(0.83)}
              >
                <Plus size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Đặt lại góc nhìn"
                onClick={() => scene.current?.reset()}
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </header>
          <div
            className="office-webgl"
            ref={host}
            data-testid="office-canvas"
          />
          {loadingScene && (
            <div className="office-stage-message" role="status">
              Đang dựng văn phòng chibi…
            </div>
          )}
          {sceneError && (
            <div className="office-stage-message" role="status">
              {sceneError}
            </div>
          )}
          {!rooms.length && (
            <div className="office-stage-message">
              Không có nhân sự phù hợp. Thử đổi bộ lọc hoặc phân phòng ban tại
              mục Nhân sự.
            </div>
          )}
          <div className="office-scene-hint">
            Kéo để xoay · Cuộn/chụm để phóng to · Bấm nhân vật để phóng gần và
            xem task
          </div>
          <footer>
            <span>
              Hiển thị {shown.length}/{filtered.length} nhân sự · Khu{" "}
              {currentPage + 1}/{pages}
            </span>
            <div>
              <button
                className="button small"
                disabled={!currentPage}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={15} />
                Trước
              </button>
              <button
                className="button small"
                disabled={currentPage >= pages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Tiếp
                <ChevronRight size={15} />
              </button>
            </div>
          </footer>
        </section>
        <aside className="office-inspector panel">
          <header>
            <span className="eyebrow">NHÂN SỰ & CÔNG VIỆC</span>
            <h3>{person ? person.person.name : "Chọn một đồng nghiệp"}</h3>
            <p>
              {person
                ? (person.person.department || "Chưa phân phòng") +
                  " · " +
                  (person.person.team || "Chưa phân team")
                : "Bấm nhân vật trong phòng hoặc chọn từ danh sách phía dưới."}
            </p>
          </header>
          {person && (
            <>
              <div className="office-person-summary">
                <Avatar person={person.person} size={42} />
                <div>
                  <span
                    className="office-status"
                    style={{
                      background: officeStates[person.state].color + "20",
                      color: officeStates[person.state].color,
                    }}
                  >
                    {officeStates[person.state].label}
                  </span>
                  <small>
                    {person.progress === null
                      ? "Chưa có trọng số"
                      : person.progress + "% tiến độ có trọng số"}{" "}
                    · {person.open} task mở
                  </small>
                </div>
              </div>
              <div className="office-task-list">
                {person.tasks
                  .filter((t) => !t.archived)
                  .sort((a, b) => {
                    const rank = (t: Task) =>
                      t.status === "blocked" ? 0 : t.status === "done" ? 3 : 1;
                    return (
                      rank(a) - rank(b) ||
                      (a.due || "9999").localeCompare(b.due || "9999")
                    );
                  })
                  .map((t) => (
                    <article key={t.id}>
                      <div>
                        <strong>{t.title}</strong>
                        <span className={"personnel-status " + t.status}>
                          {taskLabels[t.status]}
                        </span>
                      </div>
                      <small>
                        {w.projects.find((p) => p.id === t.projectId)?.name ||
                          "Dự án"}{" "}
                        · Hạn: {t.due || "Chưa có"}
                      </small>
                      <div className="office-task-progress">
                        <i style={{ width: t.progress + "%" }} />
                      </div>
                      <small>
                        {t.progress}% xác nhận · {t.hours}h dự kiến
                      </small>
                      {t.blockReason && <p>{t.blockReason}</p>}
                      {["admin", "manager"].includes(session.user.role) && (
                        <button
                          className="button small"
                          onClick={() => onEditTask(t)}
                        >
                          Cập nhật task
                        </button>
                      )}
                    </article>
                  ))}
                {!person.tasks.some((t) => !t.archived) && (
                  <div className="info-box">
                    Nhân sự này chưa có task hiện hành trong phạm vi dữ liệu của
                    bạn.
                  </div>
                )}
              </div>
            </>
          )}
          <div
            className="office-directory"
            aria-label="Danh sách nhân sự văn phòng"
          >
            {rooms.map((r) => (
              <div key={r.id}>
                <h4>
                  <i style={{ background: r.color }} />
                  {r.name}
                  {r.part > 1 ? " · Khu " + r.part : ""}
                </h4>
                {r.people.map((p) => (
                  <button
                    key={p.person.id}
                    className={selected === p.person.id ? "selected" : ""}
                    onClick={() => setSelected(p.person.id)}
                    aria-label={"Xem công việc " + p.person.name}
                  >
                    <Avatar person={p.person} size={30} />
                    <span>
                      <b>{p.person.name}</b>
                      <small>
                        {p.person.team || p.person.discipline} · {p.open} task
                        mở
                      </small>
                    </span>
                    <i style={{ background: officeStates[p.state].color }} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>
      </div>
      <div className="office-legend">
        <span>
          <i style={{ background: "#c8aa70" }} />
          NPC · Nhân viên ảo đi lại / cà phê
        </span>
        {Object.values(officeStates).map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <section className="office-data-note">
        <p>
          Nhân vật và chuyển động minh họa tình trạng task, không phải dữ liệu
          chấm công hay xác nhận đang online. Nhân sự chưa phân phòng được xếp
          vào khu riêng. Các NPC có nhãn “Nhân viên ảo” chỉ tạo hoạt cảnh, không
          nằm trong thống kê nhân sự; nhân vật gắn với dữ liệu thật luôn ngồi
          tại bàn.
        </p>
        {session.mode === "live" ? (
          <>
            <p>
              Dashboard tự tải lại mỗi 30 giây khi mở màn hình. Trello đồng bộ
              nền mỗi 15 phút theo lịch hiện có.
            </p>
            {canSync && (
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={autoTrello}
                    onChange={(e) => setAutoTrello(e.target.checked)}
                  />
                  Đồng bộ Trello mỗi phút khi mở văn phòng
                </label>
                <button
                  className="button small"
                  disabled={busy}
                  onClick={() => void update(true)}
                >
                  Đồng bộ Trello ngay
                </button>
              </div>
            )}
            <small>
              Nguồn Trello cập nhật gần nhất:{" "}
              {w.settings.lastSync
                ? new Date(w.settings.lastSync).toLocaleString("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                  })
                : "Chưa đồng bộ"}
              . {w.settings.syncError && "Lỗi nguồn: " + w.settings.syncError}
            </small>
          </>
        ) : (
          <p>
            Bản demo minh họa cùng luồng công việc, không kết nối tài khoản dịch
            vụ thật.
          </p>
        )}
      </section>
    </div>
  );
}
