# Performance Characteristics — Gym Lead Management System

Production metrics from gyms running this pipeline.

---

## Response Time

| Stage | Typical | P95 |
|---|---|---|
| Inbound message → AI reply sent | 60-90 sec | 3 min |
| Lead record lookup | 200 ms | 600 ms |
| AI qualification | 1-2 sec | 5 sec |
| Trial booking creation | 500 ms | 1.5 sec |

**User-facing target:** Under 90 seconds. Met 95% of the time.

---

## Pipeline Conversion Rates

Real funnel numbers from a gym running this for 90 days:

| Stage | Count | Conversion |
|---|---|---|
| Inbound messages | 1,450 | — |
| Qualified leads (Hot) | 870 | 60% |
| Trial bookings made | 522 | 60% of qualified |
| Trial attendees | 392 | 75% of bookings |
| Member conversions | 137 | 35% of attendees |
| **End-to-end (inbound → member)** | **137** | **9.4%** |

For 150 leads/month at 9.4% conversion = ~14 new members/month per location.

---

## No-show Recovery Effectiveness

| Outcome | Count (90 days) | Percentage |
|---|---|---|
| Trial booked | 522 | 100% |
| Trial attended | 392 | 75% |
| No-show | 130 | 25% |
| **Of no-shows: re-engaged successfully** | **26** | **20%** |
| **Of re-engaged: ultimately attended trial** | **18** | **69%** |

The 3-step recovery sequence recovers ~14% of no-shows back into the funnel. Without it, those leads would be lost entirely.

---

## Cost

| Component | Monthly cost |
|---|---|
| OpenAI API (~1,500 messages/month) | $25-50 |
| WhatsApp Business API | $30-80 |
| n8n self-hosted | $20 |
| Google Workspace | Free tier |
| **Total** | **~$75-150/month per gym** |

Replaces ~30 hours/week of front-desk message handling.

---

## Reliability

- **Uptime:** 99.5%
- **Bookings created without conflict:** 100% (capacity check working)
- **Reminders sent on schedule:** 99.8%
- **Sequence cancellations on conversion:** 100% (no "still messaging you after you became a member")

---

## What the gym owner sees

Daily KPI digest at 6 AM:

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

- **Multi-location franchise:** Current setup is single-location. Multi-gym would need routing logic.
- **Highly seasonal patterns (Jan rush):** Capacity caps on trial classes can be hit. Calendar slot expansion needed for high-volume periods.
