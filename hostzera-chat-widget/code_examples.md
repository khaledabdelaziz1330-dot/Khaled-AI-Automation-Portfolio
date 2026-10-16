# Code Examples — Hostzera AI Chat Widget

Production JavaScript from the retrieval-grounded chat widget, taken verbatim from the Code and HTTP Request nodes in [`workflow.json`](workflow.json). The design goal: retrieve verified knowledge-base data before any LLM call, and make that data the only context the model is allowed to use.

---

## 1. Knowledge Base Retrieval & Scoring

Node: **KB Retrieval & Scoring** (Code). Runs after **Get Knowledge Base** loads all rows where `active = TRUE`. Longer token matches carry more weight, an exact product-name match doubles the score, and only the top 5 rows become context.

```javascript
// KB retrieval - keyword scoring against user message
// Returns top 5 most relevant rows

const userMessage = $('Validate Request').item.json.message.toLowerCase();
const kbRows = $('Get Knowledge Base').all();

const messageTokens = userMessage
  .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
  .split(/\s+/)
  .filter(t => t.length > 2);

function scoreRow(row) {
  const searchable = [
    row.json.product || '',
    row.json.description || '',
    row.json.tags || '',
    row.json.alternate_names || '',
  ].join(' ').toLowerCase();
  
  let score = 0;
  let matchedTokens = [];
  
  messageTokens.forEach(token => {
    if (searchable.includes(token)) {
      score += token.length; // Longer matches = stronger signal
      matchedTokens.push(token);
    }
  });
  
  // Exact product name match boosts score significantly
  if (row.json.product && userMessage.includes(row.json.product.toLowerCase())) {
    score *= 2;
  }
  
  return { row: row.json, score, matchedTokens };
}

const scored = kbRows
  .map(scoreRow)
  .filter(s => s.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);

const retrievedContext = scored.length > 0
  ? scored.map(s => `Product: ${s.row.product}\nDescription: ${s.row.description}\nPrice: ${s.row.price}\nURL: ${s.row.url}`).join('\n---\n')
  : 'No matching products found in knowledge base.';

return [{
  json: {
    retrieved_context: retrievedContext,
    retrieved_count: scored.length,
    retrieved_products: scored.map(s => ({ product: s.row.product, url: s.row.url })),
  },
}];
```

---

## 2. Retrieval-Grounded Response Generation

Node: **Claude Response** (HTTP Request → `https://api.anthropic.com/v1/messages`). The model is explicitly instructed to answer only from the retrieved context; anything outside it gets a hand-off to the team.

Request body (`{{ }}` placeholders are n8n expressions):

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 800,
  "temperature": 0.3,
  "system": "<system prompt below>",
  "messages": [
    {
      "role": "user",
      "content": "{{ $('Validate Request').item.json.message }}"
    }
  ]
}
```

System prompt:

```text
You are Hostzera's AI sales and support assistant.

CRITICAL RULES:
1. Answer ONLY using the information in the Retrieved Context below.
2. If the user asks something not covered by the context, respond with: 'Great question — let me connect you with our team for an accurate answer.'
3. Never invent prices, plans, features, or specifications.
4. Reply in {{ $('Detect Language & Format History').item.json.language_name }}.
5. Be friendly, concise, and helpful.
6. When mentioning a product, you may include its URL inline using markdown.

Retrieved Context:
{{ $('KB Retrieval & Scoring').item.json.retrieved_context }}

Recent conversation (last 10 turns):
{{ $('Detect Language & Format History').item.json.history_formatted }}
```

Headers: `x-api-key` (from `$env.ANTHROPIC_API_KEY`), `anthropic-version: 2023-06-01`. Node settings: 15 s timeout, retry on failure (3 attempts, 1.5 s apart).

---

## 3. Product Link Enrichment

Node: **Enrich with Links** (Code). Extracts the response text, then links the first mention of each *retrieved* product to its URL, skipping products the model already linked. Token usage is passed through for logging.

```javascript
// Extract response text + enrich with auto-links
const claudeResponse = $input.first().json;
let responseText = claudeResponse.content?.[0]?.text || '';

const retrievedProducts = $('KB Retrieval & Scoring').item.json.retrieved_products || [];

