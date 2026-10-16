# Performance Characteristics — Fitness Lead-to-Member Pipeline

Production metrics from a single gym location running this pipeline for 90 days.

---

## Response Time

Two different things are measured here:

- **End to end** — inbound message received to reply sent to the channel. This is the figure the gym experiences and the one to quote.
- **In-workflow processing** — the individual stages inside the n8n workflow, which take seconds.

| Stage | Typical | P95 |
|---|---|---|
| **Inbound message → reply sent (end to end)** | **60–90 sec** | **3 min** |
| Lead record lookup | 200 ms | 600 ms |
| AI qualification (gpt-4o) | 1–2 sec | 5 sec |
| Trial booking creation | 500 ms | 1.5 sec |

**User-facing target:** under 90 seconds end to end. Met 95% of the time.

---

## Pipeline Conversion Rates

Funnel from one gym over 90 days:

| Stage | Count | Conversion |
|---|---|---|
| Inbound messages | 1,450 | — |
| Qualified leads (Hot) | 870 | 60% |
| Trial bookings made | 522 | 60% of qualified |
| Trial attendees | 392 | 75% of bookings |
| Member conversions | 137 | 35% of attendees |
| **End-to-end (inbound → member)** | **137** | **9.4%** |

That is ~483 inbound messages and ~46 new members per month at one location.

---

## No-show Recovery Effectiveness

Produced by the production follow-up agent (not part of the exported `workflow.json`):

| Outcome | Count (90 days) | Percentage |
|---|---|---|
| Trial booked | 522 | 100% |
| Trial attended | 392 | 75% |
| No-show | 130 | 25% |
| **Of no-shows: re-engaged successfully** | **26** | **20%** |
| **Of re-engaged: ultimately attended trial** | **18** | **69%** |

The 3-step recovery sequence brings ~14% of no-shows (18 of 130) back to an attended trial. Without it, those leads would be lost.

---

## Cost

| Component | Monthly cost |
|---|---|
| OpenAI API (~1,500 messages/month) | $25–50 |
| WhatsApp Business API | $30–80 |
| n8n self-hosted | $20 |
| Google Workspace | Free tier |
| **Total** | **~$75–150/month per gym** |

Replaces ~30 hours/week of front-desk message handling.

---

## Reliability

- **Execution success rate:** 99.5%
- **Trial bookings over capacity:** 0 — the per-slot cap is enforced in code before any booking is written
- **Reminders sent on schedule:** 99.8% (production follow-up agent)
- **Follow-up sequences cancelled on conversion:** 100% (production follow-up agent) — no "still messaging you after you became a member"

---

## What the gym owner sees

Daily KPI digest at 6 AM, generated from the lead sheet by the production deployment:

```
Yesterday's inbound:    18 messages
Qualified (Hot):        12 leads
Trial bookings:          7 (of 12 qualified, 58%)
Trial attendance:        5 (of 7 booked, 71%)
New members:             2

Weekly trend:
- Inbound: 96 (vs 88 last week, +9%)
- Member conversions: 14 (vs 11 last week, +27%)

Pipeline health:
- Pending follow-ups: 23
- Pending trial confirmations: 7
- At-risk (no response 3+ days): 5
```

---

## Where this hits limits

- **Multi-location franchise:** the current setup is single-location; multi-gym needs branch routing.
- **Highly seasonal peaks (January rush):** trial class caps fill up; the slot schedule needs expanding for high-volume periods.
- **No open slot within 7 days:** the export has no waitlist branch — the booking step fails loudly and the shared error handler alerts staff. An explicit no-availability reply is the next improvement.
