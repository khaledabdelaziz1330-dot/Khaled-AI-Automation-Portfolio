# Code Examples — AI Booking Concierge — Beauty & Wellness

JavaScript, prompts and node configuration taken directly from [`workflow.json`](./workflow.json): service matching, specialist booking with conflict checks, and the client record that personalizes the next visit. Section 5 shows a production component that is not part of the export.

---

## 1. Service Matching from Natural Language

Matches informal requests to the services catalog with deterministic keyword scoring — no model call.

```javascript
// n8n Code Node — Service Matcher
// Fuzzy service matching from user message
const userMsg = $('Normalize Message').first().json.message_text.toLowerCase();
const services = $('Get Services Catalog').all().map(s => s.json);

function scoreService(service) {
  const keywords = [
    service.service_name?.toLowerCase(),
    ...(service.alternate_names || '').toLowerCase().split(',').map(s => s.trim()),
    ...(service.keywords || '').toLowerCase().split(',').map(s => s.trim()),
  ].filter(Boolean);
  
  let score = 0;
  let matched = [];
  keywords.forEach(kw => {
    if (userMsg.includes(kw)) {
      score += kw.length;
      matched.push(kw);
    }
  });
  return { service, score, matchedKeywords: matched };
}

const matches = services
  .map(scoreService)
  .filter(m => m.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 3);

const isAmbiguous = matches.length > 1 && matches[1].score >= matches[0].score * 0.7;

return [{
  json: {
    top_match: matches[0]?.service || null,
    alternative_matches: matches.slice(1).map(m => m.service),
    is_ambiguous: isAmbiguous,
    needs_clarification: !matches[0] || isAmbiguous,
  },
}];
```

---

## 2. AI Conversation Manager — OpenAI Node (gpt-4o)

Receives the matched service, the ambiguity flag and the client record; returns the reply and a structured booking intent as JSON (temperature 0.5, `json_object` response format).

**System prompt:**

```text
You are a warm receptionist at a beauty center. Reply in the same language as the user (Arabic, English, or mix).

Using the matched service and the client's history, write a natural reply that:
- Confirms what service they want
- Asks for preferred date/time if not clear
- If client has a preferred specialist from past visits, offer them first
- Mentions multi-branch options only if client is new
- Brief, warm, professional

Return JSON:
{
  "reply_to_user": "...",
  "booking_ready": <boolean>,
  "requested_service": "...",
  "requested_specialist": "...",
  "requested_date": "YYYY-MM-DD or null",
  "requested_time": "HH:MM or null"
}
```

**User message (n8n expression):**

```text
Service matched: {{ JSON.stringify($('Service Matcher').first().json.top_match) }}
Is ambiguous: {{ $('Service Matcher').first().json.is_ambiguous }}
Client preferences: {{ JSON.stringify($('Get Client (with Preferences)').first()?.json || {}) }}

User message: {{ $('Normalize Message').first().json.message_text }}
```

---

## 3. Specialist Matching with Availability

Filters qualified specialists, puts the client's preferred specialist first, and generates conflict-free slots. The model's output decides only *whether* to book; code decides *who* and *when*.

```javascript
// n8n Code Node — Specialist Match + Availability
// Specialist matching + availability check
const aiResult = JSON.parse($('AI Conversation Manager').first().json.message.content);
const service = $('Service Matcher').first().json.top_match;
const specialists = $('Get Specialists').all().map(s => s.json);
const events = $input.all().map(e => e.json);
const client = $('Get Client (with Preferences)').first()?.json || {};

if (!aiResult.booking_ready || !service) {
  return [{ json: { skip_booking: true, reply: aiResult.reply_to_user } }];
}

// Filter specialists qualified for this service
const qualified = specialists.filter(sp => {
  const services = (sp.qualified_services || '').split(',').map(x => x.trim());
  return services.includes(service.id) || services.includes('all');
});

// Prioritize client's preferred specialist if available
const preferredId = client.preferred_specialist;
const preferred = qualified.find(sp => sp.id === preferredId);
const orderedSpecialists = preferred ? [preferred, ...qualified.filter(sp => sp.id !== preferredId)] : qualified;

const DURATION = service.duration_minutes || 60;

function getAvailableSlots(specialist) {
  const slots = [];
  const now = new Date();
  const requestedDate = aiResult.requested_date ? new Date(aiResult.requested_date) : new Date(now.getTime() + 86400000);
  
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDate = new Date(requestedDate.getTime() + dayOffset * 86400000);
    const dayStart = parseInt(specialist.shift_start || 10);
    const dayEnd = parseInt(specialist.shift_end || 19);
    
    for (let hour = dayStart; hour < dayEnd - (DURATION / 60); hour++) {
      for (let min = 0; min < 60; min += 30) {
        const slotStart = new Date(checkDate);
        slotStart.setHours(hour, min, 0, 0);
        if (slotStart < new Date(now.getTime() + 30 * 60 * 1000)) continue;
        
        const slotEnd = new Date(slotStart.getTime() + DURATION * 60 * 1000);
        
        const conflict = events.some(e => {
          if (e.calendarId && e.calendarId !== specialist.calendar_id) return false;
          const eventStart = new Date(e.start.dateTime).getTime();
          const eventEnd = new Date(e.end.dateTime).getTime();
          return slotStart.getTime() < eventEnd && slotEnd.getTime() > eventStart;
        });
        
        if (!conflict) {
          slots.push({
            start_iso: slotStart.toISOString(),
            end_iso: slotEnd.toISOString(),
            display: slotStart.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
          });
          if (slots.length >= 3) return slots;
        }
      }
    }
  }
  return slots;
}

const withAvailability = orderedSpecialists.map(sp => ({
  specialist: { id: sp.id, name: sp.name, rating: sp.rating },
  available_slots: getAvailableSlots(sp),
})).filter(x => x.available_slots.length > 0);

return [{
  json: {
    skip_booking: withAvailability.length === 0,
    recommended: withAvailability[0] || null,
    alternatives: withAvailability.slice(1, 3),
    reply: aiResult.reply_to_user,
  },
}];
```

