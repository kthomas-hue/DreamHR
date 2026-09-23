import type { ReactNode } from "react";
import { initials } from "./utils";

export function Avatar({ name, size }: { name: string; size?: "sm" | "lg" }) {
  return <span className={`avatar ${size ?? ""}`}>{initials(name)}</span>;
}

export function Pill({
  tone = "neutral",
  children,
  dot,
}: {
  tone?: "brand" | "neutral" | "success" | "warning" | "danger" | "info";
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={`pill ${tone}`}>
      {dot && <span className="pdot" style={{ background: "currentColor" }} />}
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  small,
  ...rest
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "subtle" | "danger";
  small?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`btn ${variant} ${small ? "small" : ""}`} {...rest}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`card ${className ?? ""}`} style={style}>
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 10 }}>{actions}</div>}
    </div>
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {required && <span className="req">*</span>}
      </span>
      {children}
    </label>
  );
}

export function Modal({
  title,
  description,
  children,
  footer,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="center-load">
      <div className="spinner" />
    </div>
  );
}

export function EmptyState({ icon, title, message }: { icon?: string; title: string; message?: string }) {
  return (
    <div className="state">
      <div className="state-ico">{icon ?? "✳"}</div>
      <h4>{title}</h4>
      {message && <p style={{ margin: "4px 0 0" }}>{message}</p>}
    </div>
  );
}

export function Banner({ tone, children }: { tone: "error" | "info" | "warn"; children: ReactNode }) {
  return <div className={`banner ${tone}`}>{children}</div>;
}
