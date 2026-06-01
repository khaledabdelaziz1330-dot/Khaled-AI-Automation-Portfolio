# Code Examples — Lead Generation & AI Outreach Engine

Production code from the 6-phase lead generation pipeline: scraping → dedup → verification → AI personalization → human approval → send.

---

## 1. Lead Deduplication Against Database

After scraping new leads, check against existing database to avoid duplicate outreach.

```javascript
// n8n Code Node — Lead Deduplication

const newLeads = $('Apify Scraping Results').all();
const existingLeads = $('Get Existing Database').all();

// Build lookup sets for O(1) checking
const existingEmails = new Set(
  existingLeads.map((l) => (l.json.email || '').toLowerCase().trim()).filter(Boolean)
);
const existingPhones = new Set(
  existingLeads.map((l) => normalizePhone(l.json.phone)).filter(Boolean)
);
const existingDomains = new Set(
  existingLeads.map((l) => extractDomain(l.json.website)).filter(Boolean)
);

function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone).replace(/\D/g, '');
}

function extractDomain(url) {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '');
  } catch {
    return null;
  }
}

const stats = { input: newLeads.length, duplicates: 0, new_leads: 0 };
const uniqueLeads = [];

newLeads.forEach((lead) => {
  const email = (lead.json.email || '').toLowerCase().trim();
  const phone = normalizePhone(lead.json.phone);
  const domain = extractDomain(lead.json.website);
  
  const isDuplicate =
    (email && existingEmails.has(email)) ||
    (phone && existingPhones.has(phone)) ||
    (domain && existingDomains.has(domain));
  
  if (isDuplicate) {
    stats.duplicates++;
  } else {
    uniqueLeads.push({ ...lead.json, lead_status: 'new', dedup_checked_at: new Date().toISOString() });
    stats.new_leads++;
    // Add to sets to dedup within current batch
    if (email) existingEmails.add(email);
    if (phone) existingPhones.add(phone);
    if (domain) existingDomains.add(domain);
  }
});

return uniqueLeads.map((lead) => ({ json: { ...lead, _stats: stats } }));
```

---

## 2. ZeroBounce Email Verification with Retry

Calls ZeroBounce API to verify email validity. Includes retry logic for transient failures.

```javascript
// n8n Code Node — Email Verification Wrapper

const lead = $input.first().json;
const ZEROBOUNCE_API_KEY = $env.ZEROBOUNCE_API_KEY;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function verifyEmail(email, attempt = 1) {
  const url = `https://api.zerobounce.net/v2/validate?api_key=${ZEROBOUNCE_API_KEY}&email=${encodeURIComponent(email)}`;
  
  try {
    const response = await fetch(url, { timeout: 10000 });
    
    if (response.status === 429) {
      // Rate limited — exponential backoff
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
        return verifyEmail(email, attempt + 1);
      }
      return { status: 'rate_limited', verified: false };
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      status: data.status,
      verified: ['valid', 'catch-all'].includes(data.status),
      sub_status: data.sub_status,
      free_email: data.free_email,
      verified_at: new Date().toISOString(),
    };
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
      return verifyEmail(email, attempt + 1);
    }
    return { status: 'error', verified: false, error: error.message };
  }
}

const verification = await verifyEmail(lead.email);

return [{
  json: {
    ...lead,
    email_verification: verification,
    should_send: verification.verified && !verification.free_email,
  },
}];
```

---

## 3. AI Personalization Generator

Generates a personalized outreach email using context about the lead's business.

```javascript
// n8n OpenAI Node — Personalized Email Generation

const lead = $input.first().json;

const systemPrompt = `You write short, personalized cold outreach emails for B2B service offerings.

Rules:
- Maximum 80 words
- Reference something specific from the lead's business
- Lead with their pain point, not our solution
- One clear call-to-action: a 15-minute call
- No clichés ("hope this finds you well", "circling back")
- Friendly but professional tone

Format the output as JSON:
{
  "subject": "...",
  "body": "...",
  "personalization_signal": "what specific detail you used"
}`;

