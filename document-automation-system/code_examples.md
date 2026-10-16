# Code Examples — Document Intelligence Pipeline — Construction Specifications

Production code from the PDF-to-Excel pipeline, taken verbatim from the nodes in [`workflow.json`](workflow.json). It embodies the system's core principle: **AI extracts rules, deterministic code performs every calculation**.

---

## 1. Email Intake and PDF Filtering

Node: **Gmail New PDF** (Gmail trigger). Polls every minute for unread inbox messages from an allow-listed set of senders and downloads attachments:

```json
{
  "pollTimes": {
    "item": [
      {
        "mode": "everyMinute"
      }
    ]
  },
  "simple": false,
  "filters": {
    "sender": "={{ $env.ALLOWED_PDF_SENDERS }}",
    "labelIds": [
      "INBOX"
    ],
    "readStatus": "unread"
  },
  "options": {
    "downloadAttachments": true,
    "attachmentsPrefix": "spec_"
  }
}
```

Node: **Filter PDFs Only** (Code). Keeps only PDF attachments, captures sender metadata for the reply, and assigns each PDF a `run_id` that follows it through emails and the processing log. Text extraction is then handled by n8n's native **Extract From File** node (`operation: pdf`, pages joined), so no custom parser is needed.

```javascript
// Filter only PDF attachments and extract sender info
const email = $input.first().json;
const attachments = email.attachments || [];

const pdfs = attachments.filter(a => 
  a.filename?.toLowerCase().endsWith('.pdf') ||
  a.contentType === 'application/pdf'
);

if (pdfs.length === 0) {
  throw new Error('No PDF attachments found in email');
}

return pdfs.map(pdf => ({
  json: {
    run_id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sender_email: email.from?.value?.[0]?.address || email.from,
    sender_name: email.from?.value?.[0]?.name || '',
    subject: email.subject || '',
    received_at: email.date || new Date().toISOString(),
    pdf_filename: pdf.filename,
    pdf_size_bytes: pdf.size || 0,
  },
  binary: { pdf: pdf },
}));
```

---

## 2. AI Rule Extraction (Language ONLY, no math)

Node: **AI Rule Extraction** (OpenAI node, model `gpt-4o`). The model reads natural-language instructions and extracts structured rules. **It never does arithmetic.**

System prompt:

```text
You are a construction specification parser.

The PDF contains items, quantities, and disposal/reuse rules. Your job: extract the rules as structured JSON.

EXAMPLE INPUT:
"For Item X (qty: 100 pcs), reuse 40%, dispose 30%, clean and store 30%."

EXAMPLE OUTPUT:
{
  "rules": [
    {
      "item_name": "Item X",
      "parent_item": null,
      "quantity": 100,
      "unit": "pcs",
      "actions": {
        "reuse_percent": 40,
        "dispose_percent": 30,
        "clean_store_percent": 30
      }
    }
  ]
}

CRITICAL RULES:
- Extract numbers EXACTLY as they appear in the document
- Do NOT calculate derived values (do not multiply percent × quantity)
- Do NOT validate that percentages sum to 100
- Report only what is stated in the text
- For nested items, set parent_item to the name of the containing item
- Return null for any field not stated
- If text is unclear or you're uncertain, set values to null

Return ONLY valid JSON. No markdown, no commentary.
```

User message: `{{ $('Extract PDF Text').item.json.text }}` (the extracted PDF text).

Options: `temperature: 0`, `responseFormat: json_object`, `maxTokens: 4000`.

---

## 3. Deterministic Calculation Engine (THE critical part)

Node: **Calculation Engine (Deterministic)** (Code). This is where ALL arithmetic happens. No AI involvement. Invalid quantities are flagged instead of computed, and an empty extraction stops the run.

