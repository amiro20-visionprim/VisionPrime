# Phase 11 — Segments, Campaigns & Notifications

## Overview

Phase 11 adds customer segmentation, campaign management, message templates,
a notification provider base, opt-out/suppression handling, and campaign
reporting.

## Migrations

New tables: `segments`, `segment_conditions`, `segment_members`, `campaigns`,
`campaign_recipients`, `campaign_events`, `message_templates`,
`notification_providers`, `notification_messages`, `notification_opt_outs`,
`suppression_lists`, `suppression_list_members`.

## Backend modules

- `apps/api/src/modules/segments` — segment CRUD, condition evaluation
  (`evaluateSegmentConditions`, AND-only), static member management.
- `apps/api/src/modules/campaigns` — campaign CRUD, recipient preview,
  background send, recipient listing, reporting.
- `apps/api/src/modules/notifications` — message templates, notification
  providers (encrypted credentials), opt-outs, suppression lists, message
  log.

## APIs

- `GET/POST /api/admin/segments`, `GET/PATCH/DELETE /api/admin/segments/:id`,
  `POST /api/admin/segments/:id/evaluate`, `GET /api/admin/segments/:id/members`
- `GET/POST /api/admin/campaigns`, `GET/PATCH/DELETE /api/admin/campaigns/:id`,
  `POST /api/admin/campaigns/:id/preview`, `POST /api/admin/campaigns/:id/send`,
  `GET /api/admin/campaigns/:id/recipients`, `GET /api/admin/campaigns/:id/report`
- `GET/POST /api/admin/message-templates`,
  `PATCH/DELETE /api/admin/message-templates/:id`
- `GET/POST /api/admin/notification-providers`,
  `PATCH /api/admin/notification-providers/:id`
- `GET/POST /api/admin/notification-opt-outs`,
  `DELETE /api/admin/notification-opt-outs/:customerId/:channel`
- `GET/POST /api/admin/suppression-lists`,
  `GET/PATCH/DELETE /api/admin/suppression-lists/:id`,
  `GET/POST /api/admin/suppression-lists/:id/members`,
  `DELETE /api/admin/suppression-lists/:id/members/:customerId`

## Jobs

`CampaignsService.sendCampaign()` synchronously creates `campaign_recipients`
rows (status `pending`) and an audit log entry, then dispatches per-recipient
sends into the background `JobRunner`. Each recipient send is independently
try/caught — a single failure is logged with a sanitized error message and
does not stop the rest of the campaign.

## Admin UI

- Segments (`/segments`) — list, builder (dynamic rule conditions via
  `RuleBuilder` or static member list), detail drawer with conditions and
  paginated members, evaluate action.
- Campaigns (`/campaigns`) — list, builder, detail drawer with recipient
  preview, recipient list, and `ChartCard` report (sent/failed/skipped/pending).
- Message Templates (`/message-templates`) — editor for name/channel/subject/
  body/declared variables.
- Notification Providers (`/notification-providers`) — tabs for provider
  settings (masked credential preview only), opt-outs, and suppression lists
  with member management.

## Permissions

`segment:view`, `segment:create`, `segment:update`, `segment:delete`,
`segment:evaluate`, `campaign:view`, `campaign:create`, `campaign:update`,
`campaign:delete`, `campaign:send`, `campaign:report:view`,
`message_template:view`, `message_template:manage`,
`notification_provider:view`, `notification_provider:manage`.

## Audit events

`campaign.send` is written when a campaign send is dispatched, with
`actor_id`, `target_id` (campaign id), and before/after state.

## Tests

`apps/api/src/modules/campaigns/phase11.controller.spec.ts` — 11 integration
tests covering: dynamic segment evaluation, static segment membership,
segment re-evaluation, opt-out exclusion, suppression exclusion, recipient
creation on send, failed-recipient sanitized logging without halting the
campaign, template variable rendering (success + missing-variable
rejection), permission enforcement on `campaign:send` and `segment:evaluate`,
and the `campaign.send` audit log entry.

Run with:

```
cd apps/api && npx jest src/modules/campaigns/phase11.controller.spec.ts
```

## Demo steps

1. Create a dynamic segment with a `city eq "Cairo"` condition; evaluate it.
2. Create a message template with a declared variable.
3. Create a campaign targeting the segment, channel `email`, using the
   template.
4. Preview the campaign to see eligible recipient count.
5. Send the campaign; recipients are created and processed in the
   background job.
6. View the campaign report for sent/failed/skipped/pending counts.
7. Add a customer to an opt-out or suppression list and confirm they're
   excluded from future campaign previews/sends.

## Phase 11 completion report

- Migrations: complete (12 tables).
- APIs: complete (segments, campaigns, message templates, notification
  providers, opt-outs, suppression lists).
- Jobs: complete (background campaign send via `JobRunner`/`TestJobRunner`).
- Admin UI: complete (segments, campaigns, message templates, notification
  providers/opt-outs/suppression).
- Permissions: complete (15 keys registered in
  `packages/permissions/src/index.ts`).
- Audit events: complete (`campaign.send`).
- Tests: complete (11/11 passing, 115/115 across the full API suite).
- Demo steps: documented above.
