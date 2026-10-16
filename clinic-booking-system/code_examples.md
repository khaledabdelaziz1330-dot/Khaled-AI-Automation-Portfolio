# Code Examples — Healthcare AI Receptionist

JavaScript, prompts and node configuration taken directly from [`workflow.json`](./workflow.json). Sanitized of client-specific data.

---

## 1. Multi-Channel Message Normalizer

WhatsApp, Instagram, Messenger and Telegram each send a different payload structure. The `Normalize Payload` Code node detects the source from the payload shape and emits a single schema before any downstream processing. Unknown payloads throw, so they surface in the error workflow instead of being silently dropped.

```javascript
// n8n Code Node — Normalize Payload
// Multi-channel payload normalizer
// Detects source channel and converts to unified schema

const raw = $input.first().json;
let channel, normalized;

// WhatsApp Business API detection
if (raw.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
  channel = 'whatsapp';
  const msg = raw.entry[0].changes[0].value.messages[0];
  const contact = raw.entry[0].changes[0].value.contacts?.[0];
  normalized = {
    user_id: msg.from,
    user_name: contact?.profile?.name || 'Unknown',
    message_text: msg.text?.body || msg.button?.text || '',
    message_type: msg.type,
    message_id: msg.id,
    timestamp: msg.timestamp,
  };
}
// Instagram / Messenger (same Meta payload structure)
else if (raw.object === 'instagram' || raw.object === 'page') {
  channel = raw.object === 'instagram' ? 'instagram' : 'messenger';
  const event = raw.entry[0].messaging[0];
  normalized = {
    user_id: event.sender.id,
    user_name: null,
    message_text: event.message?.text || event.postback?.title || '',
    message_type: event.message ? 'text' : 'postback',
    message_id: event.message?.mid || `pb_${event.timestamp}`,
    timestamp: Math.floor(event.timestamp / 1000),
  };
}
// Telegram Bot API
else if (raw.message?.chat) {
  channel = 'telegram';
  const msg = raw.message;
  normalized = {
    user_id: String(msg.from.id),
    user_name: `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim(),
    message_text: msg.text || '',
    message_type: msg.text ? 'text' : 'other',
    message_id: String(msg.message_id),
    timestamp: msg.date,
  };
}
else {
  throw new Error(`Unsupported channel payload. Keys: ${Object.keys(raw).join(', ')}`);
}

return [{
  json: {
    channel,
    ...normalized,
    received_at: new Date().toISOString(),
    raw_payload_excerpt: JSON.stringify(raw).slice(0, 500),
  },
}];
```

---

## 2. Intent Classifier — OpenAI Node

The first AI call. One job, one label, deterministic output, ~$0.00005 per call.

**System prompt:**

```text
You are an intent classifier for a dental clinic's patient messaging system.

Read the user message and return EXACTLY ONE label from this list:
- BOOKING_REQUEST (patient wants to schedule an appointment)
- FAQ (question about prices, hours, services, location)
- CANCELLATION (wants to cancel or reschedule)
- GREETING (just a hello/hi)
- COMPLAINT (expressing dissatisfaction)
- CONFIRMATION (confirming a previously offered slot, e.g., "yes", "that works", "confirm")
- OTHER (anything else)

Return ONLY the label. No explanation. No punctuation. No quotes.
```

**Node configuration (excerpt):**

```json
{
  "name": "Classify Intent",
  "type": "@n8n/n8n-nodes-langchain.openAi",
  "modelId": "gpt-4o-mini",
  "options": {
    "temperature": 0,
    "maxTokens": 10
  },
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 2000
}
```

`Route by Intent` (a Switch node, case-insensitive) sends `BOOKING_REQUEST` and `CONFIRMATION` to extraction; `FAQ`, `CANCELLATION` and `GREETING` to a short gpt-4o-mini reply. `COMPLAINT` and `OTHER` fall through to the fallback output, which is intentionally unconnected: no automated reply, and the inbound row stays in the log for staff.

---

## 3. Booking Details Extractor — Structured Output

For booking and confirmation turns, gpt-4o (temperature 0, `json_object` response format) extracts structured fields. The prompt carries today's date so relative dates ("tomorrow", "next Tuesday") resolve to absolute ISO dates, and it tells the model to return `null` rather than guess.

**System prompt (n8n expression):**

```text
Extract booking details from the patient's message. Return JSON only.

