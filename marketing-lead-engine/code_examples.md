# Code Examples — Marketing Content Pipeline

Code and configuration taken directly from [`workflow.json`](workflow.json). RSS monitoring → deduplication → AI rewriting → author permission request → logging.

---

## 1. New & Recent Article Filter

Runs after **Check If Already Seen** (a SeenArticles lookup per article URL). Keeps only unseen articles from the last 48 hours that have a title and snippet, and shapes them for the rewrite step.

```javascript
// n8n Code Node — Filter New & Recent

// Filter to only new + recent articles
const articles = $('Read RSS Feed').all();
const seenLookup = $input.all();

const seenUrls = new Set(seenLookup.map(s => s.json.url));

const MAX_AGE_HOURS = 48;
const now = Date.now();

function isRecent(pubDate) {
  if (!pubDate) return false;
  const age = (now - new Date(pubDate).getTime()) / (1000 * 60 * 60);
  return age < MAX_AGE_HOURS;
}

const newArticles = articles
  .map(a => a.json)
  .filter(article => {
    if (seenUrls.has(article.link)) return false;
    if (!isRecent(article.pubDate || article.isoDate)) return false;
    if (!article.title || !article.contentSnippet) return false;
    return true;
  })
  .map(article => ({
    article_id: `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    url: article.link,
    title: article.title,
    author: article.creator || article.author || extractAuthor(article.content),
    content_snippet: (article.contentSnippet || article.content || '').slice(0, 2000),
    pub_date: article.pubDate || article.isoDate || new Date().toISOString(),
    discovered_at: new Date().toISOString(),
  }));

function extractAuthor(content) {
  if (!content) return 'Unknown';
  const byline = content.match(/by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/);
  return byline ? byline[1] : 'Unknown';
}

return newArticles.map(a => ({ json: a }));
```

---

## 2. AI Content Rewriter

An OpenAI node (model `gpt-4o`, temperature `0.7`, response format `json_object`). Rewrites the article into a LinkedIn-style post while preserving the original facts.

**System prompt:**

```text
You rewrite published articles into LinkedIn-style posts.

Rules:
- Maximum 300 words
- Lead with a strong hook (first 2 lines must work alone before 'see more')
- Preserve ALL factual claims and numbers from the original
- Adapt structure for LinkedIn (short paragraphs, line breaks)
- Add a Source line at the end: 'Original article by [author]: [url]'
- Do NOT pretend to be the original author
- Do NOT add facts not in the original
- Match tone of professional thought leadership

Output JSON only:
{
  "linkedin_post": "...",
  "facts_preserved": ["...", "..."],
  "rewrite_notes": "any deviations from straight rewrite"
}
```

**User message (n8n expression):**

```text
Title: {{ $json.title }}
Author: {{ $json.author }}
URL: {{ $json.url }}

Content:
{{ $json.content_snippet }}
```

---

## 3. Permission Request Composer

Builds the permission email with the full draft attached, and the record that is logged to PermissionRequests.

```javascript
// n8n Code Node — Compose Permission Request

// Compose permission request email
const article = $('Filter New & Recent').item.json;
const rewrite = JSON.parse($input.first().json.message.content);

// Best-effort author email inference: firstname.lastname@domain, or editor@domain when the author is unknown
function extractDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return 'example.com'; }
}

const domain = extractDomain(article.url);
const authorFirstName = (article.author || 'there').split(' ')[0];
const likelyEmail = article.author !== 'Unknown'
  ? `${article.author.toLowerCase().replace(/\s+/g, '.')}@${domain}`
  : `editor@${domain}`;

const subject = `Permission to share your article on LinkedIn — "${article.title.slice(0, 50)}..."`;

const body = `Hi ${authorFirstName},\n\nI read your article "${article.title}" and found it valuable enough that I'd like to share a summary with my LinkedIn audience.\n\nI always ask for permission before sharing someone's work. The summary I've drafted preserves your key points, gives you full credit, and links back to your original article.\n\nWould you be comfortable with me posting this? Here is the draft:\n\n----\n${rewrite.linkedin_post}\n----\n\nIf yes, I'll post it on LinkedIn this week with credit to you. If you'd prefer I not share it — or if you'd like me to edit anything — just let me know.\n\nThanks for the great work,\n[Your name]\n\n[This permission request was sent via an automated content pipeline that requires author consent before publishing.]`;

return [{
  json: {
    permission_request_id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    article_id: article.article_id,
    article_url: article.url,
    article_title: article.title,
    article_author: article.author,
    author_email: likelyEmail,
    subject,
    body,
    proposed_post: rewrite.linkedin_post,
    facts_preserved: rewrite.facts_preserved,
    status: 'pending_response',
    sent_at: new Date().toISOString(),
    response_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
}];
```

**Send Permission Email** (Gmail) sends `subject` and `body` to `author_email`. **Log Permission Request** appends the whole record to PermissionRequests.

---

## 4. Dedup Memory

**Mark as Seen** appends one row per processed article to SeenArticles, which the next cycle's lookup reads:

```json
{
  "url": "={{ $('Filter New & Recent').item.json.url }}",
  "title": "={{ $('Filter New & Recent').item.json.title }}",
  "discovered_at": "={{ $now.toISO() }}"
}
```

---

## Design principles demonstrated

1. **Permission-based, not theft-based** — the only outbound action is a consent request
2. **Dedup before spend** — URL lookup runs before any AI call
3. **Constrained generation** — prompt rules plus JSON output mode, with facts listed for review
4. **Freshness windows** — only articles from the last 48 hours are considered
5. **Auditable by default** — every request is logged with its draft, status, and deadline
