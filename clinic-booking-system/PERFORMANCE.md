# Performance Characteristics — Clinic AI Receptionist

Production metrics from operating this system. Figures are rounded ranges from real operation, not best-case benchmarks.

---

## Response Time

Two different numbers are reported, and they measure different things:

- **Processing time** — webhook received → reply sent by `Send Reply via API`. This is what the workflow controls.
- **User-facing commitment** — under 2 minutes from message receipt to reply. This is the number quoted to the clinic; it only comes into play when an upstream provider is degraded and node retries engage.

The workflow adds no artificial reply delay.

| Stage | Typical | P95 | Notes |
|---|---|---|---|
| **Webhook receive → reply sent (all intents)** | **1.2 sec** | **3.5 sec** | End-to-end processing |
| Webhook → normalize message | 30 ms | 80 ms | JS execution |
| Conversation history lookup (Sheets) | 200 ms | 600 ms | Bottleneck during high concurrency |
| Intent classifier (gpt-4o-mini) | 400 ms | 900 ms | Single-label output, 10 max tokens |
| Booking extraction (gpt-4o) | 800 ms | 2,200 ms | JSON mode, structured output |
| Calendar API availability lookup | 250 ms | 700 ms | 14-day window |
| Channel dispatch (HTTP send) | 200 ms | 500 ms | Varies per platform |

Stage figures are measured per node and are not additive. The end-to-end figure is blended across intents: greeting and FAQ turns skip extraction and the calendar read and finish below it, while booking turns add extraction, a calendar read and a gpt-4o reply call and run above it.

---

## Throughput

Tested operating range:
- **Sustained:** 50 concurrent active conversations
- **Burst:** 200 inbound messages over 60 seconds (e.g., post-campaign spike)
- **Daily volume:** a typical clinic processes 80–200 inbound messages per day across all channels

Bottlenecks under load and how they are handled:
1. **Google Sheets API rate limits** at high concurrency — reads retry 3 times, 2 s apart; a database is the next step at higher volume (see limits below)
2. **OpenAI rate limits** — absorbed by node-level retries; a second API key is recommended for sustained bursts
3. **WhatsApp Business API rate limits** — the send node is not auto-retried (to prevent duplicate messages); failures are escalated by the error handler, and n8n queue mode is recommended for larger deployments

---

## Cost per Conversation

Cost breakdown for an average conversation (3–4 turns):

| Component | Cost per conversation |
|---|---|
| OpenAI intent classifier (gpt-4o-mini, ~50 tokens) | $0.00005 |
| OpenAI booking extraction (gpt-4o, ~600 tokens) | $0.003 |
| OpenAI response generation (greeting/FAQ, gpt-4o-mini, ~300 tokens) | $0.0001 |
| Google Sheets / Calendar API | $0 (within free tier) |
| WhatsApp Business API outbound | $0.005–0.014 per session |
| n8n self-hosted compute | ~$0.0001 (amortized VPS cost) |
| **Total per conversation** | **~$0.008–0.020** |

Booking turns generate their reply with gpt-4o rather than gpt-4o-mini; the total range above includes that.

**Monthly projection** for a clinic processing 150 conversations/day (~4,500/month): ~$36–90/month in API costs.

WhatsApp is the dominant and most variable line: Meta bills per conversation, with rates that differ by country and conversation category. Live invoices can therefore run above these averages (see [`examples/sample_kpi_dashboard.md`](./examples/sample_kpi_dashboard.md)).

---

## Reliability (90-day production window)

- **Execution success rate:** 99.4%
- **Failed executions:** 0.6% — most recovered on retry; <0.1% required human intervention
- **Common failure modes:**
  - OpenAI rate limit — absorbed by node-level retry (3 tries, 2 s apart)
  - WhatsApp account disconnection — requires client action, not a system fault
  - Google Calendar OAuth token expiry — roughly one manual re-authorization every 90 days
  - Malformed webhook payload — rejected by the normalizer and logged; rare

---

## Outcome Metrics

The metrics the clinic manages against. Their exact definitions are written in SQL and Python in [`analytics/`](./analytics), so they can be recomputed from an export of the conversation log:

| Metric | Before automation | After 30 days | After 90 days |
|---|---|---|---|
| Avg response time to first inquiry | 2–8 hours | <2 minutes | <2 minutes |
| Inquiries handled without human | 0% | 85% | 92% |
| Booking conversion (inquiry → confirmed visit) | ~30% | ~60% | ~70% |
| No-show rate | 18% | 10% | 6% |
| Manual receptionist hours per week | 35–40 hrs | 10–12 hrs | 10–12 hrs |

The reduction from 35–40 to 10–12 receptionist hours per week is the **70% front-desk workload reduction**. The 90-day numbers are higher than the 30-day numbers because the first 30 days were spent tuning prompts to the clinic's tone, services and dialect. The no-show improvement comes from the production reminder flow, which is not part of the exported `workflow.json`.

---

## Capacity Planning Reference

Sizing guidance for other clinics:

- **Small clinic (< 50 inquiries/day):** default configuration. Estimated cost $15–25/month.
- **Medium clinic (50–150 inquiries/day):** add a second OpenAI API key to spread rate limits. Estimated cost $50–90/month.
- **Large clinic / multi-location (150–500 inquiries/day):** n8n queue mode, dedicated VPS, batched Sheet writes. Estimated cost $150–300/month.

---

## Known Scaling Limits

1. **Beyond ~1,000 concurrent conversations:** Google Sheets becomes the bottleneck; migrate conversation state to PostgreSQL — the schema is ready in [`analytics/schema.sql`](./analytics/schema.sql).
2. **Beyond ~10,000 messages/day:** dedicated rate-limit management and multiple n8n workers in queue mode.
3. **Compliance-heavy contexts (HIPAA, strict GDPR):** conversation logging in Google Sheets must be replaced with audit-grade storage.

Operating at that scale is an architecture change, not a configuration change, and is scoped as such.
