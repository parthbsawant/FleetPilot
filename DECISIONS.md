# FleetPilot Analytics — Decision Log

This file records every approved decision. It overrides the "candidate" and "proposed" items in the original project context document. Update it whenever a decision changes, and say what changed and why.

---

## D-00 Project and process (approved 26 Oct 2026)

- **MVP deadline:** Thursday 5 Nov 2026. That is 10 working days, Tue 27 Oct to Thu 5 Nov. (Revised 27 Oct: the start moved from Mon 26 Oct to Tue 27 Oct.) The 17 Nov HR evaluation date is not the working deadline.
- **Team:** a single developer. All work happens on `main`.
- **Way of working:** the developer is learning the stack while building it. Each day has two blocks:
  - **Learn:** a study doc plus a small end-to-end mini project. The mini projects grow from a simple Node script to a deployed app with a chart.
  - **Build:** a step-by-step study doc for that day's FleetPilot phase, which the developer implements themselves.
  - Claude reviews the work and answers questions.
- **Tool versions:** Node.js 24 LTS and PostgreSQL 18.
- **Sequence change:** authentication is built on Day 5, before trips, expenses and maintenance. The original plan had it at Phase 7. Building it earlier avoids retrofitting route protection later.

## D-01 Vehicles

- **Fields:**
  - `id`
  - `registration_number`: unique; stored uppercase with spaces removed
  - `name_model`
  - `vehicle_type`: one of `bus`, `coach`, `minibus`, `van`, `other`
  - `status`
  - `initial_odometer_km`: must be 0 or more
  - `acquired_on`: optional
  - `created_at`, `updated_at`
- **Statuses:**
  - `active`: available for trips
  - `in_maintenance`: temporarily unavailable
  - `inactive`: retired or deactivated
- **Current odometer** is calculated, never stored. It is the highest of three values:
  - the initial odometer
  - the highest end odometer of the vehicle's completed trips
  - the highest odometer reading in its maintenance records

## D-02 Trips

- **Lifecycle:**
  - `scheduled` → `in_progress` → `completed`
  - `cancelled` is allowed from `scheduled` or `in_progress`
  - A completed trip can never go back to an earlier status.
- **Fields:**
  - `vehicle_id`
  - `start_at`, `end_at`
  - `start_odometer_km`, `end_odometer_km`
  - `distance_km`
  - `origin`, `destination`: short text labels; no GPS
  - `status`
  - `notes`
- **Distance:** `distance_km` is a generated column, equal to `end_odometer_km - start_odometer_km`. A database CHECK rule makes sure it is 0 or more.
- **What each status requires:**
  - `in_progress` requires the start odometer.
  - `completed` requires both odometer readings and `end_at`.

## D-03 Expenses

- **Categories:** `fuel`, `maintenance`, `tolls_parking`, `insurance_permits`, `other`.
- **Amount:**
  - Stored as `NUMERIC(12,2)`, in INR.
  - Must be more than 0 and at most ₹10,00,000.
- **Date:** the expense date cannot be in the future.

## D-04 Authoritative source of maintenance cost

- The expenses table is the only place money is stored. Maintenance records have no cost column.
- When maintenance is recorded with a cost, the backend creates an expense with category `maintenance` in the same database transaction.
- That expense stores `maintenance_id`, and this column is UNIQUE.
- All cost analytics read only the expenses table, so the same cost can never be counted twice.

## D-05 Maintenance warning windows

- A vehicle's service schedule comes from its most recent maintenance record: the next service date and the next service odometer.
- **Overdue:** the next service date has passed, or the current odometer is at or past the next service odometer.
- **Due soon:** the next service date is within 14 days, or the next service odometer is within 1,000 km.
- **OK:** neither of the above.
- **No schedule:** no next service date or odometer has been recorded.
- Inactive vehicles are excluded from alerts.

## D-06 Odometer consistency

