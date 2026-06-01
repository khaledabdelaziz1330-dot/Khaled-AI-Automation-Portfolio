# Code Examples — Marketing Content Engine

Production code from the permission-based content marketing pipeline. RSS monitoring → AI rewriting → author permission → conditional publishing.

---

## 1. RSS Feed Aggregator with Deduplication

Monitors multiple RSS feeds, deduplicates articles across them.

```javascript
// n8n Code Node — RSS Aggregation & Dedup

const allFeeds = $('Read All RSS Feeds').all();
const seenArticles = $('Get Seen Articles').all();

const seenUrls = new Set(seenArticles.map((s) => s.json.url));
const seenTitles = new Set(seenArticles.map((s) => normalizeTitle(s.json.title)));

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

const newArticles = [];

for (const feed of allFeeds) {
  for (const item of feed.json.items || []) {
    const url = item.link || item.url;
    const title = item.title || '';
    const normalizedTitle = normalizeTitle(title);
    
    if (seenUrls.has(url) || seenTitles.has(normalizedTitle)) continue;
    if (!isRecent(item.pubDate, 48)) continue; // Only last 48 hours
    
    newArticles.push({
      url,
      title,
      author: item.creator || item.author || extractAuthorFromContent(item),
      content_snippet: item.contentSnippet || item.content?.slice(0, 500),
      pub_date: item.pubDate || new Date().toISOString(),
      source_feed: feed.json.feedUrl,
      discovered_at: new Date().toISOString(),
    });
    
    seenUrls.add(url);
    seenTitles.add(normalizedTitle);
  }
}

function isRecent(pubDate, hours) {
  if (!pubDate) return false;
  const age = (Date.now() - new Date(pubDate).getTime()) / (1000 * 60 * 60);
  return age < hours;
}

function extractAuthorFromContent(item) {
  // Some feeds embed author info in content
  const byline = item.content?.match(/by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/);
  return byline ? byline[1] : 'Unknown';
}

return newArticles.map((a) => ({ json: a }));
```

---

## 2. AI Content Rewriter

Rewrites articles into LinkedIn-style posts. Maintains original facts, changes structure.

```javascript
// n8n OpenAI Node — Content Rewriter

const article = $input.first().json;

const systemPrompt = `You rewrite published articles into LinkedIn-style posts.

Rules:
- Maximum 300 words
- Lead with a strong hook (first 2 lines must work alone)
- Preserve all factual claims and numbers from the original
- Adapt the structure for LinkedIn (short paragraphs, line breaks)
- Add a "Source" line at the end: "Original article by [author]: [url]"
- Do NOT pretend to be the original author
- Do NOT add facts not in the original
- Match the tone of professional thought leadership

Output as JSON:
{
  "linkedin_post": "...",
  "estimated_reading_time_seconds": <number>,
  "facts_preserved": [<list of key facts from original>],
  "rewrite_notes": "any deviations from straight rewrite"
}`;

return [{
  json: {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Original article:\nTitle: ${article.title}\nAuthor: ${article.author}\nURL: ${article.url}\n\nContent:\n${article.content_snippet}` },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  },
}];
```

---

## 3. Permission Request Composer

Composes a professional email asking the original author for permission to share the rewrite.

```javascript
// n8n Code Node — Permission Request Builder

const article = $('Original Article').first().json;
const rewrite = JSON.parse($('AI Rewrite').first().json.message.content);

// Try to find author email (would normally use a service like Hunter.io)
const authorEmail = article.author_email || `${article.author.toLowerCase().replace(/\s/g, '.')}@${extractDomain(article.url)}`;

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'example.com';
  }
}

const emailSubject = `Permission to share your article on LinkedIn — "${article.title.slice(0, 50)}..."`;

