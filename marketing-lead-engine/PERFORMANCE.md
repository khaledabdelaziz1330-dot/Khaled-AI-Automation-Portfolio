# Performance Characteristics — Marketing Content Pipeline

Design parameters and cost model for the permission-based content pipeline in [`workflow.json`](workflow.json). The workflow ends when the permission request is sent and logged, so this page makes no claims about author response, approval, or publication rates.

---

## Design Parameters

| Parameter | Value | Where it is set |
|---|---|---|
| Scan cadence | Every 6 hours (4 cycles/day) | Every 6 Hours trigger |
| Feed list | Rows with `active = TRUE` | ActiveFeeds sheet |
| Freshness window | Published in the last 48 hours | Filter New & Recent |
| Content sent to the model | Up to 2,000 characters of snippet | Filter New & Recent |
| Draft length | Max 300 words, one post per article | AI Rewrite prompt |
| Model settings | GPT-4o, temperature 0.7, JSON output | AI Rewrite |
| Author response window | 7 days (`response_deadline`) | Compose Permission Request |

---

## Throughput

| Stage | Typical time |
|---|---|
| AI rewrite (GPT-4o) | ~30 sec per article |
| Permission email send | <5 sec |

The AI rewrite dominates per-article time. Volume scales with the number of active feeds and how often they publish; the 48-hour window and SeenArticles check keep each cycle to genuinely new items.

---

## Cost Model

| Component | Cost |
|---|---|
| RSS scanning | $0 |
| AI rewrite | ~$0.05-0.10 per article |
| Gmail send | $0 |
| Google Sheets | $0 |

AI cost is linear in new articles: for example, 100 new articles a month is roughly $5-10 in API spend.

---

## Quality Controls

| Control | How |
|---|---|
| No duplicate outreach | URL checked against SeenArticles; each processed article is marked seen |
| No invented content | Prompt forbids adding facts; model lists `facts_preserved` for reviewer spot-checks |
| No impersonation | Prompt forbids writing as the author; draft ends with an "Original article by" source line |
| Consent before sharing | Workflow publishes nothing; it only sends the request and logs it |

---

## Comparison to "Standard" Content Marketing Automation

Standard tools scrape and republish without asking. This pipeline asks first.

| Approach | Reach | Reputation | Legal risk |
|---|---|---|---|
| Standard scrape-republish | Higher initial | Erodes over time | Real |
| **This permission-based pipeline** | **Lower initial, slower cadence** | **Builds author relationships** | **Substantially reduced** |

---

## Where this hits limits

- **High-frequency news cycles:** the permission step adds up to a 7-day delay. Not suitable for breaking news.
- **Inferred author emails:** addresses are guessed from the author name and article domain and are not verified, so some requests will bounce or reach a generic inbox. An email-finder or verification step would improve delivery.
- **Anonymous-author sources:** articles with no detectable author go to `editor@domain`, which limits sourcing options.
- **Replies are not parsed:** reply handling and publishing are manual from the PermissionRequests sheet; automating them needs a reply-ingestion and approval stage.
- **URL-only dedup:** the same story syndicated under different URLs can be drafted twice.
- **Facts are self-reported:** `facts_preserved` comes from the model itself; there is no independent fact check.
- **Non-English feeds:** the email template is English-only.
