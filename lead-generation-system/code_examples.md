# Code Examples — AI Prospecting & Outreach Pipeline

Production code from the lead generation pipeline, taken verbatim from the nodes in [`workflow.json`](workflow.json): scraping → dedup → verification → AI personalization → human approval request.

---

## 1. Lead Deduplication Against Database

Node: **Deduplicate** (Code). After scraping, new leads are checked against the campaign's existing records on three signals (email, digits-only phone, website domain). Accepted leads are added to the lookup sets, so duplicates inside the same batch are caught too.

```javascript
// Multi-signal deduplication: email, phone, domain
const newLeads = $('Extract Lead Fields').all().map(i => i.json);
const existingLeads = $('Get Existing Leads').all().map(i => i.json);

const existingEmails = new Set(existingLeads.map(l => (l.email || '').toLowerCase().trim()).filter(Boolean));
const existingPhones = new Set(existingLeads.map(l => String(l.phone || '').replace(/\D/g, '')).filter(Boolean));
const existingDomains = new Set(existingLeads.map(l => extractDomain(l.website)).filter(Boolean));

function extractDomain(url) {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '');
  } catch { return null; }
}

const stats = { input: newLeads.length, duplicates: 0, new_leads: 0 };
const uniqueLeads = [];

for (const lead of newLeads) {
  const email = (lead.email || '').toLowerCase().trim();
  const phone = String(lead.phone || '').replace(/\D/g, '');
  const domain = extractDomain(lead.website);
  
  const isDup = (email && existingEmails.has(email)) ||
                (phone && existingPhones.has(phone)) ||
                (domain && existingDomains.has(domain));
  
  if (isDup) {
    stats.duplicates++;
  } else {
    uniqueLeads.push({
      ...lead,
      lead_id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      lead_status: 'new',
    });
    stats.new_leads++;
    if (email) existingEmails.add(email);
    if (phone) existingPhones.add(phone);
    if (domain) existingDomains.add(domain);
  }
}

console.log('Dedup stats:', stats);
return uniqueLeads.map(l => ({ json: l }));
```

---

## 2. ZeroBounce Email Verification

Node: **ZeroBounce Verify** (HTTP Request). One call per lead, with a 10 s timeout and node-level retry for transient failures (`retryOnFail: true`, `maxTries: 4`, `waitBetweenTries: 2000` ms):

```text
GET https://api.zerobounce.net/v2/validate?api_key={{ $env.ZEROBOUNCE_API_KEY }}&email={{ encodeURIComponent($json.email) }}
```

Node: **Filter Verified** (Code). Code, not the model, decides deliverability: only `valid` or `catch-all`, non-free, non-disposable addresses set `should_send`, which the **Is Verified?** node then gates on.

```javascript
// Filter to only verified, non-free emails
const lead = $('Deduplicate').item.json;
const verification = $input.first().json;

const isValid = ['valid', 'catch-all'].includes(verification.status);
const isNotFree = verification.free_email === 'false' || !verification.free_email;
const isNotDisposable = verification.status !== 'disposable';

return [{
  json: {
    ...lead,
    verification_status: verification.status,
    verification_sub_status: verification.sub_status,
    free_email: verification.free_email,
    should_send: isValid && isNotFree && isNotDisposable,
    verified_at: new Date().toISOString(),
  },
}];
```

---

## 3. AI Personalization Generator

Node: **AI Personalization** (OpenAI node, model `gpt-4o`, `temperature: 0.7`, `responseFormat: json_object`). Generates a short personalized email from the scraped business context.

System prompt:

```text
You write short, personalized cold outreach emails for B2B service offerings.

Rules:
- Maximum 80 words in the body
- Reference something specific from the lead's business (their category, location, or rating)
- Lead with THEIR pain point, not our solution
- One clear call-to-action: a 15-minute call
- No clichés ("hope this finds you well", "circling back", "just touching base")
- Friendly but professional tone
- Use plain text, no formatting

Return JSON only:
{
  "subject": "...",
  "body": "...",
  "personalization_signal": "what specific detail you referenced"
}
```

User message template (n8n expressions):

```text
Lead: {{ $json.business_name }}
Category: {{ $json.category }}
Location: {{ $json.city }}, {{ $json.country }}
Rating: {{ $json.rating }} ({{ $json.reviews_count }} reviews)
Website: {{ $json.website }}

Our offering: AI automation that handles their customer inquiries 24/7 across WhatsApp, Instagram, and email. Saves their team 20+ hours/week.
```

---

## 4. Human Approval Record Builder

Node: **Build Approval Record** (Code). Every draft is turned into an approval record with a unique ID, a `pending_review` status and a 48-hour response deadline, plus the Telegram message the operator will see. The same record is appended to the `PendingApprovals` sheet by **Queue Approval**.

```javascript
// Build approval record and Telegram message
const lead = $('Filter Verified').item.json;
const emailJson = JSON.parse($input.first().json.message.content);

const approvalId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const telegramMessage = `🔔 *New Outreach Approval Needed*\n\n*To:* ${lead.business_name}\n*Email:* ${lead.email}\n*Subject:* ${emailJson.subject}\n\n${emailJson.body}\n\n*Personalization:* ${emailJson.personalization_signal}\n*Approval ID:* \`${approvalId}\``;

return [{
  json: {
    approval_id: approvalId,
    lead_id: lead.lead_id,
    lead_email: lead.email,
    lead_business: lead.business_name,
    email_subject: emailJson.subject,
    email_body: emailJson.body,
    personalization_signal: emailJson.personalization_signal,
    status: 'pending_review',
    created_at: new Date().toISOString(),
    response_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    telegram_message: telegramMessage,
  },
}];
```

---

## 5. Telegram Approval Request

Node: **Send Telegram Approval** (Telegram). Posts the draft to the operator chat (`$env.APPROVAL_TELEGRAM_CHAT_ID`, Markdown) with one inline button per decision. Each button's `callback_data` carries the action and the `approval_id`, so a decision can be matched back to its queued record.

```json
{
  "inline_keyboard": [[
    { "text": "✅ Approve", "callback_data": "approve_{{ $json.approval_id }}" },
    { "text": "✏️ Edit", "callback_data": "edit_{{ $json.approval_id }}" },
    { "text": "❌ Reject", "callback_data": "reject_{{ $json.approval_id }}" }
  ]]
}
```

---

## Design principles demonstrated

1. **Multiple dedup signals** — email, phone and domain all checked, including within the batch
2. **Retry on external verification** — transient ZeroBounce failures are retried at node level
3. **Deterministic gating** — code decides `should_send`; the model only writes copy
4. **Personalization with specific signals** — the model must report the detail it referenced
5. **Human-in-the-loop required** — every draft goes to an operator before it can be sent
6. **Traceable approvals** — IDs, status and deadline persisted per draft
