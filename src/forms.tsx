import { useState } from "react";
import type { Workspace, Project, Task } from "../shared/types";
import { localDate } from "../shared/metrics";
import { Field, Submit } from "./components";
export type FormKind =
  "project" | "receipt" | "document" | "member" | "term" | "task";
export default function EntryForm({
  kind,
  w,
  initial,
  projectId,
  onSave,
  onClose,
}: {
  kind: FormKind;
  w: Workspace;
  initial?: Project | Task;
  projectId?: string;
  onSave: (
    kind: FormKind,
    data: Record<string, unknown>,
    id?: string,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(projectId || w.projects[0]?.id || "");
  const p = kind === "project" ? (initial as Project) : undefined,
    t = kind === "task" ? (initial as Task) : undefined;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const numeric = [
      "contract",
      "accepted",
      "amount",
      "capacity",
      "weight",
      "progress",
      "hours",
    ];
    const payload: Record<string, unknown> = { ...data };
    for (const k of numeric) if (k in payload) payload[k] = Number(payload[k]);
    if (!payload.termId) delete payload.termId;
    try {
      await onSave(kind, payload, initial?.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu.");
    } finally {
      setBusy(false);
    }
  }
  const projects = (
    <Field label="Dự án">
      <select
        name="projectId"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        required
      >
        <option value="" disabled>
          Chọn dự án
        </option>
        {w.projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} · {p.name}
          </option>
        ))}
      </select>
    </Field>
  );
  return (
    <form className="entry-form" onSubmit={submit}>
      {kind === "project" && (
        <>
          <div className="form-grid">
            <Field label="Mã dự án">
              <input
                name="code"
                defaultValue={p?.code}
                placeholder="DA-027"
                required
              />
            </Field>
            <Field label="Địa điểm">
              <input
                name="location"
                defaultValue={p?.location}
                placeholder="Tuyên Quang"
              />
            </Field>
          </div>
          <Field label="Tên dự án">
            <input
              name="name"
              defaultValue={p?.name}
              placeholder="Tên công trình / gói tư vấn"
              required
            />
          </Field>
          <Field label="Chủ đầu tư">
            <input
              name="client"
              defaultValue={p?.client}
              placeholder="Tên chủ đầu tư hoặc Ban QLDA"
              required
            />
          </Field>
          <div className="form-grid">
            <Field label="Chủ nhiệm">
              <select name="managerId" defaultValue={p?.managerId} required>
                {w.people
                  .filter((x) => ["admin", "manager"].includes(x.role))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Trạng thái">
              <select name="status" defaultValue={p?.status || "active"}>
                <option value="active">Đang triển khai</option>
                <option value="paused">Tạm dừng</option>
                <option value="completed">Hoàn thành</option>
              </select>
            </Field>
            <Field label="Giá trị hợp đồng (VND)">
              <input
                name="contract"
                type="number"
                min="0"
                step="1"
                defaultValue={p?.contract || 0}
                required
              />
            </Field>
            <Field label="Giá trị đã nghiệm thu (VND)">
              <input
                name="accepted"
                type="number"
                min="0"
                step="1"
                defaultValue={p?.accepted || 0}
                required
              />
            </Field>
            <Field label="Ngày bắt đầu">
              <input
                name="start"
                type="date"
                defaultValue={p?.start || localDate()}
                required
              />
            </Field>
            <Field label="Hạn bàn giao">
              <input name="due" type="date" defaultValue={p?.due} required />
            </Field>
          </div>
          <Field label="Giai đoạn hiện tại">
            <input
              name="phase"
              defaultValue={p?.phase || "Thu thập đầu vào"}
              required
            />
          </Field>
          <div className="form-grid">
            <Field
              label="Trello Board ID"
              hint="Mã bảng Trello. Ánh xạ các cột tại Kết nối trước khi đồng bộ."
            >
              <input
                name="boardId"
                defaultValue={p?.boardId}
                placeholder="Ví dụ: 64a…"
              />
            </Field>
            <Field
              label="Google Drive Folder ID"
              hint="Phần mã sau /folders/ trong liên kết thư mục."
            >
              <input
                name="driveFolderId"
                defaultValue={p?.driveFolderId}
                placeholder="Mã thư mục hồ sơ"
              />
            </Field>
          </div>
        </>
      )}
      {kind === "receipt" && (
        <>
          {projects}
          <div className="form-grid">
            <Field label="Số tiền đã nhận (VND)">
              <input
                name="amount"
                type="number"
                min="1"
                step="1"
                required
                autoFocus
              />
            </Field>
            <Field label="Ngày nhận">
              <input
                name="date"
                type="date"
                defaultValue={localDate()}
                required
              />
            </Field>
          </div>
          <Field label="Mã chứng từ / giao dịch">
            <input
              name="reference"
              placeholder="PT-009 hoặc mã giao dịch ngân hàng"
              required
            />
          </Field>
          <Field label="Phân bổ vào đợt thanh toán">
            <select name="termId" key={selected}>
              <option value="">Chưa phân bổ / tạm ứng</option>
              {w.terms
                .filter(
                  (t) => t.projectId === selected && t.received < t.amount,
                )
                .map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.title} · còn{" "}
                    {(t.amount - t.received).toLocaleString("vi-VN")} ₫
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Ghi chú">
            <textarea name="note" placeholder="Nội dung thanh toán" />
          </Field>
        </>
      )}
      {kind === "term" && (
        <>
          {projects}
          <Field label="Tên đợt thanh toán">
            <input
              name="title"
              placeholder="Thanh toán hồ sơ thiết kế đợt 1"
              required
            />
          </Field>
          <div className="form-grid">
            <Field label="Số tiền phải thu (VND)">
              <input name="amount" type="number" min="1" step="1" required />
            </Field>
            <Field label="Ngày đến hạn">
              <input name="due" type="date" required />
            </Field>
          </div>
          <p className="form-note">
            Nhập số tiền thực tế phải thu sau khi đối chiếu tạm ứng, thu hồi và
            khoản giữ lại theo hợp đồng.
          </p>
        </>
      )}
      {kind === "document" && (
        <>
          {projects}
          <Field label="Tên hồ sơ">
            <input
              name="name"
              placeholder="DA-026_Ban-ve-kien-truc_V03.pdf"
              required
            />
          </Field>
          <Field label="Liên kết Google Drive">
            <input
              name="url"
              type="url"
              placeholder="https://drive.google.com/file/d/…/view"
              required
            />
          </Field>
          <div className="form-grid">
            <Field label="Nhóm hồ sơ">
              <select name="category">
                {[
                  "Thiết kế",
                  "Khảo sát",
                  "Dự toán",
                  "Pháp lý",
                  "Hợp đồng",
                  "Thẩm tra",
                  "Nghiệm thu",
                  "Thanh toán",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Phiên bản">
              <input name="version" defaultValue="V01" required />
            </Field>
          </div>
          <Field label="Trạng thái">
            <select name="status">
              {["Bản nháp", "Đang kiểm tra", "Phát hành", "Đã ký"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <p className="form-note">
            Tệp gốc nằm trên Drive. Người mở phải có quyền truy cập tài liệu.
          </p>
        </>
      )}
      {kind === "member" && (
        <>
          <Field label="Họ và tên">
            <input name="name" required />
          </Field>
          <Field label="Email đăng nhập">
            <input name="email" type="email" required />
          </Field>
          <div className="form-grid">
            <Field label="Vai trò">
              <select name="role">
                <option value="staff">Nhân viên</option>
                <option value="manager">Chủ nhiệm</option>
                <option value="finance">Kế toán</option>
                <option value="admin">Giám đốc</option>
              </select>
            </Field>
            <Field label="Chuyên môn">
              <input
                name="discipline"
                placeholder="Kiến trúc, kết cấu…"
                required
              />
            </Field>
          </div>
          <Field label="Năng lực làm việc (giờ/tuần)">
            <input
              name="capacity"
              type="number"
              min="1"
              max="100"
              defaultValue="40"
              required
            />
          </Field>
          <Field
            label="Trello Member ID"
            hint="Dùng để đối chiếu người được giao thẻ Trello."
          >
            <input name="trelloId" placeholder="Mã thành viên 24 ký tự" />
          </Field>
        </>
      )}
      {kind === "task" && t && (
        <>
          <p className="form-note">
            Trạng thái và hạn công việc lấy từ Trello. Chủ nhiệm xác nhận khối
            lượng để tính tiến độ.
          </p>
          <div className="form-grid">
            <Field label="Trọng số">
              <input
                name="weight"
                type="number"
                min="0"
                max="1000"
                step="0.1"
                defaultValue={t.weight}
                required
              />
            </Field>
            <Field label="Hoàn thành được xác nhận (%)">
              <input
                name="progress"
                type="number"
                min="0"
                max="100"
                defaultValue={t.progress}
                required
              />
            </Field>
            <Field label="Khối lượng dự kiến (giờ)">
              <input
                name="hours"
                type="number"
                min="0"
                max="10000"
                step="0.5"
                defaultValue={t.hours}
                required
              />
            </Field>
            <Field label="Người phụ trách">
              <select name="assigneeId" defaultValue={t.assigneeId}>
                <option value="">Chưa giao</option>
                {w.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Vướng mắc / nguyên nhân">
            <textarea name="blockReason" defaultValue={t.blockReason} />
          </Field>
        </>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        <button type="button" className="button" onClick={onClose}>
          Hủy
        </button>
        <Submit
          busy={busy}
          label={
            kind === "receipt"
              ? "Ghi nhận thanh toán"
              : kind === "project" && !p
                ? "Tạo dự án"
                : "Lưu thông tin"
          }
        />
      </div>
    </form>
  );
}
