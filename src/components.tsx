import React, { useEffect, useRef } from "react";
import { X, ArrowUpRight, Check, ChevronDown } from "lucide-react";
import { healthLabels, money } from "../shared/metrics";
import type { Person } from "../shared/types";
export function Avatar({
  person,
  size = 32,
}: {
  person?: Person;
  size?: number;
}) {
  const colors = ["#dce9de", "#e9e2d7", "#dce4ed", "#e9dfe5"];
  const i = person ? person.name.length % 4 : 0;
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: colors[i],
        fontSize: size * 0.32,
      }}
      title={person?.name || "Chưa giao"}
    >
      {person
        ? person.name
            .split(" ")
            .slice(-2)
            .map((s) => s[0])
            .join("")
        : "—"}
    </span>
  );
}
export function Badge({ status }: { status: keyof typeof healthLabels }) {
  return (
    <span className={"badge " + status}>
      <i />
      {healthLabels[status]}
    </span>
  );
}
export function Progress({ value, color }: { value: number; color?: string }) {
  return (
    <div className="progress-track">
      <span
        style={{
          width: Math.max(0, Math.min(100, value)) + "%",
          background: color,
        }}
      />
    </div>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">↗</div>
      <strong>{title}</strong>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    const root = ref.current;
    root?.querySelector<HTMLElement>("input,select,button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && root) {
        const els = [
          ...root.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],textarea:not(:disabled),[tabindex="0"]',
          ),
        ].filter((el) => el.offsetParent !== null);
        if (!els.length) return;
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" aria-label="Đóng" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Kpi({
  label,
  value,
  note,
  icon,
  dark = false,
}: {
  label: string;
  value: string;
  note: React.ReactNode;
  icon: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div className={"kpi " + (dark ? "dark" : "")}>
      <div className="kpi-top">
        <span>{label}</span>
        <span className="kpi-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <div className="kpi-note">{note}</div>
    </div>
  );
}
export function Amount({ value }: { value: number }) {
  return <span className="amount">{money(value)}</span>;
}
export function Submit({
  busy,
  label = "Lưu thay đổi",
}: {
  busy: boolean;
  label?: string;
}) {
  return (
    <button className="button primary" type="submit" disabled={busy}>
      {busy ? <span className="spinner" /> : <Check size={16} />}{" "}
      {busy ? "Đang lưu…" : label}
    </button>
  );
}