Required fields:
- name: string or null (patient's name if mentioned)
- phone: string or null (digits only, no formatting)
- service: one of [Cleaning, Filling, Root Canal, Extraction, Whitening, Consultation, Emergency, Other] or null
- preferred_date: ISO 8601 date (YYYY-MM-DD) or null
- preferred_time: 24-hour time (HH:MM) or null
- urgency: one of [low, medium, high]

Today's date: {{ $now.toFormat('yyyy-MM-dd') }}
Timezone: Africa/Cairo

If the patient says "tomorrow" or "next Tuesday", convert to absolute ISO date.
If time is vague ("afternoon"), use null and let the conversation continue.
Do not guess fields not stated.
Return ONLY valid JSON, no markdown.
```

**User message (n8n expression) — last 5 logged turns plus the latest message:**

```text
Recent conversation history:
{{ $('Get Conversation History').all().slice(-5).map(m => `${m.json.direction}: ${m.json.message_text}`).join('\n') }}

Latest message: {{ $('Normalize Payload').first().json.message_text }}
```

---

## 4. Calendar Availability Check (deterministic — never trust AI for this)

The "code handles math" principle in practice. The model extracted the preference; **code decides what is actually free.** Only the slots returned here are passed to the reply model.

```javascript
// n8n Code Node — Calculate Availability
// Deterministic calendar availability check
// AI extracted preferences - code verifies actual availability
// THIS IS WHERE 'CODE HANDLES MATH' MATTERS MOST

const extracted = JSON.parse($('Extract Booking Details').first().json.message.content);
const calendarEvents = $('Get Calendar Events').all().map(e => e.json);

// Business configuration — all times are clinic-local, independent of the server's time zone
const CLINIC_TZ = 'Africa/Cairo';
const BUSINESS_HOURS = { start: 9, end: 19 }; // 9am-7pm clinic time
const SLOT_DURATION_MIN = 30;
const BUFFER_MIN = 15;
const LEAD_TIME_MIN = 30;
const CLOSED_WEEKDAYS = [5]; // Friday

// UTC offset of the clinic's time zone at a given instant, in minutes (handles daylight saving)
function tzOffsetMinutes(instant) {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: CLINIC_TZ, timeZoneName: 'longOffset' })
    .formatToParts(instant)
    .find(p => p.type === 'timeZoneName').value; // e.g. "GMT+02:00", or "GMT" for UTC
  const m = label.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
}

// Clinic wall-clock time -> absolute instant
function clinicTime(y, mo, d, hour, minute) {
  const asUtc = Date.UTC(y, mo - 1, d, hour, minute);
  return new Date(asUtc - tzOffsetMinutes(new Date(asUtc)) * 60000);
}

function addDays(dateStr, days) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
}

function getSlotsForDate(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // calendar weekday of the clinic date
  if (CLOSED_WEEKDAYS.includes(weekday)) return [];

  const earliest = Date.now() + LEAD_TIME_MIN * 60000;
  const slots = [];
  for (let hour = BUSINESS_HOURS.start; hour < BUSINESS_HOURS.end; hour++) {
    for (let min = 0; min < 60; min += SLOT_DURATION_MIN) {
      const start = clinicTime(y, mo, d, hour, min);
      if (start.getTime() < earliest) continue; // respect minimum lead time
      slots.push({ start, end: new Date(start.getTime() + SLOT_DURATION_MIN * 60000), localMinutes: hour * 60 + min });
    }
  }
  return slots;
}

