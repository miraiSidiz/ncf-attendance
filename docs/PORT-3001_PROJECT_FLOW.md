# Project flow & validations (running on port 3001)

This document describes the high-level request flow, important API endpoints, and the validations enforced by the QR attendance project when the dev server is run on port 3001.

## Running locally (port 3001)
- The repository's `dev` script now starts Next on port 3001.
- Start the dev server:

```bash
npm run dev
```

- The project's test script `scripts/attendanceFlowTest.js` probes common ports and will detect the server at `http://localhost:3001` (it checks `process.env.PORT`, `3000`, `3001`, `3002`, `3003`).

## High-level flow
1. Client (scanner or UI) POSTs a JSON payload to the attendance endpoint to record a `time-in` or `time-out`.
2. Server validates payload, locates the `student` by QR code, and checks the referenced `event`.
3. If the `event` uses sessions, the server resolves the current session (e.g., morning / afternoon) and applies session-specific rules.
4. Business rules are applied (duplicate prevention, time window checks, timeouts). If valid, an attendance record is created/updated and a success response is returned.
5. The UI/dashboards read attendance data via the `reports` and `attendance-logs` APIs or SSE endpoints to update real-time views.

## Key API endpoints (where to look)
- Events: [app/api/events/route.ts](app/api/events/route.ts)
- Attendance: [app/api/attendance/route.ts](app/api/attendance/route.ts)
- Attendance stream / SSE: [app/api/attendance/stream/route.ts](app/api/attendance/stream/route.ts)
- Students: [app/api/students/route.ts](app/api/students/route.ts)
- Students ZIP export (QR images): [app/api/students/zip/route.ts](app/api/students/zip/route.ts)
- Reports: [app/api/reports/route.ts](app/api/reports/route.ts)
- Admin attendance logs: [app/api/admin/attendance-logs/route.ts](app/api/admin/attendance-logs/route.ts)

## Important validations and business rules

- Request format
  - Requests must be `application/json` for POST/PUT endpoints.
  - Required fields for attendance: `qrCode`, `eventId`, `action` (accepted values: `in`, `out`).

- Student validation
  - `qrCode` must match an existing student record.
  - Student must be active (if the app enforces active/inactive flags).

- Event validation
  - `eventId` must reference an existing event.
  - The current server time is checked against the event's `startDate` / `endDate`.
  - If `useSessions` is true, the server determines the current session by comparing now to session start/end times (`morningStart`, `morningEnd`, `afternoonStart`, `afternoonEnd`).

- Session rules
  - When in a session window, `time-in` is allowed; `time-out` may be blocked or subject to a session-end rule (app behavior depends on `attendance_timeout` and session design).
  - Attempts to `time-in` outside allowed windows should be rejected with a clear error.

- Duplicate & idempotency checks
  - Prevent recording multiple `time-in` entries without a corresponding `time-out` (or vice versa) depending on configured rules.

- Attendance timeout / blocking
  - There is a configurable timeout / policy (see migrations adding `attendance_timeout`) that controls whether a `time-out` is allowed immediately after `time-in` or if it must wait until session end.

- Authorization
  - Sensitive endpoints (admin, reports, ZIP export) require authenticated users via the app's auth system.

- Error reporting and status codes
  - Validation failures return 4xx with a JSON body describing the error.
  - Server errors return 500.

## Tests & helper scripts
- The integration helper `scripts/attendanceFlowTest.js` creates a short event with sessions and simulates a student `time-in` and `time-out`. It detects the running server by trying ports including `3001`.

Run the script against the local dev server:

```bash
node scripts/attendanceFlowTest.js
```

If your dev server runs on a non-standard port (overriding `PORT`), the script will detect it if `process.env.PORT` is set.

## Troubleshooting
- If tests fail to find the server, ensure `npm run dev` is running and listening on `http://localhost:3001`.
- Check server logs for validation error details (they usually include the endpoint and payload problem).
- Use Postman or curl to manually reproduce requests to `http://localhost:3001/api/attendance` before running the automated script.

## Notes and next steps
- Consider documenting any environment-specific overrides (e.g., `DATABASE_URL`, `NEXTAUTH_URL`) if you share the port change across team members.
- If you want, I can add request/response examples for the main endpoints to this doc.