const leadContext = `
Lead business name: ${lead.business_name}
Industry: ${lead.industry}
Website: ${lead.website}
Location: ${lead.city}, ${lead.country}
Business description (from scraping): ${lead.description || 'Not available'}
Recent reviews mention: ${lead.review_themes || 'Not analyzed'}
Number of employees: ${lead.employee_count || 'Unknown'}

Our offering: AI automation that handles their customer inquiries 24/7 across WhatsApp, Instagram, and email. Saves their team 20+ hours/week.

Pain points common in their industry: ${lead.industry_pain_points || 'Slow response times to inquiries'}
`;

return [{
  json: {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: leadContext },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  },
}];
```

---

## 4. Human Approval Queue Builder

Every email gets queued for human review before sending. This builds the approval payload.

```javascript
// n8n Code Node — Approval Queue Builder

const lead = $('Verified Lead').first().json;
const aiEmail = JSON.parse($('AI Email Generation').first().json.message.content);

const approvalRecord = {
  approval_id: crypto.randomUUID(),
  created_at: new Date().toISOString(),
  status: 'pending_review',
  
  // Lead context
  lead: {
    business_name: lead.business_name,
    email: lead.email,
    website: lead.website,
    industry: lead.industry,
    location: `${lead.city}, ${lead.country}`,
  },
  
  // Email to send
  email: {
    to: lead.email,
    subject: aiEmail.subject,
    body: aiEmail.body,
    personalization_signal: aiEmail.personalization_signal,
  },
  
  // Quality checks
  quality_signals: {
    word_count: aiEmail.body.split(/\s+/).length,
    has_greeting: /^(hi|hello|hey)/i.test(aiEmail.body),
    has_cta: /(call|chat|meeting|conversation|talk)/i.test(aiEmail.body),
    has_personalization: !!aiEmail.personalization_signal && aiEmail.personalization_signal !== 'None',
    no_clichés: !/(hope this finds you well|circling back|just checking in)/i.test(aiEmail.body),
  },
  
  // Approval URLs (Telegram bot interaction)
  approval_actions: {
    approve_url: `https://t.me/our_approval_bot?start=approve_${lead.id}`,
    edit_url: `https://t.me/our_approval_bot?start=edit_${lead.id}`,
    reject_url: `https://t.me/our_approval_bot?start=reject_${lead.id}`,
  },
};

return [{ json: approvalRecord }];
```

---

## 5. Approval Status Polling and Send Decision

Periodically check which approvals have been processed and send only approved ones.

```javascript
// n8n Code Node — Send Decision

const approvalRecords = $('Get Pending Approvals').all();
const APPROVAL_TIMEOUT_HOURS = 48;

const decisions = [];

for (const record of approvalRecords) {
  const r = record.json;
  const ageHours = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60);
  
  if (r.status === 'approved') {
    decisions.push({
      action: 'send',
      approval_id: r.approval_id,
      to: r.email.to,
      subject: r.email.subject,
      body: r.email.body,
      lead_id: r.lead.id,
    });
  } else if (r.status === 'edited_approved') {
    // Human edited then approved — use edited version
    decisions.push({
      action: 'send',
      approval_id: r.approval_id,
      to: r.email.to,
      subject: r.edited_subject || r.email.subject,
      body: r.edited_body || r.email.body,
      lead_id: r.lead.id,
      was_edited: true,
    });
  } else if (r.status === 'rejected') {
    decisions.push({
      action: 'mark_rejected',
      approval_id: r.approval_id,
      reason: r.rejection_reason || 'Manual rejection',
    });
  } else if (ageHours > APPROVAL_TIMEOUT_HOURS) {
    // Approval timed out — auto-archive
    decisions.push({
      action: 'archive_unprocessed',
      approval_id: r.approval_id,
      age_hours: ageHours,
    });
  }
  // else: still pending, do nothing
}

return decisions.map((d) => ({ json: d }));
```

---

## Design principles demonstrated

1. **Multiple dedup signals** — email, phone, domain all checked
2. **Retry with exponential backoff** — handles transient API failures
3. **Personalization with specific signals** — avoids generic cold outreach
4. **Human-in-the-loop required** — no email sends without explicit approval
5. **Timeout handling** — pending approvals don't pile up forever
6. **Quality signals tracked** — measure prompt effectiveness over time
