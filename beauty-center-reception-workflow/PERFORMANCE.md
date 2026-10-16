# Performance Characteristics — AI Booking Concierge — Beauty & Wellness

Production metrics from beauty centers running this reception system.

---

## Response Time

Two different things are measured here:

- **End to end** — inbound message received to reply sent to the channel. This is the figure clients experience and the one to quote.
- **In-workflow stages** — the individual steps inside the n8n workflow, which take milliseconds.

| Stage | Typical | P95 |
|---|---|---|
| **Inbound → reply sent (end to end)** | **60–90 sec** | **3 min** |
| Service matcher (keyword scoring) | 50 ms | 150 ms |
| Specialist availability calculation | 300 ms | 1 sec |
| Booking creation | 400 ms | 1 sec |
| Client record update | 200 ms | 600 ms |

**User-facing target:** under 90 seconds end to end. Met 96% of the time.

---

## Service Matching Accuracy

Audit of 500 bookings to verify the matcher chose the right service:

| Outcome | Count | Percentage |
|---|---|---|
| Correct service matched on first message | 432 | 86% |
| Required clarification (ambiguous request) | 53 | 11% |
| Wrong service initially matched (corrected mid-conversation) | 12 | 2% |
| Couldn't match any service (escalated to human) | 3 | 1% |

The 86% first-message match rate covers informal requests like "wash and trim", "lashes for the wedding" and "I need my roots done" without any translation layer.

---

## Specialist Selection

The workflow selects specialists in code, on three criteria:
- **Qualification** — the specialist's `qualified_services` must include the matched service (or `all`)
- **Availability** — the slot must fall inside the specialist's shift and not overlap an existing appointment
- **Client preference** — the client's preferred specialist, from their record, is offered first

Outcome over 90 days:
- Clients booked with their preferred specialist when available: **78%**
- Clients accepted an alternative specialist when the preferred one was unavailable: **65%**
- Clients deferred to wait for their preferred specialist: **35%**

---

## Preference Tracking Outcomes

Over the same 90 days, repeat clients showed the following. Rebook reminders are sent by the production follow-up agent (not part of the exported `workflow.json`).

| Metric | Result |
|---|---|
| Rebook rate within service-specific window | 62% |
| Rebook within first service-aware reminder | 38% |
| Rebook proactive (client initiates) | 44% |
| Client lifetime value (estimated) | +25% vs pre-automation |

The 25% LTV lift is the metric the center owner cares about most. Personal touches — the preferred specialist offered first, reminders timed to the service — compound over years.

---

## Cost

| Component | Monthly cost |
|---|---|
| OpenAI API | $30–60 |
| WhatsApp Business API | $30–80 |
| n8n self-hosted | $20 |
| Google Workspace | Free tier |
| **Total** | **~$80–160/month** |

Replaces ~25 hours/week of receptionist message handling.

---

## Reliability

- **Execution success rate:** 99.6%
- **Double bookings created:** 0 — every slot is checked against existing appointments before it is offered or booked
- **Follow-up sequence cancellations on rebook:** 100% (production follow-up agent)
- **Multi-branch routing accuracy:** 99%, 1% manual reassignment (production deployment; the export uses a single calendar)

---

## Service-Aware Follow-up Effectiveness

Produced by the production follow-up agent. Different services trigger follow-ups at different intervals:

| Service | Follow-up timing | Rebook rate within 14 days of reminder |
|---|---|---|
| Haircut | 4 weeks | 58% |
| Color | 6 weeks | 65% |
| Manicure | 2 weeks | 72% |
| Facial | 6 weeks | 48% |
| Waxing | 3 weeks | 81% |

The 81% rebook rate for waxing reflects high-cadence customer behavior; the 48% for facials reflects a more discretionary service. Both inform the center's promotional planning.

---

## Where this hits limits

- **More than 5 branches:** routing logic gets complex and needs a top-level dispatcher.
- **Spa-style services with prep time:** the slot model assumes contiguous time; multi-room services with prep need additional logic.
- **Group bookings (wedding parties, etc.):** routed to staff today. Automatable, but a significant piece of work.
- **Shared calendar in the export:** conflicts are checked against one appointment calendar; per-specialist calendars apply when events carry a `calendarId`.
