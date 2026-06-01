# Code Examples — Hostzera AI Chat Widget

Production JavaScript code samples from the retrieval-grounded chat widget. Designed for zero hallucination by retrieving answers from a verified knowledge base before any LLM call.

---

## 1. Knowledge Base Retrieval (Google Sheets)

The first step of every conversation: pull the relevant product/service data from Google Sheets. This becomes the only context the AI is allowed to use.

```javascript
// n8n Code Node — Knowledge Base Retrieval
// Input: user message
// Output: relevant Sheet rows formatted as context

const userMessage = $('Webhook').first().json.message.toLowerCase();
const allKnowledge = $('Get Knowledge Base').all();

// Keyword-based retrieval (simple but effective for structured KB)
const keywords = userMessage
  .replace(/[^\w\s؀-ۿ]/g, ' ') // Keep Latin + Arabic
  .split(/\s+/)
  .filter((w) => w.length > 2);

function scoreRow(row, keywords) {
  const searchable = `${row.json.product || ''} ${row.json.description || ''} ${row.json.tags || ''}`.toLowerCase();
  return keywords.reduce((score, kw) => score + (searchable.includes(kw) ? 1 : 0), 0);
}

const scored = allKnowledge
  .map((row) => ({ row, score: scoreRow(row, keywords) }))
  .filter((s) => s.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);

// Format as context for the AI
const context = scored.length
  ? scored.map((s) => `- ${s.row.json.product}: ${s.row.json.description} ($${s.row.json.price})`).join('\n')
  : 'No matching products found in knowledge base.';

return [{
  json: {
    user_message: $('Webhook').first().json.message,
    retrieved_context: context,
    retrieved_count: scored.length,
  },
}];
```

---

## 2. Retrieval-Grounded Response Generation

The AI is explicitly instructed to ONLY answer from the retrieved context. Anything outside that = "I don't know, let me connect you with our team."

```javascript
// n8n OpenAI/Claude Node — Grounded Response Generator

const systemPrompt = `You are Hostzera's AI sales and support assistant.

CRITICAL RULES:
1. Answer ONLY using the information in the "Retrieved Context" below.
2. If the user asks something not covered by the context, respond with:
   "Great question — let me connect you with our team for an accurate answer."
3. Never invent prices, plans, features, or specifications.
4. Reply in the same language the user used.
5. Be friendly but concise.

Retrieved Context:
${$('KB Retrieval').first().json.retrieved_context}

Conversation history (last 5 turns):
${$('Conversation History').first().json.history || 'No prior conversation.'}`;

const userMessage = $('Webhook').first().json.message;

return [{
  json: {
    model: 'claude-3-5-sonnet-20241022',
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    max_tokens: 500,
    temperature: 0.3,
  },
}];
```

---

## 3. Page Link Auto-Insertion

When the AI mentions a product/service, the response is post-processed to add direct links to the relevant product pages.

```javascript
// n8n Code Node — Link Enrichment

const aiResponse = $('AI Response').first().json.content;
const knowledgeBase = $('Get Knowledge Base').all();

let enrichedResponse = aiResponse;

// For each product in the KB, check if it's mentioned and link it
knowledgeBase.forEach((row) => {
  const productName = row.json.product;
  const productUrl = row.json.url;
  
  if (!productName || !productUrl) return;
  
  // Escape special regex chars in product name
  const escapedName = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escapedName}\\b`, 'gi');
  
  // Only link the first occurrence to avoid spam
  let linked = false;
  enrichedResponse = enrichedResponse.replace(regex, (match) => {
    if (linked) return match;
    linked = true;
    return `[${match}](${productUrl})`;
  });
});

return [{
  json: {
    response: enrichedResponse,
    original_response: aiResponse,
    links_added: (enrichedResponse.match(/\[.*?\]\(.*?\)/g) || []).length,
  },
}];
```

---

## 4. Conversation Memory Management

Conversations need context across turns, but storing infinite history is expensive. This implements a sliding window approach.

```javascript
// n8n Code Node — Conversation Memory Management

const MAX_TURNS = 10;
const SUMMARIZE_AFTER = 8;

const session_id = $('Webhook').first().json.session_id;
const allMessages = $('Get Session Messages').all();

// Get last N messages
const recentMessages = allMessages.slice(-MAX_TURNS).map((m) => ({
  role: m.json.role,
  content: m.json.content,
  timestamp: m.json.timestamp,
}));

// If conversation is getting long, create a summary
let summary = null;
if (allMessages.length > SUMMARIZE_AFTER) {
  const older = allMessages.slice(0, -MAX_TURNS);
  summary = `Earlier in conversation (summary): User asked about ${older
    .filter((m) => m.json.role === 'user')
    .map((m) => extractTopic(m.json.content))
    .filter((t) => t)
    .join(', ')}`;
}

function extractTopic(text) {
  // Simple topic extraction — first noun-phrase-ish chunk
  const cleaned = text.toLowerCase().replace(/[^\w\s]/g, '');
  const words = cleaned.split(/\s+/).filter((w) => w.length > 3);
  return words.slice(0, 3).join(' ');
}

return [{
  json: {
    session_id,
    history: recentMessages,
    summary,
    total_turns: allMessages.length,
  },
}];
```

---

## 5. Multi-Language Detection and Handling

Hostzera serves international customers. Language detection routes responses appropriately.

```javascript
// n8n Code Node — Language Detection

const userMessage = $('Webhook').first().json.message;

function detectLanguage(text) {
  // Arabic detection (Unicode range)
  const arabicRegex = /[؀-ۿ]/;
  // Cyrillic detection
  const cyrillicRegex = /[Ѐ-ӿ]/;
  // CJK detection
  const cjkRegex = /[一-鿿]/;
  
  if (arabicRegex.test(text)) return 'ar';
  if (cyrillicRegex.test(text)) return 'ru';
  if (cjkRegex.test(text)) return 'zh';
  
  // Default to English for Latin scripts
  // Could add French/Spanish detection via common words if needed
  return 'en';
}

const language = detectLanguage(userMessage);

return [{
  json: {
    detected_language: language,
    original_message: userMessage,
    instruction: `Respond in ${language === 'ar' ? 'Arabic' : language === 'ru' ? 'Russian' : language === 'zh' ? 'Chinese' : 'English'}.`,
  },
}];
```

---

## Design principles demonstrated

1. **Retrieval before generation** — AI only answers from verified data
2. **Explicit refusal patterns** — "I don't know" is a valid response
3. **Post-processing for value** — link enrichment after generation
4. **Sliding window memory** — context without unbounded cost
5. **Language-aware routing** — global customer support without translation services
