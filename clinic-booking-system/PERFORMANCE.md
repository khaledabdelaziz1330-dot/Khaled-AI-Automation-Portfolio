# Performance Characteristics — Clinic AI Receptionist

Honest production metrics from running this system. Numbers are rounded ranges from real operation, not best-case marketing.

---

## Response Time

| Stage | Typical | P95 | Notes |
|---|---|---|---|
| Webhook receive → AI response sent | 1.2 sec | 3.5 sec | End-to-end |
| Webhook → normalize message | 30 ms | 80 ms | JS execution |
| Conversation history lookup (Sheets) | 200 ms | 600 ms | Bottleneck during high concurrency |
| Intent classifier (GPT-4o-mini) | 400 ms | 900 ms | Single-token output |
| Booking extraction (GPT-4o) | 800 ms | 2,200 ms | JSON mode, structured output |
| Calendar API availability lookup | 250 ms | 700 ms | 14-day window |
| Channel dispatch (HTTP send) | 200 ms | 500 ms | Varies per platform |

**User-facing target:** Under 2 minutes from message receipt to AI reply. This is typically met in 1-2 seconds; the 2-minute target only matters if API providers are degraded.

---

## Throughput

Tested operating range:
- **Sustained:** 50 concurrent active conversations
- **Burst:** 200 inbound messages over 60 seconds (e.g., post-campaign spike)
- **Daily volume:** Typical clinic processes 80-200 inbound messages per day across all channels

Bottlenecks under load:
1. Google Sheets API rate limits at high concurrency (mitigated by batching reads)
2. OpenAI rate limits (mitigated by spreading across two API keys)
3. WhatsApp Business API rate limits (mitigated by queueing)

---

## Cost per Message

Real cost breakdown for an average conversation (3-4 turns):

| Component | Cost per conversation |
|---|---|
| OpenAI intent classifier (GPT-4o-mini, ~50 tokens) | $0.00005 |
| OpenAI booking extraction (GPT-4o, ~600 tokens) | $0.003 |
| OpenAI response generation (GPT-4o-mini, ~300 tokens) | $0.0001 |
| Google Sheets / Calendar API | $0 (within free tier) |
| WhatsApp Business API outbound | $0.005-0.014 per session |
| n8n self-hosted compute | ~$0.0001 (amortized VPS cost) |
| **Total per conversation** | **~$0.008-0.020** |

**Monthly cost projection** for a clinic processing 150 conversations/day = ~$36-90/month in API costs.

---

## Reliability (90-day production window)

- **Uptime:** 99.4% (workflow execution success rate)
- **Failed message handling:** 0.6% — typically retried automatically; <0.1% required human intervention
- **Common failure modes:**
  - OpenAI rate limit (resolved by retry + backoff)
  - WhatsApp account disconnection (requires client action, not system fault)
  - Google Calendar OAuth token expiry (refresh handled, ~1 manual intervention every 90 days)
  - Malformed webhook payload (logged, ignored, very rare)

---

## Outcome Metrics

These are the metrics the clinic cares about:

| Metric | Before automation | After 30 days | After 90 days |
|---|---|---|---|
| Avg response time to first inquiry | 2-8 hours | <2 minutes | <2 minutes |
| Inquiries handled without human | 0% | 85% | 92% |
| Booking conversion (inquiry → confirmed visit) | ~30% | ~60% | ~70% |
| No-show rate | 18% | 10% | 6% |
| Manual receptionist hours per week | 35-40 hrs | 10-12 hrs | 10-12 hrs |

The 90-day numbers are higher than 30-day because the prompt iteration period (first 30 days) tunes the AI to the specific clinic's tone, services, and dialect quirks.

---

## Capacity Planning Reference

If you're sizing this for a different clinic:

- **Small clinic (< 50 inquiries/day):** Default config is fine. Estimated cost $15-25/month.
- **Medium clinic (50-150 inquiries/day):** Recommended: two OpenAI API keys to spread rate limits. Estimated cost $50-90/month.
- **Large clinic / multi-location (150-500 inquiries/day):** Recommended: queue mode in n8n, dedicated VPS, batched Sheet writes. Estimated cost $150-300/month.

---

## Where this system would NOT scale gracefully

Honest acknowledgment:

1. **Beyond ~1,000 concurrent conversations:** Google Sheets becomes the bottleneck. Migration to a real database (Postgres/MongoDB) becomes necessary.
2. **Beyond ~10,000 messages/day:** Need dedicated rate limit management, possibly multiple n8n workers in queue mode.
3. **Compliance-heavy contexts (HIPAA, GDPR strict mode):** Conversation logging in Google Sheets would need replacement with audit-grade storage.

These are real limits I've reasoned through. If a client asks me to operate at that scale, the architecture changes — and I'd quote the work honestly rather than pretend the current system scales infinitely.
