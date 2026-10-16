# Sample Error Reports

Real error patterns from the clinic AI receptionist's monitoring layer. The workflow's `settings.errorWorkflow` points to the portfolio's [shared error handler](../../shared-error-handler), which redacts secrets, emails and phone numbers before anything is logged. Each report below shows the sanitized `Errors` sheet row, followed by what happened.

Severity follows the handler's rules: **high** for channel send, calendar and 401/403 failures (logged + Slack alert), **low** for rate limits and timeouts (logged only), **medium** for everything else (logged only).

---

## Error Report 1 — OpenAI Rate Limit (Absorbed by Node Retry)

```
Execution log (no Errors row — the error workflow never fired)

workflow_name: Clinic AI Receptionist - Multi-Channel Booking System
node:          Classify Intent (gpt-4o-mini)
time:          2026-04-15T14:23:41Z

error (try 1 of 3):
Rate limit reached for gpt-4o-mini in organization
[REDACTED]: Limit 60000 TPM, Used 60000 TPM,
Requested 247 TPM. Please try again in 1.7s.

retry status:    node-level retry, 2000 ms between tries
resolution:      succeeded on try 2
customer impact: none (reply sent ~3 seconds late)
```

**What happened:** Brief OpenAI rate limit during a traffic spike. The node's retry setting (3 tries, 2 s apart) absorbed it inside the execution.

**Action taken:** None required. Noted in the monthly execution review.

**Follow-up:** If the pattern recurs, spread load across a second OpenAI API key.

---

## Error Report 2 — WhatsApp Account Disconnected (Client Action Required)

```
severity:      high
workflow_name: Clinic AI Receptionist - Multi-Channel Booking System
failed_node:   Send Reply via API
occurred_at:   2026-04-22T09:17:03Z
execution_id:  [execution id]

error_message:
{
  "error": {
    "message": "WhatsApp Business account has been
                disconnected. Reauthorize at
                business.facebook.com",
    "type": "OAuthException",
    "code": 190,
    "fbtrace_id": "[REDACTED]"
  }
}

retry status:    3 of 3 tries failed
resolution:      Slack alert; client reauthorization required
customer impact: 8 WhatsApp replies not delivered during the outage
```

**What happened:** The client's WhatsApp Business account was disconnected (most likely a 2FA event or password change on the Meta side).

**Action taken:** The Slack alert reached the team within the same execution; the clinic owner was sent reauthorization instructions.

**Follow-up:** Reconnected within 90 minutes by the clinic owner. The 8 affected patients were followed up after reconnection. No patient lost.

---

## Error Report 3 — Google Calendar Token Expired

```
severity:      high
workflow_name: Clinic AI Receptionist - Multi-Channel Booking System
failed_node:   Get Calendar Events
occurred_at:   2026-05-03T11:48:22Z
execution_id:  [execution id]

error_message:
{
  "error": {
    "code": 401,
    "message": "Request had invalid authentication
                credentials. Token expired or revoked."
  }
}

retry status:    3 of 3 tries failed (auth errors do not recover on retry)
resolution:      Slack alert; operator re-authorized the credential
customer impact: 1 booking delayed by ~15 minutes
```

**What happened:** The Google OAuth refresh token expired.

**Action taken:** Operator re-ran the OAuth flow in n8n credentials.

**Follow-up:** Added a monthly reminder to verify credential health proactively.

---

## Error Report 4 — Malformed Webhook Payload (Logged, Ignored)

```
severity:      medium
workflow_name: Clinic AI Receptionist - Multi-Channel Booking System
failed_node:   Normalize Payload
occurred_at:   2026-05-12T03:42:11Z
execution_id:  [execution id]

error_message:
Unsupported channel payload. Keys: entry, object

retry status:    not applicable (Code node, deterministic input)
resolution:      logged; no reply sent
customer impact: none
```

**What happened:** Most likely a test ping from Meta's webhook tooling or a malformed third-party request.

**Action taken:** The normalizer rejected it and the error handler logged it. No further action.

**Follow-up:** None. This pattern occurs 2–3 times per month, all benign.

---

## Patterns visible across these errors

1. **Retries absorb transient errors:** rate limits recover inside the execution and never page anyone
2. **Severity classification works:** client-blocking failures (channel send, calendar auth) alert; noise is logged only
3. **Sanitization works:** no API keys, tokens, emails or phone numbers in any logged row
4. **Unknown input fails loudly:** the normalizer throws instead of guessing, so bad payloads are visible
5. **Customer impact is tracked:** every report records the user-facing consequence

The monitoring layer is what makes this system production-grade rather than demo-quality. Without it, three of these four errors would have silently degraded the service.
