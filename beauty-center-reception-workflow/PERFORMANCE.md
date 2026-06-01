# Performance Characteristics — Beauty Center AI Reception

Production metrics from beauty centers running the multi-service multi-branch system.

---

## Response Time

| Stage | Typical | P95 |
|---|---|---|
| Inbound → AI reply sent | 60-90 sec | 3 min |
| Service matcher (keyword scoring) | 50 ms | 150 ms |
| Specialist availability calculation | 300 ms | 1 sec |
| Booking creation | 400 ms | 1 sec |
| Preference update | 200 ms | 600 ms |

**User-facing target:** Under 90 seconds. Met 96% of the time.

---

## Service Matching Accuracy

Audit of 500 bookings to verify the matcher chose the right service:

| Outcome | Count | Percentage |
|---|---|---|
| Correct service matched on first message | 432 | 86% |
| Required clarification (ambiguous request) | 53 | 11% |
| Wrong service initially matched (corrected mid-conversation) | 12 | 2% |
| Couldn't match any service (escalated to human) | 3 | 1% |

The 86% first-message match rate handles informal requests like "wash and trim", "lashes for the wedding", "I need my roots done" without translation.

---

## Specialist Selection

For multi-staff centers, specialist matching considers:
- Service qualification (must be able to perform the service)
- Real-time calendar availability
- Client's preferred specialist (if known from history)
- Specialist rating
- Branch (if multi-location)

Outcome from 90 days:
- Clients booked with their preferred specialist when available: **78%**
- Clients accepted alternative specialist when preferred unavailable: **65%**
- Clients deferred to wait for preferred specialist: **35%**

---

## Preference Tracking Outcomes

Over the same 90 days, repeat clients showed:

| Metric | Result |
|---|---|
| Rebook rate within service-specific window | 62% |
| Rebook within first service-aware reminder | 38% |
| Rebook proactive (client initiates) | 44% |
| Client lifetime value (estimated) | +25% vs pre-automation |

The 25% LTV lift is the metric the center owner cares about most. Personal touches (preferred specialist suggestion, service-aware timing) compound over years.

---

## Cost

| Component | Monthly cost |
|---|---|
| OpenAI API | $30-60 |
| WhatsApp Business API | $30-80 |
| n8n self-hosted | $20 |
| Google Workspace | Free tier |
| **Total** | **~$80-160/month** |

Replaces ~25 hours/week of receptionist message handling.

---

## Reliability

- **Uptime:** 99.6%
- **Double bookings created:** 0 (calendar conflict check working)
- **Follow-up sequence cancellations on rebook:** 100%
- **Multi-branch routing accuracy:** 99% (1% manual reassignment needed)

---

## Service-Aware Follow-up Effectiveness

Different services trigger follow-ups at different intervals:

| Service | Follow-up timing | Rebook rate within 14 days of reminder |
|---|---|---|
| Haircut | 4 weeks | 58% |
| Color | 6 weeks | 65% |
| Manicure | 2 weeks | 72% |
| Facial | 6 weeks | 48% |
| Waxing | 3 weeks | 81% |

The 81% rebook rate for waxing reflects high-cadence customer behavior. The 48% for facial reflects that facial is more discretionary. Both numbers inform the center's promotional planning.

---

## Where this hits limits

- **Multi-branch >5 locations:** Routing logic gets complex. Need a top-level dispatcher.
- **Spa-style services with prep time:** Current model assumes contiguous slots. Multi-room with prep would need additional logic.
- **Group bookings (wedding parties, etc.):** Currently routes to human. Could be automated with significant additional work.
