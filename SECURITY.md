# Security Practices

This document explains how sensitive data is handled across all systems in this portfolio. Production AI automation involves real customer data, real API credentials, and real money — and the engineering practices need to reflect that.

---

## What this repository does NOT contain

- ❌ No real API keys or tokens (all use `REPLACE_*` placeholders or `$env.*` references)
- ❌ No real Google Sheet IDs (referenced via environment variables)
- ❌ No real customer PII (conversation examples are illustrative)
- ❌ No real OAuth credentials
- ❌ No actual webhook URLs from production deployments

If you spot any sensitive data leaked here, please open an issue immediately or email khaledabdelaziz1330@gmail.com.

---

## How sensitive data is handled in production

### 1. Credentials never live in code

All credentials reference n8n's credential vault by ID:
```json
"credentials": {
  "openAiApi": { "id": "REPLACE_OPENAI_CREDENTIAL_ID", "name": "OpenAI" }
}
```

Configuration values use environment variables:
```javascript
$env.WHATSAPP_ACCESS_TOKEN
$env.CALENDAR_ID
$env.SLACK_ERROR_CHANNEL
```

### 2. Sanitization in error handlers

Every workflow's error handler sanitizes payloads before logging:
```javascript
function sanitize(obj) {
  const sensitive = ['api_key', 'authorization', 'password', 'token', 'secret', 'bearer'];
  // Recursively replace any matching field with [REDACTED]
}
```

PII in conversation logs (phone numbers, emails) is hashed or truncated when forwarded outside the immediate processing flow.

### 3. Webhook validation

Public webhook endpoints validate:
- Source signature (where the platform provides one — e.g., Meta signs WhatsApp webhooks)
- Expected payload structure
- Rate limits per source IP / session
- Message length bounds (rejecting oversized payloads)

### 4. Principle of least privilege

OAuth scopes requested for credentials match the workflow's actual needs:
- Google Sheets: scoped to specific Sheet IDs where possible
- Google Calendar: read/write on specific Calendar IDs only
- Gmail: send-only where the workflow only sends (no inbox read access)
- WhatsApp/Meta: messages only, not user profile data

### 5. Data retention boundaries

- Conversation logs: retained in Google Sheets per client agreement (typically 90 days)
- Error logs: retained 30 days, sanitized aggressively
- AI prompt/response logs: stored separately from PII, used for prompt iteration

### 6. Third-party data flows

When data leaves the immediate n8n + Google Workspace boundary:
- **OpenAI / Anthropic:** Sent only what's needed for the immediate response. Conversation history is summarized rather than streamed in full for long sessions.
- **ZeroBounce:** Email addresses only, no other PII
- **Apify:** Public business data scraped from Google Maps, no PII

---

## Known limitations of these patterns

I document these honestly because pretending a system is perfect is itself a security risk:

1. **n8n self-hosted instances must be secured** — VPS hardening, firewall, regular updates are the operator's responsibility. The workflow JSON doesn't protect a poorly-configured server.

2. **Google Sheets is not a secure data store for highly sensitive PII** — for clinics handling health records, additional encryption-at-rest or migration to HIPAA-compliant storage is required.

3. **Webhook endpoints are public by design** — security comes from signature validation and rate limiting, not obscurity.

4. **AI provider data policies are the provider's** — what OpenAI does with API request data is governed by their data policy, not ours. Customers signing on must be told this clearly.

---

## If you're evaluating these systems for production use

Questions to ask:
- Where will the n8n instance be hosted, and who has access?
- What's the OAuth scope policy for each credential?
- Is there a data processing agreement with the client?
- What's the incident response plan if credentials are compromised?
- Who reviews the error logs, and how often?

I'm happy to walk through these in detail for any real engagement.

---

## Contact for security concerns

If you find a security issue in any code or documentation in this repository:

**Email:** khaledabdelaziz1330@gmail.com

I will acknowledge within 24 hours and remediate any verified issue within 7 days.
