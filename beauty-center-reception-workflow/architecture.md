# Architecture — Beauty Center AI Reception

Multi-channel reception system unifying 3+ messaging channels for beauty and wellness service businesses. Handles service matching, specialist booking, multi-branch routing, and preference-based personalization.

---

## System overview

```mermaid
flowchart TD
    A[Client Message] -->|WhatsApp / IG / Messenger| B[Channel Unifier]
    B --> C[Client Identifier]
    C --> D[Conversation Context]
    D --> E[AI Reception Agent]
    E --> F[Service Matcher]
    F --> G[Specialist Selector]
    G --> H[Multi-Branch Router]
    H --> I[Calendar Booker]
    I --> J[Confirmation]
    I --> K[Preference Updater]
    I --> L[Follow-up Scheduler]
```

## Multi-branch architecture

```mermaid
flowchart TD
    subgraph Input [Unified Inbox]
        IN[All channels routed here]
    end
    
    subgraph Routing [Branch Routing]
        BR{Which branch?}
        B1[Branch 1 Calendar]
        B2[Branch 2 Calendar]
        B3[Branch 3 Calendar]
    end
    
    subgraph Specialists [Specialist Pool]
        S1[Branch 1 Staff]
        S2[Branch 2 Staff]
        S3[Branch 3 Staff]
        ROAM[Roaming Specialists]
    end
    
    IN --> BR
    BR -->|Preferred or default| B1
    BR -->|Preferred or default| B2
    BR -->|Preferred or default| B3
    B1 --> S1
    B2 --> S2
    B3 --> S3
    B1 -.-> ROAM
    B2 -.-> ROAM
    B3 -.-> ROAM
```

## Service matching strategy

Beauty services have many informal names. The matcher handles them.

```mermaid
flowchart LR
    A[User: "I need a wash and trim"] --> B[Tokenize]
    B --> C[Match against keywords]
    C --> D{Single match?}
    D -->|Yes| E[Confirmed Service]
    D -->|No, ambiguous| F[Ask Clarification]
    D -->|No matches| G[Show Service Menu]
    F --> H[User selects]
    G --> H
    H --> E
```

**Service keyword examples:**

| Service | Keywords |
|---|---|
| Haircut | haircut, trim, cut, hair cut, fix my hair |
| Color | color, dye, highlights, balayage, ombre, root touch up |
| Manicure | manicure, nails, mani, gel, polish, nail art |
| Pedicure | pedicure, feet, pedi, toes |
| Facial | facial, face treatment, skincare, cleansing |
| Waxing | wax, waxing, eyebrow, leg wax, brazilian |

## Specialist matching

```mermaid
flowchart TD
    A[Service requested] --> B[Filter: who can perform this?]
    B --> C[For each qualified specialist]
    C --> D[Check their calendar]
    D --> E[Calculate available slots]
    E --> F{Has any slot?}
    F -->|Yes| G[Add to candidates]
    F -->|No| H[Skip]
    G --> I[Sort by: rating, availability]
    I --> J{Client preference?}
    J -->|Has preferred| K[Prioritize preferred]
    J -->|None| L[Top candidate]
    K --> M[Offer slots]
    L --> M
```

## Preference tracking model

Every visit updates the client's preference model:

```mermaid
erDiagram
    CLIENT ||--o{ VISIT : has
    CLIENT {
        string client_id
        string name
        string phone
        string preferred_branch
        string preferred_specialist
        json preferred_time_pattern
        json visit_history
        int total_visits
    }
    VISIT {
        string visit_id
        date date
        string service
        string specialist
        string branch
        int rating
    }
    SERVICE ||--o{ VISIT : involves
    SPECIALIST ||--o{ VISIT : performs
```

**What gets learned over time:**
- Preferred specialist (with confidence based on visit count)
- Preferred time of week (morning weekday vs Saturday afternoon, etc.)
- Preferred branch (if multi-location)
- Service combinations often booked together
- Average gap between visits per service

This drives proactive recommendations: *"Hi Sarah, it's been 4 weeks since your last cut — should I book you with Maya again this Saturday morning?"*

## Service-aware follow-up cadence

Different services have different natural rebooking windows:

| Service | Typical rebook timing |
|---|---|
| Haircut | ~4 weeks |
| Color/Highlights | ~6 weeks (root touch-up) |
| Manicure | ~2 weeks |
| Facial | ~6 weeks |
| Waxing | ~3 weeks |
| Lashes | ~3 weeks |
| Massage | ~4 weeks |

The system schedules personalized rebook reminders at the right cadence for the service the client received.

## Conversation context preservation

```mermaid
sequenceDiagram
    participant Client
    participant Bot
    participant Memory
    
    Client->>Bot: Hi, I want a haircut
    Bot->>Memory: Save: intent=haircut, awaiting=time
    Bot->>Client: Sure! When works for you?
    Client->>Bot: Saturday afternoon
    Bot->>Memory: Save: time=Saturday PM
    Memory-->>Bot: Context: haircut + Saturday PM
    Bot->>Bot: Find slots
    Bot->>Client: Maya has 3pm or 4:30pm Saturday
    Client->>Bot: 4:30
    Bot->>Memory: Confirm: book haircut, Maya, Sat 4:30
    Bot->>Client: Confirmed! See you Saturday.
```

## Reliability features

- **Multi-channel unification** — no client lost between WhatsApp and Instagram
- **Conversation memory** — context across multiple message turns
- **Specialist scheduling conflicts** — prevented by calendar check before offering
- **Preference graceful degradation** — if preferred specialist unavailable, system offers alternatives with reasoning
- **Multi-branch routing** — respects client's preferred location
- **Error monitoring** — Slack alerts on any failure
- **Follow-up cancellation** — auto-cancels if client already rebooked

## Performance characteristics

- **Channels unified:** 3+ (WhatsApp, Instagram, Messenger, optionally Telegram)
- **Average response time:** Under 2 minutes
- **Booking conversion (DM to confirmed appointment):** ~75%
- **Client retention via follow-ups:** Estimated 25% lift in rebook rate
- **Manual reception workload reduction:** ~60-70%
