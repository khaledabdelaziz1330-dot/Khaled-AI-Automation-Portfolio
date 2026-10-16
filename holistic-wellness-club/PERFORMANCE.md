# Performance Characteristics — Wellness Club GHL + n8n System

The system was built and tested in a GoHighLevel staging sub-account (February 2026) and has not yet run with live clients, so this page reports no production metrics. It documents the performance-relevant design, the expected running cost, and the known limits.

---

## Webhook Processing Path

Every GHL event follows one short, linear path in [`workflow.json`](workflow.json):

| Stage | Work done | Dominant cost |
|---|---|---|
| Receive + normalize | Map GHL payload to one schema | In-memory JavaScript |
| Duplicate check | One Google Sheets lookup on `event_id` | Sheets API round trip |
| Enrich + route | Derived fields, switch on `event_type` | In-memory JavaScript |
| Log | One Sheets append (two for new appointments: log + reminder schedule) | Sheets API round trip |
| Acknowledge | JSON response to GHL | — |

**Implication:** end-to-end latency is bounded by two to three Google Sheets API calls per event; the JavaScript steps are negligible by comparison.

---

## Reliability Mechanisms

What the exported workflow implements:

- **Idempotency by event ID** — GHL retries are looked up in the AllEvents index and acknowledged without a second log row
- **No silent drops** — the router's fallback branch sends every unrecognized event type to Pipeline_Changes
- **Explicit acknowledgement** — a Respond to Webhook node returns a JSON status to GHL
- **Safe reminder scheduling** — 24-hr and 2-hr touchpoints already in the past are skipped; appointments without an end time default to one hour
- **Workflow-level error handler** — failures route to a separate error workflow (Errors sheet + email alert)

On the GHL side, the Appointment Confirmation workflow carries its own monitoring branch for SMS delivery errors and invalid numbers.

---

## Estimated Running Cost

| Component | Monthly cost |
|---|---|
| GoHighLevel subscription | $97-297 (depends on tier) |
| n8n self-hosted VPS | ~$20 |
| Google Sheets | Free tier |
| GHL SMS / email | Usage-based |
| **Total** | **~$120-320/month plus messaging usage** |

---

## Reporting

The KPIs tab is built from summary formulas and pivot tables over the log tabs. To keep those formulas simple, the workflow writes derived fields at ingest time: `day_of_week`, `hour_of_day`, `is_business_hours`, `funnel_position`, and `week_iso`.

---

## Where this hits limits

- **Idempotency index:** every first-seen event is appended to the AllEvents tab by **Record Event ID**, so a GHL retry of the same event is caught by the lookup. Two copies of one event arriving within the same second can both pass the lookup before either is recorded — acceptable at this volume; a database unique constraint would close that window.
- **Events without an ID:** if a GHL payload has no `id`, a random `event_id` is generated, so a retry of that payload cannot be detected as a duplicate.
- **Sheets as a datastore:** at higher volume, Google Sheets API quotas and sheet size will limit throughput and reporting. Migrate logs to a database and KPIs to Metabase or similar.
- **Multi-location chains:** the current setup is single-location. Multi-location would need a routing layer above GHL.
- **Regulated jurisdictions:** if client data falls under HIPAA/GDPR-style rules, conversation storage and log retention need review.
