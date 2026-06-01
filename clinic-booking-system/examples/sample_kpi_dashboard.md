# Sample KPI Dashboard

The Google Sheets dashboard the clinic owner sees. Auto-refreshes daily at 6 AM. Sanitized snapshot from a real deployment.

---

## Daily Snapshot — Monday, April 22, 2026

### Today vs Yesterday

| Metric | Today | Yesterday | Δ |
|---|---|---|---|
| New inquiries received | 23 | 19 | +21% |
| Bookings created | 12 | 9 | +33% |
| Bookings attended | 11 | 10 | +10% |
| No-shows | 1 | 0 | +1 |
| Avg response time | 1.2 sec | 1.4 sec | -14% |
| Total AI cost today | $0.34 | $0.27 | +26% |

---

### Weekly Trends (Last 7 Days)

```
Day        Inq  Bkd  Att  N/S
─────────────────────────────
Mon 4/22   23   12   11   1
Sun 4/21   19    9   10   0
Sat 4/20   31   18   16   2
Fri 4/19   28   16   15   1
Thu 4/18   25   14   13   1
Wed 4/17   22   13   12   1
Tue 4/16   24   15   13   2
─────────────────────────────
WEEK       172  97   90   8
vs prev    +12% +18% +20% -33%
```

---

### Channel Performance (Last 7 Days)

| Channel | Inquiries | Conversion to Booking |
|---|---|---|
| WhatsApp | 78 (45%) | 62% |
| Instagram DM | 47 (27%) | 51% |
| Facebook Messenger | 31 (18%) | 58% |
| Telegram | 16 (9%) | 71% |

**Insight:** Telegram users convert highest (likely warmer audience), but volume is lowest. WhatsApp is the workhorse.

---

### Funnel Health (Current State)

```
Awaiting AI response:       0    ✓
Pending human follow-up:    3    (oldest: 47 min ago)
Confirmed bookings today:  12    
Reminded 24h:             8
Reminded 2h:              3
Post-visit follow-ups due: 5    
```

---

### Service Mix (Last 30 Days)

| Service | Bookings | % |
|---|---|---|
| Cleaning | 142 | 38% |
| Consultation | 89 | 24% |
| Filling | 67 | 18% |
| Whitening | 41 | 11% |
| Other | 30 | 8% |

---

### AI Quality Indicators

| Metric | Today | 30-day avg |
|---|---|---|
| Conversations needing human handoff | 3 (13%) | 11% |
| Hallucination flags (audit) | 0 | 0.2% |
| Avg conversation turns to booking | 3.8 | 4.1 |
| Customer satisfaction (post-visit survey) | 4.6/5 | 4.5/5 |

---

### Alerts in Last 24 Hours

```
🟡 04:23 AM — OpenAI rate limit briefly hit, auto-recovered
🟡 09:17 AM — One WhatsApp message delayed 90 seconds (queue spike)
─────────────────────────────
No critical alerts.
```

---

### Cost Tracker (Month-to-Date)

```
Day 22 of April:
─────────────────
Inquiries processed:       512
AI cost (OpenAI):       $11.43
WhatsApp Business:      $24.18
Sheets/Calendar:        $0
Subtotal:               $35.61

Projected month-end:    ~$48
Budget:                 $75
Status:                 ✓ Under budget
```

---

### What the owner does with this

The daily digest takes 2 minutes to scan. Owner:
1. Checks no critical alerts (red)
2. Notes funnel health (any pending follow-ups due)
3. Watches weekly trend (is volume growing?)
4. Reviews monthly cost vs budget

When something needs attention, it's flagged. Otherwise, the system runs and the owner runs the business.

---

### What this dashboard intentionally does NOT do

- ❌ Does not require login (Sheet shared with owner via Google Workspace)
- ❌ Does not require mobile app (works in any browser)
- ❌ Does not surface every metric (only what informs decisions)
- ❌ Does not bury alerts in long reports (alerts at the top)

The dashboard is built for someone who runs a clinic, not for someone who loves data.
