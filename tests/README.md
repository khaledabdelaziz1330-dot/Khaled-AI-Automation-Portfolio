# Tests

Automated tests that run on every push (GitHub Actions) and prove the claims in this portfolio.

```bash
npm test          # or: node --test tests/*.test.js
```

No dependencies — Node.js 20+ and its built-in test runner. The tests load the **real code from each `workflow.json`** at run time ([`helpers/n8n.js`](./helpers/n8n.js) provides n8n's `$input`, `$('Node')`, `$env` and `$now`), so they test exactly what ships — never a copy that could drift.

## What is tested

| File | What it proves |
|---|---|
| [`standards.test.js`](./standards.test.js) | Every workflow: valid connections, unique nodes, placeholder-only credentials, no secrets, failures routed to the shared error handler, **reads and AI calls retry 3× / 2 s while sends and bookings never auto-retry**, and no LLM call triggered twice by parallel branches |
| [`error-handler.test.js`](./error-handler.test.js) | Tokens, API keys, emails and phone numbers are redacted from logs and alerts; severity rules page humans only for customer-facing failures |
| [`document-automation.test.js`](./document-automation.test.js) | Code — not the LLM — computes every quantity; rounding, imbalance, invalid input and duplicates are caught; any warning blocks auto-export |
| [`clinic.test.js`](./clinic.test.js) | Four channels normalize to one schema; slots are 09:00–19:00 **Cairo time on any server time zone** (incl. daylight saving), Fridays closed, 15-minute buffers respected |
| [`hostzera.test.js`](./hostzera.test.js) | Input guards before the LLM; retrieval ranks exact product matches first, caps context at 5 rows, and says "no match" explicitly instead of letting the model guess |
| [`lead-generation.test.js`](./lead-generation.test.js) | Every scraped business is read; dedup by email, phone and domain — against history and within the same run |
| [`marketing.test.js`](./marketing.test.js) | Authors are emailed only at an address the publisher lists; addresses are never guessed; every request is logged |
| [`wellness.test.js`](./wellness.test.js) | GoHighLevel webhook retries are detected and logged once |

## Bugs found and fixed while building the suite

The quality pass that produced these tests found real defects. All are fixed, and the tests now fail if any of them comes back:

- **Clinic time zone** — slot generation used the server's local clock, so a UTC server would have offered slots two to three hours late (11:00–21:00 Cairo time in winter). Slots are now computed in `Africa/Cairo` explicitly.
- **Duplicate model calls** — two workflows fed parallel branches straight into a model or dedup step, running it twice per message. Branches are now joined first.
- **Marketing outreach** — a step guessed authors' email addresses from their names. It now uses only addresses published in the feed.