function isSlotFree(slot, events) {
  return !events.some(event => {
    const eventStart = new Date(event.start.dateTime || event.start.date).getTime() - BUFFER_MIN * 60000;
    const eventEnd = new Date(event.end.dateTime || event.end.date).getTime() + BUFFER_MIN * 60000;
    return slot.start.getTime() < eventEnd && slot.end.getTime() > eventStart;
  });
}

// Requested date (validated) or today in clinic time
const today = $now.setZone(CLINIC_TZ).toFormat('yyyy-MM-dd');
const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(extracted.preferred_date || '') ? extracted.preferred_date : today;

// Check the requested date first, then widen the window until enough options exist
const freeSlots = [];
for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
  freeSlots.push(...getSlotsForDate(addDays(targetDate, dayOffset)).filter(s => isSlotFree(s, calendarEvents)));
  if (freeSlots.length >= 5) break;
}

// Rank by closeness to the preferred clinic-local time, if one was given
let recommended = freeSlots.slice(0, 3);
if (/^\d{1,2}:\d{2}$/.test(extracted.preferred_time || '')) {
  const [prefH, prefM] = extracted.preferred_time.split(':').map(Number);
  const prefMinutes = prefH * 60 + prefM;
  recommended = freeSlots
    .map(slot => ({ ...slot, diff: Math.abs(slot.localMinutes - prefMinutes) }))
    .sort((a, b) => a.diff - b.diff || a.start - b.start)
    .slice(0, 3);
}

return [{
  json: {
    extracted_details: extracted,
    requested_date: targetDate,
    requested_time: extracted.preferred_time,
    has_availability: recommended.length > 0,
    suggested_slots: recommended.map(s => ({
      start_iso: s.start.toISOString(),
      end_iso: s.end.toISOString(),
      display: s.start.toLocaleString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: CLINIC_TZ,
      }),
    })),
  },
}];
```

---

## 5. Channel Dispatch — Secrets Resolved at Request Time

`Build Channel Reply` builds only the channel-specific message body. It never reads a token.

```javascript
// n8n Code Node — Build Channel Reply
// Channel-specific reply builder
// Routes the AI reply back through the SAME channel the user used.
//
// Security: this node never reads or emits access tokens. The endpoint URL and
// Authorization header are resolved from $env inside "Send Reply via API", so
// secrets never enter item data and never appear in n8n execution logs.

const replyText = $input.first().json.message.content;
const { channel, user_id: userId } = $('Normalize Payload').first().json;

const bodies = {
  whatsapp: {
    messaging_product: 'whatsapp',
    to: userId,
    type: 'text',
    text: { body: replyText },
  },
  instagram: {
    recipient: { id: userId },
    message: { text: replyText },
  },
  messenger: {
    recipient: { id: userId },
    messaging_type: 'RESPONSE',
    message: { text: replyText },
  },
  telegram: {
    chat_id: userId,
    text: replyText,
    parse_mode: 'Markdown',
  },
};

const dispatchBody = bodies[channel];
if (!dispatchBody) {
  throw new Error(`Unknown channel for dispatch: ${channel}`);
}