---

## 4. Booking and Client Record

`Create Booking` writes the first slot of the recommended specialist. It deliberately has **no** node-level retry, so a timeout can never create a duplicate appointment:

```json
{
  "name": "Create Booking",
  "operation": "create",
  "start": "={{ $json.recommended.available_slots[0].start_iso }}",
  "end": "={{ $json.recommended.available_slots[0].end_iso }}",
  "additionalFields": {
    "summary": "={{ $('Service Matcher').first().json.top_match.service_name }} - {{ $('Get Client (with Preferences)').first()?.json?.name || 'New Client' }}",
    "description": "=Specialist: {{ $json.recommended.specialist.name }}\\nChannel: {{ $('Normalize Message').first().json.channel }}"
  }
}
```

`Update Client Preferences` upserts the client on `user_id`. The booked specialist becomes `preferred_specialist`, which `Specialist Match + Availability` offers first on the next visit:

```json
{
  "name": "Update Client Preferences",
  "operation": "appendOrUpdate",
  "columns": {
    "mappingMode": "defineBelow",
    "value": {
      "user_id": "={{ $('Normalize Message').first().json.user_id }}",
      "name": "={{ $('Get Client (with Preferences)').first()?.json?.name || $('Normalize Message').first().json.user_name || '' }}",
      "channel": "={{ $('Normalize Message').first().json.channel }}",
      "preferred_specialist": "={{ $('Specialist Match + Availability').first().json.recommended.specialist.id }}",
      "last_service": "={{ $('Service Matcher').first().json.top_match.service_name }}",
      "last_booking_start": "={{ $json.start.dateTime }}",
      "total_bookings": "={{ Number($('Get Client (with Preferences)').first()?.json?.total_bookings || 0) + 1 }}",
      "updated_at": "={{ $now.toISO() }}"
    },
    "matchingColumns": [
      "user_id"
    ]
  }
}
```

---

## 5. Smart Follow-up Scheduler — Production Component (not in `workflow.json`)

The production follow-up agent schedules post-visit and rebook messages at service-specific intervals (haircut every 4 weeks, facial every 6, etc.). It is client-specific and not part of the export; it is shown because it produces the follow-up figures in [`PERFORMANCE.md`](./PERFORMANCE.md).

```javascript
// n8n Code Node — Follow-up Scheduler (production deployment)

const completedBooking = $input.first().json;
const serviceFollowupRules = {
  'haircut': { days: 28, message_template: 'haircut_followup' },
  'color': { days: 42, message_template: 'color_followup' },
  'manicure': { days: 14, message_template: 'manicure_followup' },
  'facial': { days: 42, message_template: 'facial_followup' },
  'massage': { days: 30, message_template: 'massage_followup' },
  'waxing': { days: 21, message_template: 'waxing_followup' },
  'lashes': { days: 21, message_template: 'lashes_followup' },
};

const rule = serviceFollowupRules[completedBooking.service_category] || { days: 30, message_template: 'general_followup' };
const followupDate = new Date(new Date(completedBooking.end_datetime).getTime() + rule.days * 86400000);

// Returning clients get gentle reminders, new clients get more touchpoints
const isActiveClient = completedBooking.client_total_visits > 1;

const scheduledMessages = [];

// Post-visit thank you (2 hours after)
scheduledMessages.push({
  type: 'post_visit_thanks',
  send_at: new Date(new Date(completedBooking.end_datetime).getTime() + 2 * 60 * 60 * 1000).toISOString(),
  template: 'thanks_and_review_request',
  channel: completedBooking.channel,
});

// Follow-up reminder (service-specific timing)
scheduledMessages.push({
  type: 'rebook_reminder',
  send_at: followupDate.toISOString(),
  template: rule.message_template,
  channel: completedBooking.channel,
  cancellation_triggers: ['client_rebooks', 'client_unsubscribes', 'manual_cancel'],
});

// For new clients, additional check-in 7 days later
if (!isActiveClient) {
  scheduledMessages.push({
    type: 'satisfaction_check',
    send_at: new Date(new Date(completedBooking.end_datetime).getTime() + 7 * 86400000).toISOString(),
    template: 'new_client_followup',
    channel: completedBooking.channel,
  });
}

return scheduledMessages.map((m) => ({ json: { ...m, client_id: completedBooking.client_id, booking_id: completedBooking.id } }));
```

---

## Design principles demonstrated

1. **Deterministic matching** — informal language and aliases scored in code, ambiguity flagged rather than guessed
2. **Model decides intent, code decides the booking** — qualification, preference order and conflict checks are all code
3. **Preference carried forward** — each booking sets the specialist offered first next time
4. **Idempotent records, non-retried writes** — clients upserted on `user_id`; the calendar write never retries
5. **Service-aware follow-up cadence** — different timing per service type (production follow-up layer)
