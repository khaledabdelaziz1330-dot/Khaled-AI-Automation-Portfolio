# Code Examples — Gym Lead Management System

Prompts, JavaScript and node configuration taken directly from [`workflow.json`](./workflow.json): multi-channel inbound → AI qualification → trial booking → lead record. Section 4 shows a production component that is not part of the export.

---

## 1. Lead Qualification — OpenAI Node (gpt-4o)

One call per turn returns the reply, the collected fields, a booking-ready flag and a detected intent as JSON (temperature 0.5, `json_object` response format).

**System prompt:**

```text
You are a friendly gym receptionist gathering qualification info for new leads.

Goals in order:
1. Greet warmly if first message
2. Collect: fitness goals, experience level, preferred training time, preferred location (if applicable)
3. Once enough info collected, offer a free trial class booking

Tone: Warm, energetic, not pushy. Match the language the user wrote in (Arabic or English).

Hard rules:
- Never promise specific results ("you'll lose 20 lbs")
- Never quote membership prices (route to sales team)
- Never claim medical/health expertise
- Offer human handoff if user seems frustrated

Return JSON:
{
  "ready_to_book": <boolean>,
  "collected_info": {
    "name": "...",
    "phone": "...",
    "goals": "...",
    "experience": "...",
    "preferred_time": "..."
  },
  "reply_to_user": "...",
  "detected_intent": "<greeting | qualifying | booking_ready | complaint | other>"
}
```

**User message (n8n expression) — existing lead record, last 5 turns, latest message:**

```text
Existing lead record: {{ JSON.stringify($('Get Lead Record').first()?.json || {}) }}
Recent conversation:
{{ $('Get Conversation History').all().slice(-5).map(m => `${m.json.direction}: ${m.json.message_text}`).join('\n') }}

Latest message: {{ $('Normalize Message').first().json.message_text }}
```

---

## 2. Pipeline Status Updater — Deterministic State Machine

The model reports an intent; code decides the status. Unknown intents (`complaint`, `other`) leave the status unchanged.

```javascript
// n8n Code Node — Update Pipeline Status
// Lead status state machine
const aiResult = JSON.parse($input.first().json.message.content);
const lead = $('Get Lead Record').first()?.json || {};
const currentStatus = lead.status || 'New';

const transitions = {
  'New': {
    'greeting': 'New',
    'qualifying': 'New',
    'booking_ready': 'Hot',
  },
  'Hot': {
    'booking_ready': 'Hot',
    'qualifying': 'Hot',
  },
  'Trial Booked': {
    'qualifying': 'Trial Booked',
  },
};

const newStatus = transitions[currentStatus]?.[aiResult.detected_intent] || currentStatus;

return [{
  json: {
    user_id: $('Normalize Message').first().json.user_id,
    channel: $('Normalize Message').first().json.channel,
    previous_status: currentStatus,
    new_status: newStatus,
    status_changed: newStatus !== currentStatus,
    ai_result: aiResult,
    collected_info: aiResult.collected_info,
    reply_text: aiResult.reply_to_user,
    ready_to_book: aiResult.ready_to_book,
    updated_at: new Date().toISOString(),
  },
}];
```

This workflow writes `New`, `Hot` and `Trial Booked`. Later statuses (`Attended Trial`, `Member`, `Lost`) are set downstream by the production follow-up agent or by staff.

---

## 3. Trial Class Booking — Capacity Enforced in Code

`Get Trial Class Slots` reads the next 7 days of the trial calendar. `Find Available Slots` applies the fixed weekly schedule and the per-slot cap:

```javascript
// n8n Code Node — Find Available Slots
// Find available trial class slots
const events = $input.all().map(e => e.json);

const TRIAL_SLOTS = {
  1: [9, 11, 17, 19], // Monday
  2: [9, 11, 17, 19], // Tuesday
  3: [9, 11, 17, 19], // Wednesday
  4: [9, 11, 17, 19], // Thursday
  5: [9, 11, 17, 19], // Friday
  6: [10, 12, 14],   // Saturday
  0: [10, 12, 14],   // Sunday
};
const MAX_PER_SLOT = 5;

function countAttendees(slotStartISO, events) {
  return events.filter(e => {
    const eventStart = new Date(e.start.dateTime).getTime();
    const target = new Date(slotStartISO).getTime();
    return Math.abs(eventStart - target) < 60000;
  }).length;
}

const now = new Date();
const availableSlots = [];

for (let dayOffset = 1; dayOffset <= 7 && availableSlots.length < 5; dayOffset++) {
  const date = new Date(now.getTime() + dayOffset * 86400000);
  const dayHours = TRIAL_SLOTS[date.getDay()] || [];
  
  for (const hour of dayHours) {
    const slot = new Date(date);
    slot.setHours(hour, 0, 0, 0);
    
    if (countAttendees(slot.toISOString(), events) < MAX_PER_SLOT) {
      availableSlots.push({
        start_iso: slot.toISOString(),
        end_iso: new Date(slot.getTime() + 60 * 60 * 1000).toISOString(),
        display: slot.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
      });
    }
  }
}

return [{
  json: {
    available_slots: availableSlots.slice(0, 3),
    has_availability: availableSlots.length > 0,
  },
}];
```

