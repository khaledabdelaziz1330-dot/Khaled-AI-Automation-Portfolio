# Hostzera – AI Chat Widget & Lead Automation

AI-powered customer support and sales assistant for a web hosting platform
(Website Chat Widget · Google Sheets Knowledge Base · AI Agent · Multi-Language)

---

![chat widget workflow](chat-widget-workflow.png)

## What this system does

This is an AI-driven customer support and sales assistant built for **Hostzera**, a web hosting platform, using n8n automation.

The system retrieves structured service data from Google Sheets, processes it through a custom retrieval layer, and feeds it into an AI agent to generate accurate, context-aware responses — directly inside a chat widget embedded on the website.

### Key features:

- **AI chat widget** integrated directly into the Hostzera website
- **Structured knowledge base** powered by Google Sheets (services, pricing, features, FAQs)
- **Retrieval pipeline** to reduce hallucinations — the AI only answers based on verified data
- **Multi-language support** for international visitors
- **Conversation memory** for contextual, multi-turn replies
- **Automatic linking** to relevant service pages and support contact

---

## How it works (step by step)

1. **Visitor opens the chat widget on the website**
   The widget sends the visitor's message via webhook to n8n.

2. **Data retrieval from Google Sheets**
   The workflow fetches relevant service data (plans, pricing, features, FAQs) from the structured knowledge base.

3. **Custom retrieval layer (JavaScript)**
   A Code node processes and formats the retrieved data, preparing the right context for the AI agent — reducing hallucinations and ensuring accurate responses.

4. **AI Agent processes the query**
   The agent (using Anthropic + OpenAI models) receives the user's message along with the retrieved context and conversation memory, then generates a helpful, accurate response.

5. **Response sent back to the widget**
   The AI's reply is sent back via webhook response, appearing instantly in the chat widget.

---

## Workflow architecture

```
Webhook (chat message)
  → Edit Fields (extract user input)
    → Get rows from Google Sheets (knowledge base)
      → Code in JavaScript (retrieval & formatting)
        → AI Agent (Anthropic + OpenAI models)
          ├── Simple Memory (conversation context)
          ├── Think tool (reasoning)
          → Respond to Webhook (reply to widget)
```

---

## Stack

- **n8n** (self-hosted on VPS) – main orchestration
- **Anthropic Claude** – primary AI model for responses
- **OpenAI** – secondary AI model
- **Google Sheets** – structured knowledge base (services, pricing, FAQs)
- **JavaScript** – custom retrieval logic and data formatting
- **Webhook** – real-time communication with the chat widget
- **Simple Memory** – conversation context for multi-turn chats

---

## Impact

- **24/7 instant responses** — visitors get accurate answers without waiting for a human agent.
- **Reduced support load** — common questions (pricing, plans, features) handled automatically.
- **Higher lead conversion** — qualified visitors are directed to the right service pages and contact options.
- **Multi-language reach** — serves international visitors in their preferred language.
- **Zero hallucination risk** — retrieval pipeline ensures AI only uses verified data from the knowledge base.

---

## Notes

- The knowledge base in Google Sheets can be updated by the Hostzera team without touching the automation.
- Conversation memory allows the widget to handle multi-turn conversations naturally.
- Built with error handling and fallback to human support when the AI cannot resolve a query.
- The retrieval approach (structured data → JavaScript formatting → AI agent) is designed to be more reliable than pure LLM responses.
