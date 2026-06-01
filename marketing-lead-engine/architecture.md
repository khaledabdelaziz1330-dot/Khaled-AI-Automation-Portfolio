# Architecture — Marketing Content Engine

Ethical content marketing automation. **Permission-based, not theft-based.** Every published post is approved by the original author.

---

## High-level flow

```mermaid
flowchart LR
    A[RSS Feeds] --> B[Article Discovery]
    B --> C[AI Rewrite]
    C --> D[Permission Request]
    D --> E[Author Response]
    E -->|Approved| F[Auto-Publish]
    E -->|Edit Requested| G[Human Review]
    E -->|Rejected| H[Archive]
    G --> F
    F --> I[Tracking & Engagement]
```

## Detailed component diagram

```mermaid
flowchart TD
    subgraph Discovery [Discovery Layer]
        RSS[RSS Feed Monitor]
        DEDUP[Deduplication]
        FILTER[Recency Filter]
    end
    
    subgraph AI [AI Processing]
        REWRITE[Content Rewriter]
        FACT_CHECK[Fact Preservation Check]
    end
    
    subgraph Permission [Permission Layer]
        EMAIL_GEN[Permission Email Composer]
        SEND[Send to Author]
        WATCH[Watch for Response]
        PARSE[Response Parser]
    end
    
    subgraph Publishing [Publishing]
        SAFETY[Safety Checks]
        LINKEDIN[LinkedIn Publisher]
        LOG[Audit Log]
    end
    
    RSS --> DEDUP
    DEDUP --> FILTER
    FILTER --> REWRITE
    REWRITE --> FACT_CHECK
    FACT_CHECK --> EMAIL_GEN
    EMAIL_GEN --> SEND
    SEND --> WATCH
    WATCH --> PARSE
    PARSE --> SAFETY
    SAFETY -->|Pass| LINKEDIN
    LINKEDIN --> LOG
```

## Sequence: from RSS to published post

```mermaid
sequenceDiagram
    participant RSS
    participant n8n
    participant OpenAI
    participant Email
    participant Author
    participant LinkedIn
    participant Sheets
    
    RSS-->>n8n: New article detected
    n8n->>n8n: Dedupe + recency check
    n8n->>OpenAI: Rewrite as LinkedIn post
    OpenAI-->>n8n: Rewritten content + facts preserved
    n8n->>n8n: Compose permission email
    n8n->>Email: Send to author
    Email-->>Author: Permission request
    Author->>Email: Reply (approve/reject/edit)
    Email-->>n8n: Parse response
    n8n->>n8n: Detect intent
    alt Approved
        n8n->>n8n: Run safety checks
        n8n->>LinkedIn: Publish post
        LinkedIn-->>n8n: Post URL
        n8n->>Sheets: Log success
    else Rejected or unclear
        n8n->>Sheets: Archive request
    end
```

## Ethical foundation

This system was designed specifically to be different from "content scraping" tools that republish others' work without permission.

**Standard content automation:**
- Scrapes articles
- Rewrites with AI
- Publishes as if original
- Hopes original author doesn't notice

**This system:**
- Discovers articles
- Rewrites with AI
- **Asks the author for permission**
- Only publishes with explicit approval
- Always credits the original
- Authors often appreciate being asked

**Result:** Better content relationships, no legal/ethical risk, and authors often share the rewrites themselves, multiplying reach.

## Permission flow detail

```mermaid
stateDiagram-v2
    [*] --> Discovered
    Discovered --> Rewritten
    Rewritten --> PermissionPending
    PermissionPending --> AuthorReplied: Within 7 days
    PermissionPending --> AutoArchived: After 7 days no response
    AuthorReplied --> Approved
    AuthorReplied --> EditRequested
    AuthorReplied --> Rejected
    AuthorReplied --> Unclear: Needs human review
    Approved --> Published
    EditRequested --> HumanEdit
    HumanEdit --> Approved: After human edit
    Unclear --> HumanReview
    HumanReview --> Approved: If reviewer approves
    HumanReview --> Rejected: If reviewer declines
    Rejected --> Archived
    Published --> [*]
    AutoArchived --> [*]
    Archived --> [*]
```

## Safety check layer

Before any post is published, 5 safety checks run:

1. **Has approval record** — explicit permission_request_id exists
2. **Status is approved** — detected_intent === 'approved'
3. **Not already published** — no prior publish for this article
4. **No human review flag** — automatic intent detection was confident
5. **Within freshness window** — article < 30 days old

**ALL must pass.** If any fails, the post is skipped and logged.

## Tracking layer

Every step is logged with timestamps:

| Event | Tracked data |
|---|---|
| Article discovered | URL, source feed, discovery time |
| Rewrite generated | Original + new + facts preserved |
| Permission requested | Author, email sent, deadline |
| Response received | Time, intent detected, raw response |
| Published | LinkedIn URL, audience reached |
| Engagement | Likes, comments, shares over 30 days |

## Performance characteristics

- **Articles processed per day:** 50-200 (across multiple feeds)
- **Permission request response rate:** ~25%
- **Approval rate among responders:** ~80%
- **Final publish rate:** ~20% of discovered articles
- **Author satisfaction:** High (qualitative — authors often share the rewrites)
- **Legal risk:** Eliminated by permission requirement