`Book Trial Class` writes the earliest open slot to Google Calendar. It deliberately has **no** node-level retry, so a timeout can never create a duplicate event:

```json
{
  "name": "Book Trial Class",
  "operation": "create",
  "start": "={{ $json.available_slots[0].start_iso }}",
  "end": "={{ $json.available_slots[0].end_iso }}",
  "additionalFields": {
    "summary": "=Trial Class - {{ $('Update Pipeline Status').first().json.collected_info.name }}",
    "description": "=Lead from {{ $('Update Pipeline Status').first().json.channel }}\\nGoals: {{ $('Update Pipeline Status').first().json.collected_info.goals }}\\nPhone: {{ $('Update Pipeline Status').first().json.collected_info.phone }}"
  }
}
```

`Save Lead Record` upserts the lead on `user_id`. Status becomes `Trial Booked` whenever the booking branch ran:

```json
{
  "name": "Save Lead Record",
  "operation": "appendOrUpdate",
  "columns": {
    "mappingMode": "defineBelow",
    "value": {
      "user_id": "={{ $('Update Pipeline Status').first().json.user_id }}",
      "channel": "={{ $('Update Pipeline Status').first().json.channel }}",
      "status": "={{ $('Book Trial Class').isExecuted ? 'Trial Booked' : $('Update Pipeline Status').first().json.new_status }}",
      "name": "={{ $('Update Pipeline Status').first().json.collected_info?.name || '' }}",
      "phone": "={{ $('Update Pipeline Status').first().json.collected_info?.phone || '' }}",
      "goals": "={{ $('Update Pipeline Status').first().json.collected_info?.goals || '' }}",
      "experience": "={{ $('Update Pipeline Status').first().json.collected_info?.experience || '' }}",
      "preferred_time": "={{ $('Update Pipeline Status').first().json.collected_info?.preferred_time || '' }}",
      "trial_start": "={{ $('Book Trial Class').isExecuted ? $('Book Trial Class').first().json.start.dateTime : '' }}",
      "updated_at": "={{ $('Update Pipeline Status').first().json.updated_at }}"
    },
    "matchingColumns": [
      "user_id"
    ]
  }
}
```

---

## 4. No-show Recovery Sequencer — Production Component (not in `workflow.json`)

The production follow-up agent re-engages leads who miss their trial. It is client-specific and not part of the export; it is shown because it produces the no-show recovery figures in [`PERFORMANCE.md`](./PERFORMANCE.md).

```javascript
// n8n Code Node — No-show Recovery Sequence Builder (production deployment)

const noShow = $input.first().json;

// 3-step sequence over 7 days
const sequence = [
  {
    delay_hours: 4,
    type: 'soft_check_in',
    message: `Hey ${noShow.name}, missed you at the trial today. Everything okay? Want to reschedule for later this week?`,
  },
  {
    delay_hours: 48,
    type: 'value_reminder',
    message: `Hi ${noShow.name}, hope you're well! Just wanted to remind you the free trial is still available — no pressure, just here if you want to give it a shot.`,
  },
  {
    delay_hours: 7 * 24,
    type: 'final_offer',
    message: `Hi ${noShow.name}, last note from me. We're holding the trial slot until end of week. If now's not the right time, no worries — just hit reply and I'll move you to our updates list.`,
  },
];

return sequence.map(step => ({
  json: {
    lead_id: noShow.id,
    name: noShow.name,
    phone: noShow.phone,
    channel: noShow.channel,
    sequence_type: 'trial_no_show_recovery',
    step_type: step.type,
    send_at: new Date(Date.now() + step.delay_hours * 60 * 60 * 1000).toISOString(),
    message: step.message,
    can_be_cancelled_by: ['lead_response', 'membership_sale', 'manual_stop'],
  },
}));
```

---

## Design principles demonstrated

1. **Model reports, code decides** — the AI returns an intent; an explicit transition table sets the status
2. **Conversational qualification** — natural data collection instead of forms, returned as structured JSON
3. **Capacity-aware booking** — class limits enforced in code before anything is written
4. **Idempotent records, non-retried writes** — leads upserted on `user_id`; the calendar write never retries
5. **Recovery over abandonment** — multi-step re-engagement with cancellation triggers (production follow-up layer)
