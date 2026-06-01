# Performance Characteristics — Wellness Club GHL + n8n System

Production metrics from a wellness club running the full ecosystem.

---

## Webhook Processing

| Stage | Typical | P95 |
|---|---|---|
| GHL webhook receive → normalized | 100 ms | 250 ms |
| Idempotency check (Sheets lookup) | 200 ms | 600 ms |
| Event logging | 300 ms | 800 ms |
| Reminder scheduling (when applicable) | 50 ms | 150 ms |

**End-to-end webhook handling:** Under 1 second average.

---

## Volume

- **GHL webhooks received per day:** 50-200 (events across the full client journey)
- **Bookings tracked per day:** 15-40
- **Reminders scheduled per day:** 30-80 (most have both 24h and 2h)
- **Errors per day:** <1 average

---

## Operational Outcomes

The wellness club's actual metrics over 90 days:

| Metric | Before automation | After |
|---|---|---|
| Manual front-desk hours per week | 40 | 12 |
| Booking confirmation latency | 4-8 hours | <5 min |
| 24-hour reminder send rate | 60% (manual) | 100% (automated) |
| No-show rate | 22% | 8% |
| Review request response rate | 8% | 24% |
| Re-engagement (no-show → re-booked) | 5% | 18% |

---

## Cost

| Component | Monthly cost |
|---|---|
| GoHighLevel subscription | $97-297 (depends on tier) |
| n8n self-hosted VPS | $20 |
| Google Workspace | Free tier |
| WhatsApp Business API | $30-80 (volume-based) |
| **Total** | **~$150-400/month** |

Compare to: $2,500/month for a part-time front-desk person who works 8 hours, 5 days a week.

---

## Reliability

- **Uptime:** 99.7% over 6 months
- **GHL webhook duplicates handled correctly:** 100% (idempotency layer)
- **Reminders sent on schedule:** 99.4%
- **Errors caught and reported:** 100% (error trigger on every workflow)

---

## What the dashboard shows the owners

KPI sheet auto-updates daily with:

```
Today's leads:        5    (vs yesterday: 3)
Today's bookings:     8    (vs yesterday: 6)
Today's no-shows:     1    (vs avg: 1.2)
Avg time to booking: 4 hrs (vs avg: 5 hrs)
Active funnel:
  - New Lead:       12
  - Hot:            8
  - Booked:         24
  - Members:        N/A
Weekly trend: UP 12% vs last week
```

Owners check this once a day, run the business. The automation runs the operations.

---

## Where this hits limits

- **Beyond 500 active members:** Sheet-based reporting starts to lag. Migrate KPIs to Metabase or similar.
- **Multi-location chains:** Current setup is single-location. Multi-location would need a routing layer above GHL.
- **HIPAA/GDPR strict mode:** Wellness clubs are usually exempt, but if operating in a regulated jurisdiction, conversation storage needs upgrade.
