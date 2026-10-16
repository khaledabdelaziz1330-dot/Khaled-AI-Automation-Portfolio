# Code Examples — Client Lifecycle System — Wellness Club (GoHighLevel + n8n)

Code taken directly from [`workflow.json`](workflow.json), the n8n event logger and reminder scheduler. GoHighLevel handles the client-facing journey; this workflow handles backend reliability and event logging.

---

## 1. GHL Event Normalizer

GoHighLevel sends different payload shapes for contacts, opportunities, and appointments. This Code node maps them to one schema so every downstream node handles a single shape.

```javascript
// n8n Code Node — Normalize Event

// Normalize GHL event to consistent schema
const payload = $input.first().json.body || $input.first().json;

const eventTypeMap = {
  'ContactCreate': 'lead.created',
  'ContactUpdate': 'lead.updated',
  'OpportunityCreate': 'opportunity.created',
  'OpportunityStatusChange': 'opportunity.status_changed',
  'AppointmentCreate': 'appointment.created',
  'AppointmentStatusUpdate': 'appointment.status_changed',
  'AppointmentCancel': 'appointment.cancelled',
};

const eventType = eventTypeMap[payload.type] || `ghl.${payload.type || 'unknown'}`;

const normalized = {
  event_id: payload.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  event_type: eventType,
  event_timestamp: payload.dateAdded || payload.dateUpdated || new Date().toISOString(),
  
  contact: {
    id: payload.contactId || payload.contact?.id || null,
    name: payload.contact?.firstName ? `${payload.contact.firstName} ${payload.contact.lastName || ''}`.trim() : null,
    email: payload.contact?.email || null,
    phone: payload.contact?.phone || null,
    tags: payload.contact?.tags || [],
  },
  
  opportunity: payload.opportunity ? {
    id: payload.opportunity.id,
    pipeline_id: payload.opportunity.pipelineId,
    stage_id: payload.opportunity.pipelineStageId,
    stage_name: payload.opportunity.pipelineStageName,
    value: payload.opportunity.monetaryValue,
    status: payload.opportunity.status,
  } : null,
  
  appointment: payload.appointment ? {
    id: payload.appointment.id,
    start_time: payload.appointment.startTime,
    end_time: payload.appointment.endTime,
    status: payload.appointment.appointmentStatus,
    assigned_to: payload.appointment.assignedUserId,
    title: payload.appointment.title || payload.appointment.appointmentTitle,
  } : null,
  
  raw_payload_excerpt: JSON.stringify(payload).slice(0, 1000),
};

return [{ json: normalized }];
```

---

## 2. Idempotency Check and Enrichment

Runs after the **Check Duplicates** Google Sheets lookup (`event_id` in the AllEvents tab). Duplicates are flagged and short-circuited to the webhook response; new events get derived fields that keep sheet-side reporting simple.

```javascript
// n8n Code Node — Enrich & Idempotency

// Idempotency check + business hours flag
const event = $('Normalize Event').item.json;
const existing = $input.all();

const isDuplicate = existing.some(e => e.json.event_id === event.event_id);

if (isDuplicate) {
  return [{ json: { ...event, _skip_reason: 'duplicate_event', _processed: false } }];
}

// Compute derived fields
const date = new Date(event.event_timestamp);
const day = date.getDay();
const hour = date.getHours();

// Stage names as configured in the GHL pipelines (Leads + Bookings)
const funnelOrder = ['New Lead', 'Hot lead', 'cold lead', 'Appointment confirmed', 'Attended / feedback sent', 'No shows', 'Cancelled'];
const funnelPosition = event.opportunity?.stage_name ? funnelOrder.indexOf(event.opportunity.stage_name) : -1;

return [{
  json: {
    ...event,
    derived: {
      day_of_week: day,
      hour_of_day: hour,
      is_business_hours: day >= 1 && day <= 5 && hour >= 9 && hour < 19,
      funnel_position: funnelPosition,
      week_iso: `${date.getFullYear()}-W${Math.ceil((date.getDate() + new Date(date.getFullYear(), 0, 1).getDay()) / 7).toString().padStart(2, '0')}`,
    },
    _processed: true,
    _logged_at: new Date().toISOString(),
  },
}];
```

The next node, **Not Duplicate?**, passes only events with `_processed: true` to the router.

---

## 3. Event Routing

**Route by Event Type** is a Switch node rather than code. Its outputs map directly to log sheets:

| Output | Condition | Destination |
|---|---|---|
| `appointment_created` | `event_type == appointment.created` | Bookings_Log + Build Reminders |
| `lead_created` | `event_type == lead.created` | Leads_Log |
| `opp_status_changed` | `event_type == opportunity.status_changed` | Pipeline_Changes |
| Fallback | Any other event type | Pipeline_Changes |

The fallback output means no event type is silently dropped.

---

## 4. Tiered Reminder Builder

Computes the 24-hour, 2-hour, and post-visit touchpoints for each new appointment. **Queue Reminders** appends them to the ScheduledMessages sheet; message delivery is handled by the GHL Appointment Confirmation + Reminders workflow.

```javascript
// n8n Code Node — Build Reminders

// Build 24h + 2h + post-visit reminder schedule
const event = $input.first().json;

if (!event.appointment || !event.appointment.start_time) {
  return [];
}

const apptStart = new Date(event.appointment.start_time);
const apptEnd = new Date(event.appointment.end_time || apptStart.getTime() + 60 * 60 * 1000);
const now = new Date();

const reminders = [];

const r24 = new Date(apptStart.getTime() - 24 * 60 * 60 * 1000);
if (r24 > now) {
  reminders.push({
    type: 'reminder_24h',
    send_at: r24.toISOString(),
    contact_id: event.contact.id,
    appointment_id: event.appointment.id,
    template_key: 'reminder_24h',
  });
}

const r2 = new Date(apptStart.getTime() - 2 * 60 * 60 * 1000);
if (r2 > now) {
  reminders.push({
    type: 'reminder_2h',
    send_at: r2.toISOString(),
    contact_id: event.contact.id,
    appointment_id: event.appointment.id,
    template_key: 'reminder_2h',
  });
}

const postVisit = new Date(apptEnd.getTime() + 2 * 60 * 60 * 1000);
reminders.push({
  type: 'post_visit_review',
  send_at: postVisit.toISOString(),
  contact_id: event.contact.id,
  appointment_id: event.appointment.id,
  template_key: 'post_visit_review',
});

return reminders.map(r => ({ json: r }));
```

---

## Design principles demonstrated

1. **GHL as front, n8n as backend** — leverages each tool's strengths
2. **Idempotency for webhook reliability** — handles GHL's retry behavior
3. **Event sourcing pattern** — every event logged with normalized context and a raw-payload excerpt
4. **Explicit routing with a fallback** — every event type lands somewhere
5. **Tiered reminders** — past-due touchpoints skipped, sensible default duration
