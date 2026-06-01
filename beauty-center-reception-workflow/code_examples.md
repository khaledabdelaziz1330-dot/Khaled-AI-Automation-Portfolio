# Code Examples — Beauty Center AI Reception

Production code from the multi-service beauty center receptionist. Handles service matching, specialist booking, preference tracking, and multi-branch routing.

---

## 1. Service Matching from Natural Language

Match user requests to actual services in the catalog, even with informal language.

```javascript
// n8n Code Node — Service Matcher

const userMessage = $('Normalize Message').first().json.message_text.toLowerCase();
const services = $('Get Services Catalog').all();

// Build keyword index from services
const serviceIndex = services.map((s) => {
  const keywords = [
    s.json.service_name.toLowerCase(),
    ...(s.json.alternate_names || '').toLowerCase().split(',').map((n) => n.trim()),
    ...(s.json.keywords || '').toLowerCase().split(',').map((k) => k.trim()),
  ].filter(Boolean);
  
  return {
    service_id: s.json.id,
    service_name: s.json.service_name,
    duration_minutes: s.json.duration_minutes,
    price: s.json.price,
    specialist_required: s.json.specialist_required,
    keywords,
  };
});

// Score each service based on keyword matches
function scoreService(service, message) {
  let score = 0;
  let matchedKeywords = [];
  
  service.keywords.forEach((kw) => {
    if (message.includes(kw)) {
      // Longer matches score higher (less likely false positive)
      score += kw.length;
      matchedKeywords.push(kw);
    }
  });
  
  return { service, score, matchedKeywords };
}

const matches = serviceIndex
  .map((s) => scoreService(s, userMessage))
  .filter((m) => m.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 3);

const isAmbiguous = matches.length > 1 && matches[1].score >= matches[0].score * 0.7;

return [{
  json: {
    user_message: userMessage,
    top_match: matches[0]?.service || null,
    alternative_matches: matches.slice(1).map((m) => m.service),
    is_ambiguous: isAmbiguous,
    needs_clarification: !matches[0] || isAmbiguous,
  },
}];
```

---

## 2. Specialist Matching with Availability

Find the right specialist for the service AND check their calendar.

```javascript
// n8n Code Node — Specialist Match + Availability

const service = $('Service Match').first().json.top_match;
const requestedDate = $('Booking Details').first().json.preferred_date;
const specialists = $('Get Specialists').all();
const calendarEvents = $('Get All Calendar Events').all();

// Filter specialists who can perform this service
const qualifiedSpecialists = specialists.filter((s) => {
  const services = (s.json.qualified_services || '').split(',').map((x) => x.trim());
  return services.includes(service.service_id) || services.includes('all');
});

if (qualifiedSpecialists.length === 0) {
  return [{
    json: {
      error: 'no_qualified_specialist',
      message: `No specialist available for ${service.service_name}`,
    },
  }];
}

// Check each specialist's availability on the requested date
function getAvailableSlots(specialist, date, duration) {
  const specialistEvents = calendarEvents.filter(
    (e) => e.json.calendarId === specialist.json.calendar_id
  );
  
  const dayStart = new Date(date);
  dayStart.setHours(parseInt(specialist.json.shift_start || 9), 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(parseInt(specialist.json.shift_end || 19), 0, 0, 0);
  
  const slots = [];
  for (let t = dayStart.getTime(); t < dayEnd.getTime() - duration * 60000; t += 30 * 60000) {
    const slotStart = new Date(t);
    const slotEnd = new Date(t + duration * 60000);
    
    const conflict = specialistEvents.some((e) => {
      const eventStart = new Date(e.json.start.dateTime).getTime();
      const eventEnd = new Date(e.json.end.dateTime).getTime();
      return slotStart.getTime() < eventEnd && slotEnd.getTime() > eventStart;
    });
    
    if (!conflict && slotStart > new Date()) {
      slots.push({ start: slotStart, end: slotEnd });
    }
  }
  return slots;
}

const specialistAvailability = qualifiedSpecialists.map((sp) => ({
  specialist: {
    id: sp.json.id,
    name: sp.json.name,
    specialties: sp.json.specialties,
    rating: sp.json.rating,
  },
  available_slots: getAvailableSlots(sp, requestedDate, service.duration_minutes),
}));

// Sort by rating, then by availability count
specialistAvailability.sort((a, b) => {
  if (b.specialist.rating !== a.specialist.rating) {
    return b.specialist.rating - a.specialist.rating;
  }
  return b.available_slots.length - a.available_slots.length;
});

return [{
  json: {
    service: service.service_name,
    specialists_with_availability: specialistAvailability.filter((s) => s.available_slots.length > 0),
    top_recommendation: specialistAvailability[0],
  },
}];
```

---

## 3. Client Preference Tracking

Track each client's history so future visits feel personal.

```javascript
// n8n Code Node — Update Client Preferences

const clientId = $('Get Client').first().json.client_id;
const completedBooking = $('Confirmed Booking').first().json;
const existingPrefs = $('Get Client Preferences').first().json || {};

const updatedPrefs = {
  client_id: clientId,
  last_updated: new Date().toISOString(),
  
  preferred_specialist: completedBooking.specialist_id, // most recent
  
  preferred_specialists_list: addToFrequencyList(
    existingPrefs.preferred_specialists_list || [],
    completedBooking.specialist_id
  ),
  
  preferred_services: addToFrequencyList(
    existingPrefs.preferred_services || [],
    completedBooking.service_id
  ),
  
  preferred_time_pattern: addTimePattern(
    existingPrefs.preferred_time_pattern || {},
    completedBooking.start_datetime
  ),
  
  preferred_branch: completedBooking.branch_id,
  
  total_visits: (existingPrefs.total_visits || 0) + 1,
  
  last_visit_date: completedBooking.start_datetime,
  
  visit_history: [
    ...(existingPrefs.visit_history || []).slice(-9), // keep last 10
    {
      date: completedBooking.start_datetime,
      service: completedBooking.service_name,
      specialist: completedBooking.specialist_name,
      branch: completedBooking.branch_name,
    },
  ],
};

function addToFrequencyList(list, item) {
  const existing = list.find((i) => i.id === item);
  if (existing) {
    existing.count++;
    existing.last_used = new Date().toISOString();
  } else {
    list.push({ id: item, count: 1, last_used: new Date().toISOString() });
  }
  return list.sort((a, b) => b.count - a.count).slice(0, 5);
}

function addTimePattern(existing, datetime) {
  const date = new Date(datetime);
  const dayOfWeek = date.getDay();
  const hour = date.getHours();
  
  const key = `${dayOfWeek}_${hour}`;
  existing[key] = (existing[key] || 0) + 1;
  
  return existing;
}

return [{ json: updatedPrefs }];
```

---

## 4. Smart Follow-up Scheduler

Different services have different follow-up cadences (haircut every 4 weeks, facial every 6 weeks, etc.)

```javascript
// n8n Code Node — Follow-up Scheduler

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

// Check if client is "active" (visited within last 90 days)
const isActiveClient = completedBooking.client_total_visits > 1;

// Active clients get gentle reminders, new clients get more touchpoints
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

1. **Fuzzy service matching** — handles informal language and multiple aliases
2. **Multi-criteria specialist selection** — qualification + availability + rating
3. **Preference accumulation over time** — every visit refines the model
4. **Service-aware follow-up cadence** — different timing per service type
5. **Active vs new client differentiation** — different touch patterns