- A new trip's start odometer must be at least the end odometer of the vehicle's previous completed trip. If not, the trip is rejected.
- A trip's odometer range must not overlap another trip's range for the same vehicle. If it does, the trip is rejected.
- A vehicle can have at most one `in_progress` trip at a time.
- A gap between one trip's end odometer and the next trip's start odometer is allowed, but it is flagged.

## D-07 Dashboard metrics

- **Fleet total:** `active` plus `in_maintenance` vehicles. `inactive` vehicles are shown separately.
- **Completed trips and distance:** only trips with status `completed` count. A trip belongs to the period that contains its `end_at`.
- **Expenses:** a total and a total per category. An expense belongs to the period that contains its `expense_date`.
- **Cost per km:** expenses in the period divided by completed distance in the period. If the distance is 0, show "—".
- **Maintenance alerts:** the counts plus a list of overdue and due-soon vehicles.
- **Monthly trends:** distance and expenses for each month in the selected range.
- **Top 5 vehicles by operating cost**, each shown with its cost per km.
- **Period presets:**
  - this month
  - last 3 months
  - last 6 months (the default)
  - last 12 months
  - custom range

## D-08 Dates and timezone

- Timestamps are stored as `TIMESTAMPTZ` (UTC).
- `expense_date` and `service_date` are stored as `DATE`.
- Day and month boundaries are calculated in Asia/Kolkata, set by the `APP_TIMEZONE` environment variable.
- Date ranges include both the start and end dates.
- **Display formats:**
  - Dates: `26 Oct 2026`
  - Money: ₹ with Indian (en-IN) digit grouping
  - Distance: km

## D-09 Screens and navigation

- **Screens:**
  - Login
  - Dashboard
  - Vehicles list
  - Vehicle detail, with tabs for trips, expenses and maintenance
  - Trips
  - Expenses
  - Maintenance, with an alerts filter
- Records are added and edited in modal forms.
- Navigation is a sidebar.
- The frontend is multi-page HTML with shared JS modules. Express serves it from the same origin as the API.

## D-10 Authentication

- Login uses a server-side session stored in an httpOnly cookie, using `express-session` and `connect-pg-simple`.
- Passwords are hashed with bcrypt.
- A setup script creates the admin account from environment variables.
- The login endpoint is rate-limited.

## D-11 API format

- **Success response:** `{ data, meta }`.
- **Error response:** `{ error: { code, message, details } }`.
- **Status codes:**
  - `400`: validation error
  - `401`: not logged in
  - `404`: not found
  - `409`: conflict, such as a duplicate or a protected delete
- **Lists:**
  - Pagination uses `?page=&limit=`. The default limit is 20 and the maximum is 100.
  - Filters are passed as query parameters.
- Dates are sent as ISO strings.
- All money and distance totals are calculated in SQL, never in the browser.

## D-12 Deletion

- **Vehicles:**
  - A vehicle can only be hard-deleted if it has no trips, expenses or maintenance records.
  - Otherwise the API returns `409` and the vehicle must be deactivated instead.
  - Foreign keys use `ON DELETE RESTRICT`.
- **Trips:** completed trips can be edited but not deleted. Trips with any other status can be deleted.
- **Expenses:**
  - An expense linked to a maintenance record can only be changed or removed through that maintenance record.
  - Other expenses can be deleted.
- **Maintenance:** deleting a maintenance record also deletes its linked expense, in the same transaction.

## D-13 Hosting

- Proposed: the web service on Render and the database on Neon PostgreSQL, both on free tiers.
- **Open item:** check the current free-tier limits on Day 9, before deploying.
- Free services sleep when idle, so open the app a few minutes before any demo.

## D-14 Acceptance criteria

- Each module is done when it passes the tests in section 14 of the project context document and follows the rules in this file.
- A per-module checklist will be kept in `docs/BUSINESS_RULES.md`.

---

## Open items

- Hosting free-tier limits (D-13): check on Day 8 (Tue 3 Nov), during the mini project deploy rehearsal.
