# Code Examples — Clinic AI Receptionist

Production JavaScript code samples from the n8n workflow. Sanitized of client-specific data.

---

## 1. Multi-Channel Message Normalizer

Different channels (WhatsApp, Instagram, Messenger, Telegram) send messages in different payload structures. This Code node normalizes them into a single schema before any downstream processing.

```javascript
// n8n Code Node — Message Normalizer
// Input: webhook payload from any messaging channel
// Output: unified message object

const channel = $input.first().json.channel || detectChannel($input.first().json);
const raw = $input.first().json;

function detectChannel(payload) {
  if (payload.entry?.[0]?.changes?.[0]?.value?.messages) return 'whatsapp';
  if (payload.object === 'instagram') return 'instagram';
  if (payload.object === 'page') return 'messenger';
  if (payload.message?.chat) return 'telegram';
  return 'unknown';
}

const extractors = {
  whatsapp: (p) => ({
    user_id: p.entry[0].changes[0].value.messages[0].from,
    user_name: p.entry[0].changes[0].value.contacts[0].profile.name,
    message_text: p.entry[0].changes[0].value.messages[0].text?.body || '',
    message_id: p.entry[0].changes[0].value.messages[0].id,
    timestamp: p.entry[0].changes[0].value.messages[0].timestamp,
  }),
  instagram: (p) => ({
    user_id: p.entry[0].messaging[0].sender.id,
    user_name: null, // resolved later via API
    message_text: p.entry[0].messaging[0].message.text || '',
    message_id: p.entry[0].messaging[0].message.mid,
    timestamp: p.entry[0].messaging[0].timestamp,
  }),
  messenger: (p) => ({
    user_id: p.entry[0].messaging[0].sender.id,
    user_name: null,
    message_text: p.entry[0].messaging[0].message.text || '',
    message_id: p.entry[0].messaging[0].message.mid,
    timestamp: p.entry[0].messaging[0].timestamp,
  }),
  telegram: (p) => ({
    user_id: String(p.message.from.id),
    user_name: `${p.message.from.first_name || ''} ${p.message.from.last_name || ''}`.trim(),
    message_text: p.message.text || '',
    message_id: String(p.message.message_id),
    timestamp: p.message.date,
  }),
};

const extractor = extractors[channel];
if (!extractor) {
  throw new Error(`Unsupported channel: ${channel}`);
}

const normalized = extractor(raw);

return [{
  json: {
    channel,
    ...normalized,
    received_at: new Date().toISOString(),
  },
}];
```

---

## 2. Intent Classifier — OpenAI Prompt

The first AI call. Single responsibility, structured output, low cost per call.

```javascript
// n8n OpenAI Node — Intent Classification
// Returns ONE of: BOOKING_REQUEST | FAQ | CANCELLATION | GREETING | COMPLAINT | OTHER

const systemPrompt = `You are an intent classifier for a dental clinic's patient messaging system.

Read the user message and return EXACTLY ONE label from this list:
- BOOKING_REQUEST (patient wants to schedule an appointment)
- FAQ (question about prices, hours, services, location)
- CANCELLATION (wants to cancel or reschedule)
- GREETING (just a hello/hi)
- COMPLAINT (expressing dissatisfaction)
- OTHER (anything else)

Return ONLY the label. No explanation. No punctuation.`;

const userMessage = $('Normalize Message').first().json.message_text;

return [{
  json: {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0,
    max_tokens: 10,
  },
}];
```

---

## 3. Booking Details Extractor — Structured Output

When intent is `BOOKING_REQUEST`, extract structured fields. Uses JSON mode for parseable output.

```javascript
// n8n OpenAI Node — Extract Booking Details

const services = [
  'Cleaning', 'Filling', 'Root Canal', 'Extraction',
  'Whitening', 'Consultation', 'Emergency', 'Other',
];

const systemPrompt = `Extract booking details from the patient message. Return JSON only.

Required fields:
- name: string or null
- phone: string or null (digits only)
- service: one of [${services.join(', ')}] or null
- preferred_date: ISO 8601 date (YYYY-MM-DD) or null
- preferred_time: 24-hour time (HH:MM) or null
- urgency: one of [low, medium, high] (high = emergency keywords)

Today's date: ${new Date().toISOString().slice(0, 10)}

If a field is not present, return null. Do not guess.`;

const messageHistory = $('Get Conversation History').first().json.messages || [];
const currentMessage = $('Normalize Message').first().json.message_text;

const conversationContext = messageHistory
  .slice(-5)
  .map((m) => `${m.role}: ${m.text}`)
  .join('\n');

return [{
  json: {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Recent conversation:\n${conversationContext}\n\nLatest message: ${currentMessage}` },
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
  },
}];
```

---

## 4. Calendar Availability Check (deterministic, NEVER trust AI for this)

This is the critical "code handles math" principle in practice. AI extracts the preferred time. **Code verifies availability.**

```javascript
// n8n Code Node — Calendar Availability Check
// Input: extracted booking details + Google Calendar API response
// Output: list of actually available slots, never guessed

const requested = $('Extract Booking Details').first().json;
const calendarEvents = $('Get Calendar Events').first().json.items || [];

