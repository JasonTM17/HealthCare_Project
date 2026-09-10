"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import Icon from "../UiIcon";
import useDialogFocus from "../useDialogFocus";

export interface ConfirmActionField {
  name: string;
  label: string;
  description?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  /** Native HTML pattern (regex source without delimiters). */
  pattern?: string;
  patternHint?: string;
  placeholder?: string;
  multiline?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "url";
}

export interface ConfirmActionSummaryItem {
  label: string;
  value: ReactNode;
  mono?: boolean;
}

export interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  description?: string;
  /** Heading shown above the immutable summary block. */
  summaryLabel?: string;
  summaryItems: ConfirmActionSummaryItem[];
  /**
   * Entity the action applies to. The dialog snapshots it when the dialog
   * opens; if the object content changed while the dialog is open (stale row),
   * submission is blocked until the operator reopens with fresh data.
   */
  entity?: unknown;
  fields?: ConfirmActionField[];
  confirmLabel: string;
  confirmingLabel?: string;
  cancelLabel?: string;
  /** Destructive actions never dismiss on backdrop click and render a red confirm button. */
  destructive?: boolean;
  /**
   * Backdrop click dismisses the dialog. Defaults to `!destructive`;
   * financial/critical actions should pass `false` explicitly.
   */
  dismissOnBackdrop?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: (values: Record<string, string>) => void;
  onCancel: () => void;
}

/**
 * Accessible confirmation dialog for critical/destructive actions.
 * Focus handling reuses the shared `useDialogFocus` convention
 * (trap, Escape, body scroll lock, focus restore).
 *
 * The dialog body mounts fresh on every open, so the entity snapshot and
 * field values reset without effect-driven state churn.
 */
export default function ConfirmActionDialog(props: ConfirmActionDialogProps): React.ReactElement | null {
  if (!props.open) return null;
  return <ConfirmActionDialogBody {...props} />;
}

function ConfirmActionDialogBody({
  title,
  description,
  summaryLabel = "Thông tin hiện tại",
  summaryItems,
  entity,
  fields = [],
  confirmLabel,
  confirmingLabel = "Đang xử lý…",
  cancelLabel = "Đóng",
  destructive = false,
  dismissOnBackdrop,
  pending = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps): React.ReactElement {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Snapshot of the row at open time; a content change while the dialog is
  // open means the row went stale and submission must be blocked.
  const [entitySnapshot] = useState<string | null>(() => entity === undefined ? null : JSON.stringify(entity));
  const stale = entitySnapshot !== null && entity !== undefined && JSON.stringify(entity) !== entitySnapshot;

  const guardedCancel = (): void => {
    if (!pending) onCancel();
  };

  useDialogFocus(dialogRef, true, guardedCancel);

  const backdropCloses = !pending && (dismissOnBackdrop ?? !destructive);

  const collectValues = (form: HTMLFormElement): Record<string, string> => {
    const data = new FormData(form);
    const values: Record<string, string> = {};
    for (const field of fields) {
      values[field.name] = String(data.get(field.name) ?? "").trim();
    }
    return values;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (pending || stale) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    onConfirm(collectValues(form));
  };

  const cancelButton = (
    <button
      className="rounded-sm border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50"
      disabled={pending}
      onClick={guardedCancel}
      type="button"
    >
      {cancelLabel}
    </button>
  );

  const confirmButton = (
    <button
      className={`rounded-sm px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${destructive ? "bg-red-700 hover:bg-red-800" : "bg-teal-700 hover:bg-teal-800"}`}
      data-testid="confirm-action-submit"
      disabled={pending || stale}
      type="submit"
    >
      {pending ? confirmingLabel : confirmLabel}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 sm:items-center"
      data-testid="confirm-action-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && backdropCloses) guardedCancel();
      }}
    >
      <div
        aria-describedby="confirm-action-description"
        aria-labelledby="confirm-action-title"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-sm border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <h2 className="text-lg font-bold text-slate-950" id="confirm-action-title">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-slate-600" id="confirm-action-description">{description}</p>
        ) : null}

        <div className="mt-4 rounded-sm border border-slate-200 bg-slate-50 p-3" data-testid="confirm-action-summary">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{summaryLabel}</p>
          <dl className="mt-2 grid gap-2 text-sm">
            {summaryItems.map((item) => (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5" key={item.label}>
                <dt className="text-slate-500">{item.label}</dt>
                <dd className={item.mono ? "font-mono text-xs text-slate-800" : "font-semibold text-slate-900"}>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {stale ? (
          <p className="mt-3 rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
            Dữ liệu đã thay đổi kể từ khi hộp thoại mở. Hành động bị tạm khóa — hãy đóng hộp thoại, làm mới danh sách và xác nhận lại trên dữ liệu mới nhất.
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            <Icon name="alert-triangle" size={16} /> {error}
          </p>
        ) : null}

        {fields.length > 0 ? (
          <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
            {fields.map((field) => (
              <label className="block text-sm font-semibold text-slate-700" key={field.name}>
                {field.label}
                {field.required ? <span aria-hidden="true"> *</span> : null}
                {field.multiline ? (
                  <textarea
                    className="mt-1 w-full rounded-sm border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    maxLength={field.maxLength}
                    minLength={field.minLength}
                    name={field.name}
                    placeholder={field.placeholder}
                    required={field.required}
                    rows={3}
                  />
                ) : (
                  <input
                    autoComplete={field.autoComplete}
                    className="mt-1 w-full rounded-sm border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    inputMode={field.inputMode}
                    maxLength={field.maxLength}
                    minLength={field.minLength}
                    name={field.name}
                    pattern={field.pattern}
                    placeholder={field.placeholder}
                    required={field.required}
                    title={field.patternHint}
                    type="text"
                  />
                )}
                {field.patternHint ? <small className="mt-1 block text-xs font-normal text-slate-500">{field.patternHint}</small> : null}
                {field.description ? <small className="mt-1 block text-xs font-normal text-slate-500">{field.description}</small> : null}
              </label>
            ))}
            <div className="mt-1 flex flex-wrap justify-end gap-2">
              {cancelButton}
              {confirmButton}
            </div>
          </form>
        ) : (
          <form className="mt-4" onSubmit={handleSubmit}>
            <div className="flex flex-wrap justify-end gap-2">
              {cancelButton}
              {confirmButton}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
