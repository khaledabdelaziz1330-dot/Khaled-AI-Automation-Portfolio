# Code Examples — Gym Lead Management System

Production code from the gym lead pipeline. Multi-channel inbound → AI qualification → trial booking → membership conversion.

---

## 1. Lead Qualification AI Prompt

After greeting, the AI gathers qualification info conversationally.

```javascript
// n8n OpenAI Node — Conversational Lead Qualifier

const conversationHistory = $('Get History').first().json.messages || [];
const currentMessage = $('Normalize Message').first().json.text;

const systemPrompt = `You are a friendly gym receptionist gathering qualification info for new leads.

Goals in order:
1. Greet warmly if this is a first message
2. Collect: fitness goals, experience level, preferred training time, preferred location (if multi-gym)
3. Once you have enough, offer a free trial class booking

Tone: Warm, energetic, not pushy. Match the language the user wrote in.

Hard rules:
- Never promise specific results ("you'll lose 20 lbs")
- Never quote membership prices (route to sales team for that)
- Never claim medical/health expertise
- Always offer human handoff if the user seems frustrated

When you have name + goals + preferred time, respond with the JSON object:
{
  "ready_to_book": true,
  "collected_info": {
    "name": "...",
    "phone": "...",
    "goals": "...",
    "experience": "...",
    "preferred_time": "...",
    "preferred_location": "..."
  },
  "reply_to_user": "..."
}

Otherwise respond with just:
{
  "ready_to_book": false,
  "reply_to_user": "..."
}`;

return [{
  json: {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(m => ({ role: m.role, content: m.text })),
      { role: 'user', content: currentMessage },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
  },
}];
```

---

## 2. Pipeline Status Updater

Updates the lead status across stages: New → Hot → Trial Booked → Member / Lost.

```javascript
// n8n Code Node — Lead Status Manager

const lead = $input.first().json;
const action = $input.first().json.action; // 'message_received', 'trial_booked', 'trial_attended', 'membership_signed', 'lost'

const STATUS_TRANSITIONS = {
  'New': {
    'message_received': 'New',
    'qualified': 'Hot',
    'no_response_7d': 'Cold',
  },
  'Hot': {
    'trial_booked': 'Trial Booked',
    'no_response_3d': 'Hot (Follow-up needed)',
    'lost': 'Lost',
  },
  'Trial Booked': {
    'trial_attended': 'Attended Trial',
    'trial_no_show': 'No-show (Trial)',
    'cancelled_trial': 'Hot (Reschedule needed)',
  },
  'Attended Trial': {
    'membership_signed': 'Member',
    'wants_to_think': 'Considering',
    'declined': 'Lost',
  },
  'Considering': {
    'membership_signed': 'Member',
    'no_response_14d': 'Lost',
  },
  'No-show (Trial)': {
    're_engaged': 'Hot',
    'no_response_7d': 'Lost',
  },
};

const currentStatus = lead.status || 'New';
const transitionMap = STATUS_TRANSITIONS[currentStatus] || {};
const newStatus = transitionMap[action] || currentStatus;

if (newStatus === currentStatus) {
  return [{
    json: {
      lead_id: lead.id,
      status_unchanged: true,
      current_status: currentStatus,
    },
  }];
}

return [{
  json: {
    lead_id: lead.id,
    status_changed: true,
    previous_status: currentStatus,
    new_status: newStatus,
    transition_reason: action,
    changed_at: new Date().toISOString(),
    next_action: getNextAction(newStatus),
  },
}];

function getNextAction(status) {
  const nextActions = {
    'Hot': 'Send trial offer message within 1 hour',
    'Trial Booked': 'Send 24h reminder + 2h reminder',
    'No-show (Trial)': 'Send re-engagement after 3 days',
    'Considering': 'Send follow-up at days 1, 3, 7',
    'Member': 'Add to onboarding sequence',
    'Lost': 'Add to monthly re-engagement list',
  };
  return nextActions[status] || null;
}
```

---

## 3. Trial Class Booking Logic

Books a trial class on Google Calendar with availability check.

```javascript
// n8n Code Node — Trial Class Booking

const leadInfo = $('Qualified Lead').first().json;
const calendarEvents = $('Get Calendar Events').first().json.items || [];

// Trial classes happen at fixed times
const TRIAL_SLOTS = {
  monday: [9, 11, 17, 19],
  tuesday: [9, 11, 17, 19],
  wednesday: [9, 11, 17, 19],
  thursday: [9, 11, 17, 19],
  friday: [9, 11, 17, 19],
  saturday: [10, 12, 14],
  sunday: [10, 12, 14],
};

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MAX_PER_SLOT = 5; // max 5 trial attendees per slot

function generateSlots(daysAhead = 7) {
  const slots = [];
  const now = new Date();
  
  for (let dayOffset = 1; dayOffset <= daysAhead; dayOffset++) {
    const date = new Date(now.getTime() + dayOffset * 86400000);
    const dayName = DAY_NAMES[date.getDay()];
    const hours = TRIAL_SLOTS[dayName] || [];
    
    for (const hour of hours) {
      const slotStart = new Date(date);
      slotStart.setHours(hour, 0, 0, 0);
      slots.push({
        start: slotStart,
        end: new Date(slotStart.getTime() + 60 * 60 * 1000), // 1 hour trial
        day_name: dayName,
        hour,
      });
    }
  }
  return slots;
}

function isSlotAvailable(slot, events) {
  const attendeeCount = events.filter(event => {
    const eventStart = new Date(event.start.dateTime).getTime();
    return eventStart === slot.start.getTime();
  }).length;
  return attendeeCount < MAX_PER_SLOT;
}

const allSlots = generateSlots();
const availableSlots = allSlots.filter(slot => isSlotAvailable(slot, calendarEvents));

// Match to preferred time if specified
let recommended = availableSlots.slice(0, 3);
if (leadInfo.preferred_time) {
  const preferredHour = parseInt(leadInfo.preferred_time);
  recommended = availableSlots
    .map(s => ({ ...s, diff: Math.abs(s.hour - preferredHour) }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 3);
}

return [{
  json: {
    lead_id: leadInfo.id,
    available_slots: recommended.map(s => ({
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
    has_availability: recommended.length > 0,
  },
}];
```

---

## 4. No-show Recovery Sequencer

When a lead misses their trial, automated re-engagement begins.

```javascript
// n8n Code Node — No-show Recovery Sequence Builder

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

1. **Stateful pipeline with explicit transitions** — clear state machine
2. **Conversational qualification** — natural data collection vs forms
3. **Capacity-aware booking** — class size limits respected
4. **Multi-step recovery sequences** — re-engage rather than abandon
5. **Cancellation triggers** — sequences stop when lead becomes member
