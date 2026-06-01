# Code Examples — Holistic Wellness Club (GHL + n8n)

Production code from the dual-system architecture: GoHighLevel handles the client-facing journey, n8n handles backend reliability and event logging.

---

## 1. GHL Webhook Receiver and Event Normalizer

GoHighLevel sends webhooks for every pipeline change. This normalizes them into a consistent event schema.

```javascript
// n8n Code Node — GHL Event Normalizer

const ghlPayload = $input.first().json;

// GHL sends different webhook structures for different events
// Normalize into consistent schema

const eventTypeMap = {
  'ContactCreate': 'lead.created',
  'ContactUpdate': 'lead.updated',
  'OpportunityCreate': 'booking.created',
  'OpportunityStatusChange': 'booking.status_changed',
  'AppointmentCreate': 'appointment.created',
  'AppointmentStatusUpdate': 'appointment.status_changed',
};

const normalizeEvent = (payload) => {
  const eventType = eventTypeMap[payload.type] || `ghl.${payload.type}`;
  
  return {
    event_id: payload.id || crypto.randomUUID(),
    event_type: eventType,
    event_timestamp: payload.dateAdded || payload.dateUpdated || new Date().toISOString(),
    
    contact: {
      id: payload.contactId || payload.contact?.id,
      name: payload.contact?.firstName ? `${payload.contact.firstName} ${payload.contact.lastName || ''}`.trim() : null,
      email: payload.contact?.email,
      phone: payload.contact?.phone,
    },
    
    opportunity: payload.opportunity ? {
      id: payload.opportunity.id,
      pipeline_id: payload.opportunity.pipelineId,
      stage_id: payload.opportunity.pipelineStageId,
      stage_name: payload.opportunity.pipelineStageName,
      value: payload.opportunity.monetaryValue,
    } : null,
    
    appointment: payload.appointment ? {
      id: payload.appointment.id,
      start_time: payload.appointment.startTime,
      end_time: payload.appointment.endTime,
      status: payload.appointment.appointmentStatus,
      assigned_to: payload.appointment.assignedUserId,
    } : null,
    
    raw_payload: payload, // for debugging
  };
};

return [{ json: normalizeEvent(ghlPayload) }];
```

---

## 2. Pipeline Stage Logger with Idempotency

Logs every pipeline stage change, with idempotency to handle GHL webhook retries.

```javascript
// n8n Code Node — Idempotent Event Logger

const event = $input.first().json;
const existingEvents = $('Get Recent Events').all();

// Idempotency check: GHL sometimes retries webhooks
// Use event_id + timestamp to detect duplicates

const isDuplicate = existingEvents.some((existing) => {
  return (
    existing.json.event_id === event.event_id ||
    (existing.json.contact?.id === event.contact?.id &&
      existing.json.event_type === event.event_type &&
      Math.abs(new Date(existing.json.event_timestamp).getTime() - new Date(event.event_timestamp).getTime()) < 5000)
  );
});

if (isDuplicate) {
  return [{
    json: { ...event, _idempotency: 'duplicate_skipped' },
  }];
}

// Compute derived fields for reporting
const enriched = {
  ...event,
  derived: {
    day_of_week: new Date(event.event_timestamp).getDay(),
    hour_of_day: new Date(event.event_timestamp).getHours(),
    is_business_hours: isBusinessHours(event.event_timestamp),
    funnel_position: getFunnelPosition(event.opportunity?.stage_name),
  },
  _logged_at: new Date().toISOString(),
};

function isBusinessHours(timestamp) {
  const date = new Date(timestamp);
  const day = date.getDay();
  const hour = date.getHours();
  return day >= 1 && day <= 5 && hour >= 9 && hour < 19;
}

function getFunnelPosition(stageName) {
  const order = ['New Lead', 'Contacted', 'Hot', 'Booking Confirmed', 'Attended', 'No-show', 'Cancelled'];
  return order.indexOf(stageName);
}

return [{ json: enriched }];
```

---

## 3. KPI Snapshot Generator

Daily snapshot of key metrics aggregated from event log.

