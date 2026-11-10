import { ThemeSwitch } from "./theme";
import { UiButton, UiInput, UiTextArea } from "./ui";
import { useEffect, useState, type FormEvent } from "react";
import { Building2 } from "lucide-react";
import { request } from "./api";
import type { Person } from "../shared/types";
export function Login() {
  const [status, setStatus] = useState<{
    setupRequired: boolean;
    setupEnabled: boolean;
  } | null>(null);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [token, setToken] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    request<typeof status>("/auth/status")
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await request(
        status?.setupRequired ? "/auth/setup" : "/auth/login",
        "POST",
        {
          email,
          password,
          ...(status?.setupRequired ? { name, setupToken: token } : {}),
        },
      );
      setPassword("");
      setToken("");
      location.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-theme-switch">
          <ThemeSwitch />
        </div>
        <Building2 size={36} />
        <h1>Công Trình</h1>
        <h2>
          {status?.setupRequired ? "Tạo tài khoản quản trị" : "Đăng nhập"}
        </h2>
        <p>
          {status?.setupRequired
            ? "Khởi tạo một lần bằng email quản trị và mã do chủ hệ thống cấu hình."
            : "Dùng email và mật khẩu được quản trị viên cấp."}
        </p>
        {!status && !error && <p>Đang kiểm tra tài khoản…</p>}
        {status?.setupRequired && !status.setupEnabled && (
          <div className="info-box">
            Chủ hệ thống cần thêm ADMIN_EMAIL và secret ADMIN_SETUP_TOKEN có ít
            nhất 24 ký tự trong Cloudflare, rồi tải lại trang này.
          </div>
        )}
        <form onSubmit={submit}>
          {status?.setupRequired && (
            <label>
              Họ tên
              <UiInput
                autoComplete="name"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label>
            Email
            <UiInput
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Mật khẩu
            <UiInput
              type="password"
              autoComplete={
                status?.setupRequired ? "new-password" : "current-password"
              }
              required
              minLength={status?.setupRequired ? 12 : 1}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {status?.setupRequired && (
            <label>
              Mã khởi tạo
              <UiInput
                type="password"
                autoComplete="off"
                required
                maxLength={256}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <UiButton
            className="button primary"
            disabled={
              busy || !status || (status.setupRequired && !status.setupEnabled)
            }
          >
            {busy
              ? "Đang xử lý…"
              : status?.setupRequired
                ? "Tạo quản trị và đăng nhập"
                : "Đăng nhập"}
          </UiButton>
        </form>
        <a className="button" href="/?demo=1">
          Khám phá bản demo
        </a>
        <small>Quên mật khẩu? Liên hệ quản trị viên để được cấp lại.</small>
        {!!error && !status && (
          <UiButton className="button" onClick={() => location.reload()}>
            Thử lại
          </UiButton>
        )}
      </section>
    </main>
  );
}
export function AccountSettings({
  people,
  user,
}: {
  people: Person[];
  user: Person;
}) {
  const [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [member, setMember] = useState(""),
    [memberPassword, setMemberPassword] = useState("");
  const [accounts, setAccounts] = useState<{ id: string; enabled: number }[]>(
      [],
    ),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user.role === "admin")
      request<typeof accounts>("/auth/accounts")
        .then(setAccounts)
        .catch((e) => setError(e.message));
  }, [people, user.role]);
  async function save(e: FormEvent, other = false) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(
        other
          ? `/auth/accounts/${encodeURIComponent(member)}/password`
          : "/auth/password",
        "PUT",
        other
          ? { password: memberPassword }
          : { currentPassword: current, password },
      );
      setCurrent("");
      setPassword("");
      setMemberPassword("");
      if (other) setAccounts(await request("/auth/accounts"));
      setMessage(
        other
          ? "Đã cấp mật khẩu. Gửi riêng cho nhân sự; các phiên đăng nhập cũ đã bị thu hồi."
          : "Đã đổi mật khẩu. Các phiên trên thiết bị khác đã bị thu hồi.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-card account-settings">
      <h2>Tài khoản & mật khẩu</h2>
      <form onSubmit={(e) => save(e)}>
        <h3>Đổi mật khẩu của bạn</h3>
        <label>
          Mật khẩu hiện tại
          <UiInput
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label>
          Mật khẩu mới (ít nhất 12 ký tự)
          <UiInput
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <UiButton className="button" disabled={busy}>
          Đổi mật khẩu
        </UiButton>
      </form>
      {user.role === "admin" && (
        <form onSubmit={(e) => save(e, true)}>
          <h3>Cấp / đặt lại mật khẩu cho nhân sự</h3>
          <p>
            Thêm nhân sự trong mục Nhân sự trước, sau đó cấp mật khẩu tại đây.
          </p>
          <label>
            Nhân sự
            <select
              aria-label="Nhân sự"
              required
              value={member}
              onChange={(e) => setMember(e.target.value)}
            >
              <option value="">Chọn nhân sự</option>
              {people
                .filter((p) => p.id !== user.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.email} (
                    {accounts.find((a) => a.id === p.id)?.enabled
                      ? "Đã có tài khoản"
                      : "Chưa cấp mật khẩu"}
                    )
                  </option>
                ))}
            </select>
          </label>
          <label>
            Mật khẩu cấp cho nhân sự
            <UiInput
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={memberPassword}
              onChange={(e) => setMemberPassword(e.target.value)}
            />
          </label>
          <UiButton className="button" disabled={busy || !member}>
            Cấp mật khẩu
          </UiButton>
        </form>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="info-box" role="status">
          {message}
        </div>
      )}
    </section>
  );
}
