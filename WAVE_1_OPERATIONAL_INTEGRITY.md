# Underground Wave 1 — Operational Integrity

## Running tests

Run `npm test` from the project folder. The suite creates a fresh in-memory SQLite database, applies every migration in order, and never connects to production D1.

## Corrections

Migration `0046_operational_integrity.sql` adds `admin_corrections`. Corrections are immutable and unique per original record.

- Mission completion: excluded from effective progression; awarded Keys receive a compensating transaction; private assignments reopen.
- Event attendance: excluded from effective attendance counts; the original check-in remains in history.
- Milestone: excluded from effective achievements; the original award remains in history.
- Workshop completion: excluded from effective completion; awarded Keys receive a compensating transaction; Workshop progress is recalculated.
- Technique evaluation: excluded from current Technique status and evaluation history calculations.
- Signal transfer: the latest transfer may restore ownership to its sender. A transfer with later dependent history is marked invalidated for audit only.
- Reward fulfillment: marked invalidated for audit only because the system cannot safely undo a real-world handoff or infer whether Keys should be refunded.

Every correction requires a reason and produces a security audit record. Corrections never delete original records.

## Deprecated compatibility fields

The following remain in D1 because dropping or rewriting them creates unnecessary migration risk: `stamps`, `passport_rewards`, `missions.counts_as_event`, the historical `mission-initiate` milestone identifier, and the `looking_for` Classified category. Current application flows do not create new state through these retired paths.