```javascript
// Deterministic calculation engine
// AI extracted rules, code does ALL arithmetic
// This is the heart of the 'AI for language, code for math' principle

const extraction = JSON.parse($input.first().json.message.content);
const rules = extraction.rules || [];

if (rules.length === 0) {
  throw new Error('No rules extracted from PDF - manual review required');
}

// Build parent-child relationships
const itemsByName = {};
rules.forEach(rule => { itemsByName[rule.item_name] = rule; });

const children = {};
rules.forEach(rule => {
  if (rule.parent_item) {
    if (!children[rule.parent_item]) children[rule.parent_item] = [];
    children[rule.parent_item].push(rule);
  }
});

// Calculate action quantities for each rule (deterministic)
function calculateActions(rule) {
  const qty = rule.quantity;
  const actions = rule.actions || {};
  const calculated = {};
  
  if (typeof qty !== 'number' || qty <= 0) {
    return { ...rule, calculated: {}, validation: { error: 'invalid_quantity', value: qty } };
  }
  
  if (typeof actions.reuse_percent === 'number') {
    calculated.reuse_quantity = Math.round((actions.reuse_percent / 100) * qty * 1000) / 1000;
  }
  if (typeof actions.dispose_percent === 'number') {
    calculated.dispose_quantity = Math.round((actions.dispose_percent / 100) * qty * 1000) / 1000;
  }
  if (typeof actions.clean_store_percent === 'number') {
    calculated.clean_store_quantity = Math.round((actions.clean_store_percent / 100) * qty * 1000) / 1000;
  }
  
  const totalPercent = (actions.reuse_percent || 0) + (actions.dispose_percent || 0) + (actions.clean_store_percent || 0);
  const totalQty = (calculated.reuse_quantity || 0) + (calculated.dispose_quantity || 0) + (calculated.clean_store_quantity || 0);
  
  return {
    ...rule,
    calculated,
    validation: {
      percent_sum: totalPercent,
      percent_balanced: Math.abs(totalPercent - 100) < 0.01,
      quantity_sum: totalQty,
      quantity_balanced: Math.abs(totalQty - qty) < 0.01,
    },
  };
}

function calculateParentAggregation(parentRule) {
  const childRules = children[parentRule.item_name] || [];
  if (childRules.length === 0) return null;
  return {
    child_count: childRules.length,
    children_total_qty: childRules.reduce((sum, c) => sum + (c.quantity || 0), 0),
    child_names: childRules.map(c => c.item_name),
  };
}

// Detect duplicate item names
const nameCounts = {};
rules.forEach(r => {
  const key = r.item_name.toLowerCase().trim();
  nameCounts[key] = (nameCounts[key] || 0) + 1;
});
const duplicates = Object.entries(nameCounts).filter(([_, c]) => c > 1).map(([name, count]) => ({ item_name: name, occurrences: count }));

const calculated = rules.map(rule => {
  const withCalc = calculateActions(rule);
  const parentAgg = calculateParentAggregation(rule);
  if (parentAgg) withCalc.parent_aggregation = parentAgg;
  return withCalc;
});

return [{
  json: {
    calculated_items: calculated,
    duplicates_found: duplicates,
    total_items: calculated.length,
    items_with_actions: calculated.filter(c => c.actions && Object.keys(c.actions).length > 0).length,
    items_balanced: calculated.filter(c => c.validation?.percent_balanced).length,
    calculation_timestamp: new Date().toISOString(),
  },
}];
```

---

## 4. Duplicate Item Detection

Excerpt from the **Calculation Engine** node. The same item name appearing more than once almost always indicates a parsing error, so duplicates are counted case-insensitively and surfaced to the QA report.

```javascript
// Detect duplicate item names
const nameCounts = {};
rules.forEach(r => {
  const key = r.item_name.toLowerCase().trim();
  nameCounts[key] = (nameCounts[key] || 0) + 1;
});
const duplicates = Object.entries(nameCounts).filter(([_, c]) => c > 1).map(([name, count]) => ({ item_name: name, occurrences: count }));
```

---

## 5. QA Report and Quality Gate

Node: **Generate QA Report** (Code). Every run produces a QA report so the operator knows exactly what happened.

```javascript
// Generate quality assurance report
const data = $input.first().json;
const run = $('Filter PDFs Only').item.json;

const items = data.calculated_items;
const total = items.length;
const balanced = data.items_balanced;
const withActions = data.items_with_actions;
const duplicateCount = data.duplicates_found.length;
const completeness = items.filter(i => i.quantity != null).length / Math.max(total, 1);

// Quality score formula
const score = Math.round((
  (balanced / Math.max(total, 1)) * 0.5 +
  (duplicateCount === 0 ? 1 : 0.5) * 0.3 +
  completeness * 0.2
) * 100);

const warnings = [
  ...data.duplicates_found.map(d => `DUPLICATE: "${d.item_name}" appears ${d.occurrences} times`),
  ...items.filter(i => i.validation?.percent_balanced === false)
    .map(i => `IMBALANCE: "${i.item_name}" percentages sum to ${i.validation.percent_sum}%, not 100`),
  ...items.filter(i => i.validation?.error)
    .map(i => `ERROR: "${i.item_name}" - ${i.validation.error}: ${i.validation.value}`),
];

const recommendations = [];
if (score < 70) recommendations.push('Quality below 70% threshold - manual review required before Excel export');
if (duplicateCount > 0) recommendations.push('Resolve duplicate item names in source PDF before next run');
if (withActions < total * 0.8) recommendations.push('Many items missing action rules - PDF may need clearer formatting');

return [{
  json: {
    run_id: run.run_id,
    quality_score: score,
    quality_label: score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor',
    summary: {
      total_items: total,
      items_with_actions: withActions,
      items_balanced: balanced,
      duplicate_count: duplicateCount,
      completeness_ratio: completeness,
    },
    warnings,
    recommendations,
    can_auto_export: score >= 70 && warnings.length === 0,
    items: items,
    generated_at: new Date().toISOString(),
  },
}];
```

Node: **Quality Gate** (If). Routes on a single boolean computed above, so the gating policy lives in one place:

```text
condition: {{ $json.can_auto_export }} is true
  true  → Generate Excel → Send Excel Result → Log Processing Run
  false → Send to Review Queue → Log Processing Run
```

`can_auto_export` requires a score of at least 70% **and** an empty warnings list, so any imbalance, duplicate or invalid quantity sends the run to a human regardless of score.

---

## Design principle: arithmetic errors removed by architecture

The split is rigid:

| What AI does | What code does |
|---|---|
| Read natural language | Calculate arithmetic |
| Identify item names | Aggregate child quantities |
| Extract percentages as written | Multiply quantity × percent |
| Recognize parent-child relationships | Validate sums equal 100% |
| Output structured JSON | Generate QA reports |

**Why this works:** LLMs are strong at pattern recognition in text and unreliable at arithmetic, especially nested or multi-step. Keeping each in its strength zone removes the calculation error class entirely; the remaining risk is extraction quality, which the QA report and gate are designed to catch.