// Add markdown links for any product name not already linked
let linksAdded = 0;
retrievedProducts.forEach(({ product, url }) => {
  if (!product || !url) return;
  
  // Check if product name appears in response but isn't already a link
  const escapedName = product.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linkRegex = new RegExp(`\\[[^\\]]*${escapedName}[^\\]]*\\]`, 'i');
  if (linkRegex.test(responseText)) return; // Already linked
  
  const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'i');
  if (nameRegex.test(responseText)) {
    responseText = responseText.replace(nameRegex, (match) => {
      linksAdded++;
      return `[${match}](${url})`;
    });
  }
});

return [{
  json: {
    response_text: responseText,
    links_added: linksAdded,
    model_used: 'claude-3-5-sonnet-20241022',
    tokens_used: claudeResponse.usage?.output_tokens || 0,
    input_tokens: claudeResponse.usage?.input_tokens || 0,
  },
}];
```

---

## 4. Conversation Memory and Language Detection

Node: **Detect Language & Format History** (Code). Session history is read from the Conversations sheet by `session_id`; a sliding window of the last 10 turns keeps context useful and prompt cost bounded. Language is detected by Unicode range and passed to the system prompt.

```javascript
// Language detection + history formatting
const message = $('Validate Request').item.json.message;
const historyRows = $('Get Session History').all();

// Language detection
let language = 'en';
if (/[\u0600-\u06FF]/.test(message)) language = 'ar';
else if (/[\u0400-\u04FF]/.test(message)) language = 'ru';
else if (/[\u4E00-\u9FFF]/.test(message)) language = 'zh';

// Format recent history (last 10 turns)
const recentHistory = historyRows
  .slice(-10)
  .map(r => ({
    role: r.json.direction === 'inbound' ? 'user' : 'assistant',
    content: r.json.direction === 'inbound' ? r.json.user_message : r.json.ai_response,
  }))
  .filter(m => m.content);

const languageNames = { en: 'English', ar: 'Arabic', ru: 'Russian', zh: 'Chinese' };

return [{
  json: {
    detected_language: language,
    language_name: languageNames[language],
    history: recentHistory,
    history_formatted: recentHistory.map(m => `${m.role}: ${m.content}`).join('\n'),
    total_turns: historyRows.length,
  },
}];
```

---

## 5. Request Validation and Widget Response

Node: **Validate Request** (Code). Rejects malformed payloads and oversized messages before any API call is made.

```javascript
// Validate incoming payload from chat widget
const body = $input.first().json.body;

if (!body.message || typeof body.message !== 'string') {
  throw new Error('Missing or invalid message field');
}
if (!body.session_id) {
  throw new Error('Missing session_id');
}

// Input guard: cap message length before it reaches the LLM
const MAX_MESSAGE_LENGTH = 1000;
if (body.message.length > MAX_MESSAGE_LENGTH) {
  throw new Error(`Message exceeds ${MAX_MESSAGE_LENGTH} characters`);
}

return [{
  json: {
    session_id: body.session_id,
    message: body.message.trim(),
    visitor_ip: $input.first().json.headers['x-forwarded-for'] || 'unknown',
    user_agent: $input.first().json.headers['user-agent'] || 'unknown',
    received_at: new Date().toISOString(),
  },
}];
```

Node: **Return to Widget** (Respond to Webhook). The widget receives the reply plus metadata used for analytics:

```text
{
  "reply": "{{ $('Enrich with Links').item.json.response_text.replace(/"/g, '\\"').replace(/\n/g, '\\n') }}",
  "session_id": "{{ $('Validate Request').item.json.session_id }}",
  "meta": {
    "language": "{{ $('Detect Language & Format History').item.json.detected_language }}",
    "kb_matches": {{ $('KB Retrieval & Scoring').item.json.retrieved_count }},
    "model": "{{ $('Enrich with Links').item.json.model_used }}"
  }
}
```

---

## Design principles demonstrated

1. **Retrieval before generation** — the model only sees verified KB rows
2. **Explicit refusal patterns** — "let me connect you with our team" is a valid, expected response
3. **Post-processing for value** — link enrichment after generation, limited to retrieved products
4. **Sliding window memory** — last 10 turns, so context does not grow without bound
5. **Language-aware prompting** — multi-language support without a separate translation service
6. **Fail fast on bad input** — validation before any paid API call
