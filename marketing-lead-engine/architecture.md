# Architecture — Marketing Content Pipeline

Ethical content marketing automation. **Permission-based, not theft-based.** The pipeline drafts a post and asks the original author for consent; it never publishes on its own.

---

## High-level flow

```mermaid
flowchart LR
    A[RSS Feeds] --> B[Article Discovery]
    B --> C[AI Rewrite]
    C --> D[Permission Request]
    D --> E[Request Log]
    E -.->|hand-off| F[Reply handling and publishing - outside this workflow]
```

## Detailed component diagram

Every box maps to a node in [`workflow.json`](workflow.json).

```mermaid
flowchart TD
    subgraph Discovery [Discovery Layer]
        TRIG[Every 6 Hours]
        FEEDS[Get Active Feed URLs]
        RSS[Read RSS Feed]
        SEEN[Check If Already Seen]
        FILTER[Filter New and Recent]
    end

    subgraph AI [AI Processing]
        REWRITE[AI Rewrite - GPT-4o]
    end

    subgraph Permission [Permission Layer]
        EMAIL_GEN[Compose Permission Request]
        SEND[Send Permission Email]
    end

    subgraph Tracking [Tracking]
        LOG[Log Permission Request]
        MARK[Mark as Seen]
    end

    TRIG --> FEEDS
    FEEDS --> RSS
    RSS --> SEEN
    SEEN --> FILTER
    FILTER --> REWRITE
    REWRITE --> EMAIL_GEN
    EMAIL_GEN --> SEND
    SEND --> LOG
    SEND --> MARK
```

## Sequence: from RSS to permission request

```mermaid
sequenceDiagram
    participant RSS
    participant n8n
    participant Sheets
    participant OpenAI
    participant Gmail
    participant Author

    n8n->>Sheets: Get active feed URLs
    n8n->>RSS: Read each feed
    RSS-->>n8n: Articles
    n8n->>Sheets: Check URL in SeenArticles
    n8n->>n8n: Keep new articles under 48 hours old
    n8n->>OpenAI: Rewrite as LinkedIn post (JSON)
    OpenAI-->>n8n: Draft + facts preserved + notes
    n8n->>n8n: Compose permission email
    n8n->>Gmail: Send to author
    Gmail-->>Author: Permission request with draft
    n8n->>Sheets: Log request (pending_response, 7-day deadline)
    n8n->>Sheets: Mark article as seen
```

## Ethical foundation

This pipeline was designed to be different from "content scraping" tools that republish others' work without permission.

**Standard content automation:**
- Scrapes articles
- Rewrites with AI
- Publishes as if original
- Hopes the original author doesn't notice

**This pipeline:**
- Discovers articles
- Rewrites with AI, preserving the original facts
- **Asks the author for permission, with the full draft attached**
- Always credits and links the original
- Publishes nothing automatically

**Result:** content relationships built on consent, and a clear record of every request.

## Permission request lifecycle

States set by this workflow, and where the hand-off happens:

```mermaid
stateDiagram-v2
    [*] --> Discovered
    Discovered --> Skipped: Already seen or older than 48h
    Discovered --> Rewritten
    Rewritten --> PermissionPending: Email sent, logged as pending_response
    PermissionPending --> HandOff: Reply or 7-day deadline
    HandOff --> [*]
    Skipped --> [*]
```

`HandOff` is outside this workflow: replies land in Gmail and are actioned from the PermissionRequests sheet.

## Guardrails

Built into the exported workflow:

1. **Dedup before spend** — SeenArticles lookup runs before the AI call, so no article is rewritten or pitched twice
2. **Freshness and completeness** — articles must be under 48 hours old and have a title and snippet
3. **Constrained rewrite** — the prompt forbids new facts and impersonation and requires a source line
4. **Structured output** — JSON response mode; the composer parses `linkedin_post` and `facts_preserved`
5. **Consent before sharing** — the only outbound action is the permission email

## Tracking layer

| Sheet | Tracked data |
|---|---|
| **ActiveFeeds** | Feed URLs and `active` flag (input) |
| **SeenArticles** | URL, title, `discovered_at` |
| **PermissionRequests** | Request ID, article ID / URL / title / author, inferred author email, subject, body, proposed post, facts preserved, `status: pending_response`, `sent_at`, `response_deadline` |

## Performance characteristics

- **Cadence:** every 6 hours, 48-hour freshness window
- **Per-article cost:** ~$0.05-0.10 in GPT-4o spend; ~30 seconds per rewrite
- **Outbound actions:** one permission email per new article; nothing is published automatically
- **Details and limits:** see [PERFORMANCE.md](PERFORMANCE.md)
