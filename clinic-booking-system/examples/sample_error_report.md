# Sample Error Reports

Real error patterns from the clinic AI receptionist's monitoring layer. Errors are sanitized of API keys, tokens, and patient PII before logging.

---

## Error Report 1 — OpenAI Rate Limit (Auto-Recovered)

```
🚨 MEDIUM — Workflow Error

Workflow:     clinic-receptionist
Node:         Intent Classifier (gpt-4o-mini)
Time:         2026-04-15T14:23:41Z
Execution:    exec_a8f3e2b1

Error:
Rate limit reached for gpt-4o-mini in organization
[REDACTED]: Limit 60000 TPM, Used 60000 TPM,
Requested 247 TPM. Please try again in 1.7s.

Retry status:  attempt 1 of 3 in 2000ms
Resolution:    auto-recovered after retry 2
Customer impact: none (response sent ~3 seconds late)
```

**What happened:** Brief OpenAI rate limit during a traffic spike. Workflow's built-in retry logic handled it transparently.

**Action taken:** None required. Logged for monthly review.

**Follow-up:** Spike pattern noted; if recurring, consider spreading load across two OpenAI API keys.

---

## Error Report 2 — WhatsApp Account Disconnected (Client Action Required)

```
🚨 HIGH — Workflow Error

Workflow:     clinic-receptionist
Node:         Send Reply via API
Time:         2026-04-22T09:17:03Z
Execution:    exec_b9d4f1c2

Error:
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

Retry status:  3 attempts failed
Resolution:    client notified, reauthorization required
Customer impact: 8 WhatsApp messages queued for delivery
```

**What happened:** Client's WhatsApp Business account got disconnected (likely 2FA event or password change).

**Action taken:** Slack alert sent to clinic owner with reauthorization instructions. Queued messages held for redelivery after reconnect.

**Follow-up:** Reconnected within 90 minutes by clinic owner. Queued messages delivered successfully. No patient lost.

---

## Error Report 3 — Google Calendar Token Expired

```
🚨 MEDIUM — Workflow Error

Workflow:     clinic-receptionist
Node:         Get Calendar Events
Time:         2026-05-03T11:48:22Z
Execution:    exec_c0a5d4e3

Error:
{
  "error": {
    "code": 401,
    "message": "Request had invalid authentication
                credentials. Token expired or revoked."
  }
}

Retry status:  not retried (auth error, retry won't help)
Resolution:    operator re-authorized credential
Customer impact: 1 booking delayed by ~15 minutes
```

**What happened:** Google OAuth refresh token expired (Google rotates these periodically).

**Action taken:** Operator re-ran OAuth flow in n8n credentials. Quick fix once spotted.

**Follow-up:** Added monthly calendar reminder to verify credential health proactively.

---

## Error Report 4 — Malformed Webhook Payload (Logged, Ignored)

```
🚨 LOW — Workflow Error

Workflow:     clinic-receptionist
Node:         Normalize Payload
Time:         2026-05-12T03:42:11Z
Execution:    exec_d1b6e5f4

Error:
Unsupported channel payload. Keys:
[entry, object, [REDACTED]]

Retry status:  not retried (malformed input, retry won't help)
Resolution:    payload sanitized and discarded
Customer impact: none
```

**What happened:** Likely a webhook test ping from Meta's verification system, or a malformed third-party scraper.

**Action taken:** Caught by validation node. Logged with sanitized excerpt. No further action.

**Follow-up:** None. This pattern occurs ~2-3 times per month from various sources, all benign.

---

## Patterns visible across these errors

1. **Severity classification works:** HIGH for client-blocking issues, MEDIUM for transient, LOW for noise
2. **Sanitization works:** No API keys, tokens, or patient PII in any log entry
3. **Retry logic works:** Transient errors (rate limits) recover automatically
4. **Auth errors are handled correctly:** Don't retry (waste of time); alert immediately
5. **Customer impact is tracked:** Every error report includes the actual user-facing consequence

The error monitoring layer is what makes this system "production-grade" instead of "demo-quality." Without it, all four of these errors would have silently degraded the system.