```javascript
// n8n Code Node — Daily KPI Snapshot

const events = $('Get Today Events').all();
const yesterday = $('Get Yesterday Events').all();

function countByEventType(eventList, type) {
  return eventList.filter((e) => e.json.event_type === type).length;
}

function countByStage(eventList, stage) {
  return eventList.filter((e) => e.json.opportunity?.stage_name === stage).length;
}

function avgTimeToBooking(eventList) {
  const bookings = eventList.filter((e) => e.json.event_type === 'booking.created');
  if (bookings.length === 0) return null;
  
  const times = bookings.map((b) => {
    const contact = b.json.contact;
    const leadEvent = eventList.find(
      (e) => e.json.contact?.id === contact.id && e.json.event_type === 'lead.created'
    );
    if (!leadEvent) return null;
    return new Date(b.json.event_timestamp) - new Date(leadEvent.json.event_timestamp);
  }).filter(Boolean);
  
  if (times.length === 0) return null;
  const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
  return Math.round(avgMs / 1000 / 60); // minutes
}

const snapshot = {
  snapshot_date: new Date().toISOString().slice(0, 10),
  
  leads: {
    new_today: countByEventType(events, 'lead.created'),
    new_yesterday: countByEventType(yesterday, 'lead.created'),
  },
  
  bookings: {
    created_today: countByEventType(events, 'booking.created'),
    attended_today: countByEventType(events, 'booking.status_changed') ? 
      events.filter((e) => e.json.opportunity?.stage_name === 'Attended').length : 0,
    no_shows_today: events.filter((e) => e.json.opportunity?.stage_name === 'No-show').length,
  },
  
  funnel_health: {
    new_leads: countByStage(events, 'New Lead'),
    hot_leads: countByStage(events, 'Hot'),
    booked: countByStage(events, 'Booking Confirmed'),
  },
  
  metrics: {
    avg_time_from_lead_to_booking_minutes: avgTimeToBooking(events),
    no_show_rate: bookings_today > 0 ? events.filter((e) => e.json.opportunity?.stage_name === 'No-show').length / bookings_today : null,
  },
};

return [{ json: snapshot }];
```

---

## 4. Tiered Reminder Scheduler

Schedules reminders at 24-hour and 2-hour intervals before appointments.

```javascript
// n8n Code Node — Tiered Reminder Builder

const event = $input.first().json;

if (event.event_type !== 'appointment.created') {
  return [];
}

const appointmentStart = new Date(event.appointment.start_time);
const now = new Date();

const reminders = [];

// 24-hour reminder
const reminder24h = new Date(appointmentStart.getTime() - 24 * 60 * 60 * 1000);
if (reminder24h > now) {
  reminders.push({
    type: '24_hour_reminder',
    send_at: reminder24h.toISOString(),
    contact_id: event.contact.id,
    appointment_id: event.appointment.id,
    message_template: '24h_reminder_template',
  });
}

// 2-hour reminder
const reminder2h = new Date(appointmentStart.getTime() - 2 * 60 * 60 * 1000);
if (reminder2h > now) {
  reminders.push({
    type: '2_hour_reminder',
    send_at: reminder2h.toISOString(),
    contact_id: event.contact.id,
    appointment_id: event.appointment.id,
    message_template: '2h_reminder_template',
  });
}

// Post-visit follow-up (2 hours after appointment end)
const followUp = new Date(new Date(event.appointment.end_time).getTime() + 2 * 60 * 60 * 1000);
reminders.push({
  type: 'post_visit_followup',
  send_at: followUp.toISOString(),
  contact_id: event.contact.id,
  appointment_id: event.appointment.id,
  message_template: 'review_request_template',
});

return reminders.map((r) => ({ json: r }));
```

---

## Design principles demonstrated

1. **GHL as front, n8n as backend** — leverages each tool's strengths
2. **Idempotency for webhook reliability** — handles GHL's retry behavior
3. **Event sourcing pattern** — every change logged with full context
4. **Tiered reminders** — different messages at different intervals
5. **KPI snapshots** — observability without heavy BI tools