return [{
  json: {
    channel,
    user_id: userId,
    reply_text: replyText,
    dispatch_body: dispatchBody,
  },
}];
```

`Send Reply via API` resolves the endpoint and the `Authorization` header from environment variables inside its own parameters:

```json
{
  "name": "Send Reply via API",
  "url": "={{ $json.channel === 'whatsapp' ? 'https://graph.facebook.com/v18.0/' + $env.WHATSAPP_PHONE_NUMBER_ID + '/messages' : $json.channel === 'telegram' ? 'https://api.telegram.org/bot' + $env.TELEGRAM_BOT_TOKEN + '/sendMessage' : 'https://graph.facebook.com/v18.0/me/messages' }}",
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "={{ $json.channel === 'whatsapp' ? 'Bearer ' + $env.WHATSAPP_ACCESS_TOKEN : $json.channel === 'instagram' ? 'Bearer ' + $env.IG_ACCESS_TOKEN : $json.channel === 'messenger' ? 'Bearer ' + $env.FB_PAGE_ACCESS_TOKEN : '' }}"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "jsonBody": "={{ JSON.stringify($json.dispatch_body) }}",
  "options": {
    "timeout": 10000
  },
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 2000
}
```

**Why this shape:** n8n persists every node's output in execution data. An earlier version built the headers in the Code node and passed them downstream as item data:

```javascript
// Anti-pattern (removed): the bearer token becomes part of the node's output
// and is stored in every execution log.
return [{ json: { dispatch_headers: { Authorization: `Bearer ${$env.WHATSAPP_ACCESS_TOKEN}` } } }];
```

With the token resolved in the HTTP node's parameters, item data carries only the channel, recipient and message body. Telegram's Bot API puts the token in the URL path by design, so the URL is resolved the same way.

---

## 6. Error Handling — Two Layers

1. **Node level:** every external read and AI call (OpenAI, Google Sheets, Google Calendar) carries `"retryOnFail": true, "maxTries": 3, "waitBetweenTries": 2000`. Rate limits and brief network errors recover inside the execution. The outbound channel send is intentionally not auto-retried, so a timeout after a successful send can never produce a duplicate message.
2. **Workflow level:** `settings.errorWorkflow` points to the portfolio's [shared error handler](../shared-error-handler). Only failures that survive retries reach it. It redacts secrets and PII, logs one row per failure to the `Errors` sheet, and sends a Slack alert for high-severity failures (channel send, calendar, 401/403).

The sanitize-and-classify code lives in that project's [`workflow.json`](../shared-error-handler/workflow.json).

---

## 7. Reminder Scheduler — Production Component (not in `workflow.json`)

The production deployment schedules 24-hour and 2-hour reminders after a booking is written to the calendar. This step is client-specific and is not part of the export; it is shown here because it drives the no-show reduction reported in [`PERFORMANCE.md`](./PERFORMANCE.md).

```javascript
// n8n Code Node — Schedule Reminders (production deployment)

const booking = $('Create Booking').first().json;
const appointmentTime = new Date(booking.start_datetime);

const reminders = [
  {
    type: '24_hour',
    send_at: new Date(appointmentTime.getTime() - 24 * 60 * 60 * 1000),
    message: `Hi ${booking.patient_name}, this is a friendly reminder about your appointment tomorrow at ${formatTime(appointmentTime)}. Reply CONFIRM to confirm, or RESCHEDULE if you need a different time.`,
  },
  {
    type: '2_hour',
    send_at: new Date(appointmentTime.getTime() - 2 * 60 * 60 * 1000),
    message: `Hi ${booking.patient_name}, see you in 2 hours at ${formatTime(appointmentTime)}. Our location: ${booking.clinic_address}`,
  },
];

function formatTime(date) {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Filter out reminders in the past (short-notice bookings)
const validReminders = reminders.filter((r) => r.send_at > new Date());

return validReminders.map((reminder) => ({
  json: {
    booking_id: booking.id,
    user_id: booking.user_id,
    channel: booking.channel,
    ...reminder,
    send_at: reminder.send_at.toISOString(),
  },
}));
```

---

## Patterns demonstrated

1. **Separation of concerns** — AI handles language, code handles scheduling logic
2. **Schema normalization** — four payload formats unified before processing
3. **Structured AI output** — JSON mode with explicit `null` instead of guesses
4. **Defensive programming** — lead time, buffers, closed days and conflict detection in code
5. **Secret hygiene** — tokens resolved at request time, never stored in execution data
6. **Layered error handling** — node retries first, sanitized logging and alerting second

These patterns repeat across the production systems in this portfolio.
