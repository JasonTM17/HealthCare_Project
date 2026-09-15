# Phase 02 — Chart.js operational insights (admin dashboard)

## Design
- Dependency: `chart.js` v4 (+ tiny in-house React wrapper; no react-chartjs-2
  to keep the surface small).
- Placement: `/admin` overview — "Lịch hẹn theo tuần" (bar, volume per day for
  the upcoming 7 days if derivable) or fallback "Lịch hẹn theo trạng thái"
  (doughnut) from the appointments the admin dashboard already loads.
- Rendering: `new Chart()` in a `useEffect` on a canvas ref, `aria-label` on the
  canvas + an accessible summary table fallback (sr-only or visible small
  table), destroy on unmount, respect `prefers-reduced-motion` (disable
  animation), dark text colors consistent with the admin palette.
- Data: derive client-side from existing admin appointments API response; no
  backend change unless data is unavailable (then document).

## Steps
1. `npm i chart.js` (frontend).
2. `components/charts/AdminAppointmentsChart.tsx` (client component, typed).
3. Wire into `/admin` overview below "Dữ liệu hiện tại".
4. Unit test: data-transform function (pure) in `tests/`.
5. Gate: lint/typecheck/unit + browser screenshot + axe on `/admin`.

## Acceptance
- Chart visible with live data; no console errors; axe 0/0 on /admin;
  `prefers-reduced-motion` disables animation; bundle delta reported.
