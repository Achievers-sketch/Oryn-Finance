# Centralized Audit Logging System

**Issue:** #194
**Status:** Implemented
**Components:** Model, Service, Controller, Routes, Frontend Dashboard, Tests, Documentation

---

## Overview

The Audit Logging System provides a single, structured, append-only record of
critical platform actions for **compliance**, **debugging**, and **security
monitoring**. Every entry captures *who* performed an action, *what* the action
was, *when* it happened, and the relevant context (target, request metadata,
outcome).

Audit entries are written in two places at once:

1. The **`audit_logs`** MongoDB collection — queryable, filterable, and the data
   source for the dashboard / exports.
2. The **winston logger** as a structured JSON line (`[AUDIT] <action>`) for
   file-based log aggregation / SIEM ingestion.

Recording is **best-effort**: a failure to write an audit entry never breaks the
business operation that triggered it.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       API Endpoints                          │
│  GET /api/audit          (paginated, filterable log viewer)  │
│  GET /api/audit/stats    (dashboard aggregates)              │
│  GET /api/audit/export   (download as JSON or CSV)           │
│                     [ all admin-only ]                       │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                      AuditController                         │
│         (filtering, pagination, stats, JSON/CSV export)      │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                       auditService                          │
│   record() · auth() · transaction() · admin() · treasury()   │
│   toCSV() · resolveActor()   (DB + structured logger mirror) │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                    AuditLog (mongoose model)                │
│         audit_logs collection — append-only, indexed         │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Model (`AuditLog`)

| Field          | Type    | Description                                            |
| -------------- | ------- | ------------------------------------------------------ |
| `eventId`      | String  | Unique, human-readable identifier (auto-generated)     |
| `category`     | String  | `authentication` · `transaction` · `admin` · `treasury` · `system` |
| `action`       | String  | Concrete action, e.g. `auth.login`, `transaction.executed` |
| `status`       | String  | `success` · `failure`                                  |
| `actor`        | Object  | `{ walletAddress, isAdmin, ip, userAgent }`            |
| `target`       | Object  | `{ type, id }` — the affected resource (optional)      |
| `description`  | String  | Human-readable summary                                 |
| `metadata`     | Mixed   | Arbitrary structured context (amounts, route, etc.)    |
| `timestamp`    | Date    | When the action occurred                               |

Indexes are defined on `category`, `action`, `status`, `actor.walletAddress`
and `timestamp` to support fast filtering on the dashboard.

---

## Recorded Actions

| Category         | Actions                                                                    | Source |
| ---------------- | -------------------------------------------------------------------------- | ------ |
| `authentication` | `auth.login`, `auth.logout`, `auth.token_refreshed`, `auth.login_failed`   | `routes/auth.js` |
| `transaction`    | `transaction.created`, `transaction.executed`, `transaction.failed`        | `controllers/transactionController.js` |
| `admin`          | `admin.access_granted`, `admin.access_denied`, `admin.action`              | `middleware/auth.js`, exports |
| `treasury`       | `treasury.inflow_recorded`, `treasury.distribution_recorded`, `treasury.governance_action` | `controllers/treasuryController.js` |

Admin access is logged centrally in the `requireAdmin` middleware, so **every**
admin-protected endpoint is covered automatically.

---

## API Reference

All endpoints require an authenticated **admin** (JWT/cookie or
`ADMIN_ADDRESSES` allow-list).

### `GET /api/audit`

Paginated, filterable list of audit entries (powers the log viewer).

**Query params:** `category`, `action`, `status`, `actor`, `target`,
`startDate`, `endDate`, `page` (default 1), `limit` (default 50, max 200).

```json
{
  "success": true,
  "data": {
    "logs": [ { "eventId": "...", "category": "authentication", "action": "auth.login", "...": "..." } ],
    "pagination": { "page": 1, "limit": 50, "total": 120, "pages": 3 }
  }
}
```

### `GET /api/audit/stats`

Aggregate statistics for the dashboard.

```json
{
  "success": true,
  "data": {
    "total": 1240,
    "events24h": 56,
    "byCategory": [ { "category": "authentication", "count": 800 } ],
    "byStatus": { "success": 1200, "failure": 40 },
    "recentFailures": [ ... ]
  }
}
```

### `GET /api/audit/export?format=json|csv`

Exports filtered logs. Accepts the same filter query params as `GET /api/audit`
plus `format` (`json` default, or `csv`) and `limit` (max 50,000). Returns a
downloadable file (`Content-Disposition: attachment`). The export action is
itself recorded as an audit event.

---

## Frontend Log Viewer

A dashboard is available at **`/audit`** (`frontend/src/pages/AuditLogs.tsx`):

- Summary metrics (total events, last 24h, successes, failures).
- Filterable, paginated table (by category and status).
- One-click **Export JSON** / **Export CSV** download buttons.

It consumes `apiService.audit` (`getLogs`, `getStats`, `getExportUrl`).

---

## Usage

Record an audit event from anywhere in the backend:

```js
const auditService = require('../services/auditService');

// Domain helpers accept an express `req` (or a plain actor object):
await auditService.auth('auth.login', req, { description: 'User logged in' });
await auditService.transaction('transaction.executed', req, {
  target: { type: 'transaction', id: txHash },
  metadata: { status: 'SUCCESS' },
});
await auditService.treasury('treasury.inflow_recorded', req, { metadata: { amount, asset } });
await auditService.admin(req, { action: 'admin.access_denied', status: 'failure' });

// Or the generic entry point:
await auditService.record({ category: 'system', action: 'system.event', description: '...' });
```

---

## Testing

- `__tests__/services/auditService.test.js` — `record`, `resolveActor`,
  convenience helpers, and CSV serialization (escaping, headers, empty list).
- `__tests__/controllers/auditController.test.js` — filter building, paginated
  listing, page-size cap, stats aggregation, and JSON/CSV export.

```bash
cd backend
npm test
```