const emailBody = `Hi ${article.author.split(' ')[0]},

I read your article "${article.title}" and found it valuable enough that I'd like to share a summary with my LinkedIn audience.

I always ask for permission before sharing someone's work. The summary I've drafted preserves your key points, gives you full credit, and links back to your original article.

Would you be comfortable with me posting this? Here is the draft:

----
${rewrite.linkedin_post}
----

If yes, I'll post it on LinkedIn this week with credit to you. If you'd prefer I not share it — or if you'd like me to edit anything — just let me know.

Thanks for the great work,
[Your name]

[This permission request was sent via an automated content engine that requires author consent before publishing.]`;

return [{
  json: {
    permission_request_id: crypto.randomUUID(),
    article_id: article.url,
    author: article.author,
    author_email: authorEmail,
    subject: emailSubject,
    body: emailBody,
    proposed_post: rewrite.linkedin_post,
    status: 'pending_response',
    sent_at: new Date().toISOString(),
    response_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
}];
```

---

## 4. Response Parser (Approval Detection)

When the author replies, parses their response to detect approval/rejection.

```javascript
// n8n Code Node — Response Parser

const reply = $input.first().json;
const replyText = (reply.body || '').toLowerCase();

// Pattern-based detection
const approvalPatterns = [
  /\b(yes|approved|go ahead|sure|absolutely|fine by me|please do|happy to)\b/,
  /\b(thanks|thank you).*\b(for asking|for the credit)/,
];

const rejectionPatterns = [
  /\b(no|not interested|please don\'t|prefer not|rather not|not at this time)\b/,
  /\b(would prefer|please do not)\b/,
];

const editRequestPatterns = [
  /\b(could you|would you|please|can you).*\b(change|adjust|modify|edit|update)\b/,
  /\b(one thing|small change|minor edit)\b/,
];

function detectIntent(text) {
  const isApproval = approvalPatterns.some((p) => p.test(text));
  const isRejection = rejectionPatterns.some((p) => p.test(text));
  const isEditRequest = editRequestPatterns.some((p) => p.test(text));
  
  if (isRejection) return 'rejected';
  if (isEditRequest) return 'edit_requested';
  if (isApproval) return 'approved';
  return 'unclear';
}

const intent = detectIntent(replyText);

return [{
  json: {
    permission_request_id: reply.in_reply_to_id,
    author_response: reply.body,
    response_received_at: reply.date,
    detected_intent: intent,
    requires_human_review: intent === 'unclear' || intent === 'edit_requested',
    can_auto_publish: intent === 'approved',
  },
}];
```

---

## 5. LinkedIn Auto-Publisher (with safeguards)

Only publishes if explicit approval received.

```javascript
// n8n Code Node — Publish Decision

const request = $('Approval Status').first().json;

// Multiple safety checks before publishing
const safetyChecks = {
  has_approval_record: !!request.permission_request_id,
  status_is_approved: request.detected_intent === 'approved',
  not_already_published: !request.published_at,
  no_human_review_flag: !request.requires_human_review,
  within_freshness_window: isWithinFreshness(request.original_article_date),
};

const allChecksPass = Object.values(safetyChecks).every(Boolean);

if (!allChecksPass) {
  return [{
    json: {
      action: 'skip',
      reason: 'safety_check_failed',
      failed_checks: Object.entries(safetyChecks).filter(([_, v]) => !v).map(([k]) => k),
    },
  }];
}

function isWithinFreshness(articleDate, maxDays = 30) {
  if (!articleDate) return false;
  const age = (Date.now() - new Date(articleDate).getTime()) / (1000 * 60 * 60 * 24);
  return age <= maxDays;
}

return [{
  json: {
    action: 'publish',
    linkedin_post: request.proposed_post,
    author_credit: request.author,
    original_url: request.article_url,
    permission_record_id: request.permission_request_id,
    safety_checks_passed: safetyChecks,
  },
}];
```

---

## Design principles demonstrated

1. **Permission-based, not theft-based** — ethical foundation
2. **Multiple safety checks before publishing** — prevent embarrassing publishes
3. **Intent detection from natural language responses** — handles real human replies
4. **Freshness windows** — don't post stale content
5. **Pattern-based parsing first, AI second** — cheap and reliable
