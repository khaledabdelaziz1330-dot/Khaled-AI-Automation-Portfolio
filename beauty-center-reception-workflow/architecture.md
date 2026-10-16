# Architecture — Beauty Center AI Reception

Multi-channel reception system for beauty and wellness businesses: service matching from informal language, qualified-specialist booking with conflict checks, and preference-aware personalization. This document covers the exported [`workflow.json`](./workflow.json) and marks where production-only components take over.

---

## System overview

```mermaid
flowchart TD
    A[Client Message] -->|WhatsApp / IG / Messenger| B[Normalize Message]
    B --> C[Get Client with Preferences]
    C --> D[Get Services Catalog]
    D --> E[Get Specialists]
    E --> F[Service Matcher]
    F --> G[AI Conversation Manager]
    G --> H[Get All Calendar Events]
    H --> I[Specialist Match + Availability]
    I --> J{Should Book?}
    J -->|Yes| K[Create Booking]
    K --> L[Update Client Preferences]
    L --> M[Webhook Response]
    J -->|No| M
```

The lookups run sequentially rather than in parallel. In n8n, a node fed by several parents runs once per parent, which would repeat the AI call and the booking. Chained lookups (with empty results passed through for first-time clients) guarantee one AI call and at most one booking per inbound message.

## Service matching strategy

Beauty services have many informal names. Matching is deterministic code, not a model guess.

```mermaid
flowchart LR
    A["User: I need a wash and trim"] --> B[Lowercase message]
    B --> C[Score every active service by matched keywords]
    C --> D{Clear top match?}
    D -->|Yes| E[Matched service passed to AI]
    D -->|Ambiguous| F[AI asks a clarifying question]
    D -->|No match| G[AI asks what service they want]
    F --> H[Next message re-matched]
    G --> H
```

- Each service's keywords are its name, `alternate_names` and `keywords` columns from the `Services` sheet
- Each matched keyword adds its length to the score, so longer, more specific matches win
- If the runner-up scores at least 70% of the top match, the request is flagged ambiguous

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
    A[Booking-ready request + matched service] --> B[Filter: who can perform this service?]
    B --> C{Client has a preferred specialist?}
    C -->|Yes, and qualified| D[Preferred specialist first]
    C -->|No| E[Qualified specialists in sheet order]
    D --> F[For each specialist: generate slots in shift]
    E --> F
    F --> G[Drop slots overlapping existing appointments]
    G --> H{Any open slot?}
    H -->|Yes| I[Recommend first specialist with slots, up to 2 alternatives]
    H -->|No| J[Skip booking, reply only]
```

- **Slots:** 30-minute steps inside the specialist's `shift_start`–`shift_end` (defaults 10:00–19:00), sized to the service's `duration_minutes`
- **Lead time:** no slot earlier than 30 minutes from now
- **Window:** from the requested date (or tomorrow) for up to 7 days; up to 3 slots per specialist
- **Booking:** the first slot of the recommended specialist is written to Google Calendar

## Client record

Every booking upserts the client's row in the `Clients` sheet, matched on `user_id`:

```mermaid
erDiagram
    CLIENT ||--o{ APPOINTMENT : books
    SPECIALIST ||--o{ APPOINTMENT : performs
    SERVICE ||--o{ APPOINTMENT : involves
    CLIENT {
        string user_id
        string name
        string channel
        string preferred_specialist
        string last_service
        datetime last_booking_start
        int total_bookings
        datetime updated_at
    }
    SPECIALIST {
        string id
        string name
        string qualified_services
        int shift_start
        int shift_end
        string calendar_id
        boolean active
    }
    SERVICE {
        string id
        string service_name
        string alternate_names
        string keywords
        int duration_minutes
        boolean active
    }
    APPOINTMENT {
        datetime start
        datetime end
        string summary
        string description
    }
```

**What carries forward:** the specialist from the latest booking becomes `preferred_specialist` and is offered first next time. The AI also receives the full client record, so it can personalize the reply (returning client vs. new client, multi-branch options only for new clients).

## Production-only components (not in this export)

### Multi-branch routing

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

The export books against one appointment calendar (`BEAUTY_CALENDAR_ID`).

### Service-aware follow-up cadence

Different services have different natural rebooking windows. The production follow-up agent schedules rebook reminders accordingly:

| Service | Typical rebook timing |
|---|---|
| Haircut | ~4 weeks |
| Color/Highlights | ~6 weeks (root touch-up) |
| Manicure | ~2 weeks |
| Facial | ~6 weeks |
| Waxing | ~3 weeks |
| Lashes | ~3 weeks |
| Massage | ~4 weeks |

### Multi-turn conversation memory

```mermaid
sequenceDiagram
    participant Client
    participant Bot
    participant Memory as Chat memory

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

The export carries context through the client record only; turn-by-turn chat memory is part of the production deployment.

## Reliability features

- **Exactly-once AI call and booking per message** — sequential lookups, no fan-in
- **No double bookings** — every slot is checked against existing appointments before it is offered or booked
- **Deterministic matching and selection** — the model never picks the service, specialist or slot
- **Idempotent client records** — upserted on `user_id`
- **Node-level retries** — 3 tries, 2 s apart on every read, AI call and client upsert; none on the booking write, so a timeout can never duplicate an appointment
- **Shared error handler** — sanitized logging, Slack alert on high-severity failures (booking, calendar, auth)
- **Safe reply encoding** — the webhook response is built with `JSON.stringify`, so quotes or line breaks in a reply never break the payload

## Performance characteristics

- **Channels unified:** WhatsApp, Instagram, Messenger (Telegram payloads also parsed)
- **Response time:** 60–90 s typical end to end (3 min P95); under 90 s met 96% of the time
- **Service matching:** 86% correct on the first message (500-booking audit)
- **Double bookings:** 0
- **Preferred specialist:** 78% of clients booked with their preferred specialist when available
- **Client lifetime value:** estimated +25% vs pre-automation

Full data in [`PERFORMANCE.md`](./PERFORMANCE.md).
