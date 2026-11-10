import {
  Modal as GravityModal,
  Label as GravityLabel,
  Progress as GravityProgress,
  Card,
  Text,
} from "@gravity-ui/uikit";
import { UiButton } from "./ui";
import React from "react";
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
  const theme =
    status === "ontrack" || status === "completed"
      ? "success"
      : status === "late"
        ? "danger"
        : status === "risk"
          ? "warning"
          : "normal";
  return (
    <GravityLabel theme={theme} size="s">
      {healthLabels[status]}
    </GravityLabel>
  );
}
export function Progress({ value, color }: { value: number; color?: string }) {
  return (
    <GravityProgress
      className="app-progress"
      value={Math.max(0, Math.min(100, value))}
      size="s"
      colorStops={[
        {
          stop: 0,
          theme: "default",
          color: color || "var(--g-color-base-brand)",
        },
      ]}
    />
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
  return (
    <GravityModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      aria-label={title}
      contentClassName={"modal " + (wide ? "wide" : "")}
      disableVisuallyHiddenDismiss
    >
      <div className="modal-head">
        <div>
          <Text as="h2" variant="header-1">
            {title}
          </Text>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <UiButton className="icon-button" aria-label="Đóng" onClick={onClose}>
          <X size={21} />
        </UiButton>
      </div>
      {children}
    </GravityModal>
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
    <Card className={"kpi " + (dark ? "dark" : "")} type="container">
      <div className="kpi-top">
        <span>{label}</span>
        <span className="kpi-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <div className="kpi-note">{note}</div>
    </Card>
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
    <UiButton className="button primary" type="submit" disabled={busy}>
      {busy ? <span className="spinner" /> : <Check size={16} />}{" "}
      {busy ? "Đang lưu…" : label}
    </UiButton>
  );
}
