import { formatBusinessDate, formatBusinessDateTime } from "./business-time";

/**
 * Single import surface for display date/time formatting.
 *
 * Both helpers delegate to `lib/business-time`, which pins every render to the
 * business time zone. Pages should import from here instead of calling raw
 * locale formatting APIs directly, so host time zones can never shift
 * displayed timestamps and the flat-UI contract gate stays enforceable.
 */

/** Format an instant as a date only, in the business time zone. */
export function formatDate(value: string | null | undefined): string {
  return formatBusinessDate(value);
}

/** Format an instant as date + time, in the business time zone. */
export function formatDateTime(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    // Reuse the date formatter's null placeholder ("Chưa có ngày") so both
    // entry points degrade identically.
    return formatBusinessDate(value);
  }
  return formatBusinessDateTime(value);
}