// Define business hours
const BUSINESS_HOURS = { start: 9, end: 19 }; // 9am to 7pm
const SLOT_DURATION_MIN = 30;
const BUFFER_MIN = 15; // buffer between appointments

function getSlotsForDate(dateISO) {
  const date = new Date(dateISO);
  const slots = [];
  
  for (let hour = BUSINESS_HOURS.start; hour < BUSINESS_HOURS.end; hour++) {
    for (let min = 0; min < 60; min += SLOT_DURATION_MIN) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, min, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MIN * 60000);
      
      // Skip past slots
      if (slotStart < new Date()) continue;
      
      slots.push({ start: slotStart, end: slotEnd });
    }
  }
  return slots;
}

function isSlotFree(slot, events) {
  const slotStart = slot.start.getTime();
  const slotEnd = slot.end.getTime();
  
  return !events.some((event) => {
    const eventStart = new Date(event.start.dateTime).getTime() - BUFFER_MIN * 60000;
    const eventEnd = new Date(event.end.dateTime).getTime() + BUFFER_MIN * 60000;
    return slotStart < eventEnd && slotEnd > eventStart;
  });
}

// Get all slots for requested date
const targetDate = requested.preferred_date || new Date().toISOString().slice(0, 10);
const allSlots = getSlotsForDate(targetDate);
const freeSlots = allSlots.filter((slot) => isSlotFree(slot, calendarEvents));

// Find closest match to preferred time
let suggestedSlots = freeSlots.slice(0, 5);
if (requested.preferred_time) {
  const [prefHour, prefMin] = requested.preferred_time.split(':').map(Number);
  const prefMinutes = prefHour * 60 + prefMin;
  
  suggestedSlots = freeSlots
    .map((slot) => ({
      ...slot,
      diff: Math.abs(slot.start.getHours() * 60 + slot.start.getMinutes() - prefMinutes),
    }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 3);
}

return [{
  json: {
    requested_date: targetDate,
    requested_time: requested.preferred_time,
    available_slots: suggestedSlots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      display: s.start.toLocaleString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    })),
    has_availability: suggestedSlots.length > 0,
  },
}];
```

---

## 5. Error Handler — Production Reliability

Every workflow has an Error Trigger connected to this node. Captures failures, logs them, alerts Slack.

```javascript
// n8n Code Node — Centralized Error Handler

const error = $input.first().json;

// Sanitize sensitive data before logging
function sanitize(obj) {
  const sensitive = ['api_key', 'authorization', 'password', 'token'];
  if (typeof obj !== 'object' || obj === null) return obj;
  const cleaned = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitive.some((s) => key.toLowerCase().includes(s))) {
      cleaned[key] = '[REDACTED]';
    } else {
      cleaned[key] = sanitize(value);
    }
  }
  return cleaned;
}

const errorLog = {
  timestamp: new Date().toISOString(),
  workflow_name: error.workflow?.name || 'unknown',
  node_name: error.node?.name || 'unknown',
  error_message: error.error?.message || 'Unknown error',
  error_stack: error.error?.stack?.slice(0, 500),
  context: sanitize({
    execution_id: error.executionId,
    last_input: error.last_input,
  }),
};

// Determine severity
const HIGH_SEVERITY_KEYWORDS = ['rate_limit', 'unauthorized', 'forbidden', 'database', 'timeout'];
const severity = HIGH_SEVERITY_KEYWORDS.some((kw) =>
  errorLog.error_message.toLowerCase().includes(kw)
)
  ? 'high'
  : 'medium';

errorLog.severity = severity;

// Build Slack alert
const slackBlocks = [
  {
    type: 'header',
    text: { type: 'plain_text', text: `🚨 ${severity.toUpperCase()} — Workflow Error` },
  },
  {
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Workflow:*\n${errorLog.workflow_name}` },
      { type: 'mrkdwn', text: `*Node:*\n${errorLog.node_name}` },
      { type: 'mrkdwn', text: `*Time:*\n${errorLog.timestamp}` },
      { type: 'mrkdwn', text: `*Execution:*\n${errorLog.context.execution_id}` },
    ],
  },
  {
    type: 'section',
    text: { type: 'mrkdwn', text: `*Error:*\n\`\`\`${errorLog.error_message}\`\`\`` },
  },
];

return [
  {
    json: {
      error_log: errorLog,
      slack_payload: { blocks: slackBlocks },
    },
  },
];
```

---

## 6. Reminder Scheduler — Automated Follow-ups

After a booking is confirmed, schedule 24-hour and 2-hour reminders. n8n's scheduling combined with a small JS helper.

```javascript
// n8n Code Node — Schedule Reminders

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

// Filter out reminders in the past (in case booking is short-notice)
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

1. **Separation of concerns** — AI handles language, code handles logic
2. **Schema normalization** — multi-source data unified before processing
3. **Structured AI output** — JSON mode for parseable extraction
4. **Defensive programming** — past dates filtered, slot conflicts detected
5. **Error handling** — sanitized logs, severity classification, Slack alerts
6. **Code that AI cannot replace** — calendar math, conflict detection, time arithmetic

These patterns repeat across all the production systems in this portfolio.
