# Code Examples — Document Automation System

Production code from the PDF-to-Excel pipeline. Embodies the system's core principle: **AI extracts rules, deterministic code performs every calculation**.

---

## 1. PDF Text Extraction with Structure Preservation

Extract text from construction PDFs while preserving table structure for downstream parsing.

```javascript
// n8n Code Node — PDF Parser

const pdfBuffer = $input.first().binary.data;
const pdfParse = require('pdf-parse');

async function extractStructured(buffer) {
  const data = await pdfParse(buffer, {
    pagerender: function(pageData) {
      // Custom render to preserve table structure
      return pageData.getTextContent({ normalizeWhitespace: false })
        .then(content => {
          // Group by Y coordinate (rows)
          const rows = {};
          content.items.forEach(item => {
            const y = Math.round(item.transform[5]);
            if (!rows[y]) rows[y] = [];
            rows[y].push({
              x: item.transform[4],
              text: item.str,
            });
          });
          
          // Sort each row by X coordinate
          const orderedRows = Object.keys(rows)
            .sort((a, b) => b - a) // top to bottom
            .map(y => rows[y].sort((a, b) => a.x - b.x).map(c => c.text).join('\t'));
          
          return orderedRows.join('\n');
        });
    },
  });
  
  return {
    raw_text: data.text,
    page_count: data.numpages,
    metadata: data.info,
  };
}

const extracted = await extractStructured(pdfBuffer);

return [{
  json: {
    extracted_text: extracted.raw_text,
    page_count: extracted.page_count,
    char_count: extracted.raw_text.length,
    extraction_timestamp: new Date().toISOString(),
  },
}];
```

---

## 2. AI Rule Extraction (Language ONLY, no math)

The AI reads natural-language instructions and extracts structured rules. **It never does arithmetic.**

```javascript
// n8n OpenAI Node — Rule Extraction

const systemPrompt = `You are a construction specification parser.

The PDF contains items, quantities, and disposal/reuse rules. Your job: extract the rules as structured JSON.

Example input:
"For Item X (qty: 100), reuse 40%, dispose 30%, clean and store 30%."

Example output:
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

IMPORTANT:
- Extract numbers as they appear in the document
- Do NOT calculate derived values (do not multiply percent × quantity)
- Do NOT validate that percentages sum to 100
- Report only what is stated in the text
- For nested items, set parent_item to the name of the containing item
- Return null for any field not stated

Return JSON only.`;

const documentText = $('PDF Parser').first().json.extracted_text;

return [{
  json: {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: documentText },
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
  },
}];
```

---

## 3. Deterministic Calculation Engine (THE critical part)

This is where ALL arithmetic happens. No AI involvement.

```javascript
// n8n Code Node — Calculation Engine

const extraction = JSON.parse($('AI Rule Extraction').first().json.message.content);
const rules = extraction.rules || [];

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

// Calculate quantities for each rule
function calculateActions(rule) {
  const qty = rule.quantity;
  const actions = rule.actions || {};
  
  const calculated = {};
  
  // Direct percentage calculations
  if (typeof actions.reuse_percent === 'number') {
    calculated.reuse_quantity = Math.round((actions.reuse_percent / 100) * qty * 1000) / 1000;
  }
  if (typeof actions.dispose_percent === 'number') {
    calculated.dispose_quantity = Math.round((actions.dispose_percent / 100) * qty * 1000) / 1000;
  }
  if (typeof actions.clean_store_percent === 'number') {
    calculated.clean_store_quantity = Math.round((actions.clean_store_percent / 100) * qty * 1000) / 1000;
  }
  
  // Validation: sum of percentages
  const totalPercent = (actions.reuse_percent || 0) + (actions.dispose_percent || 0) + (actions.clean_store_percent || 0);
  
  return {
    ...rule,
    calculated,
    validation: {
      percent_sum: totalPercent,
      percent_balanced: Math.abs(totalPercent - 100) < 0.01,
      quantity_sum: (calculated.reuse_quantity || 0) + (calculated.dispose_quantity || 0) + (calculated.clean_store_quantity || 0),
    },
  };
}

// Calculate parent aggregations from children
function calculateParentAggregation(parentRule) {
  const childRules = children[parentRule.item_name] || [];
  if (childRules.length === 0) return null;
  
  return {
    child_count: childRules.length,
    children_total_qty: childRules.reduce((sum, c) => sum + (c.quantity || 0), 0),
    child_names: childRules.map(c => c.item_name),
  };
}

const calculated = rules.map(rule => {
  const withCalc = calculateActions(rule);
  const parentAgg = calculateParentAggregation(rule);
  if (parentAgg) {
    withCalc.parent_aggregation = parentAgg;
  }
  return withCalc;
});

// Overall validation
const validation = {
  total_items: calculated.length,
  items_with_balanced_percentages: calculated.filter(c => c.validation.percent_balanced).length,
  items_with_unbalanced_percentages: calculated.filter(c => !c.validation.percent_balanced).length,
  validation_warnings: calculated
    .filter(c => !c.validation.percent_balanced)
    .map(c => `Item "${c.item_name}": percentages sum to ${c.validation.percent_sum}, not 100`),
};

return [{
  json: {
    calculated_items: calculated,
    validation,
    calculation_timestamp: new Date().toISOString(),
  },
}];
```

---

## 4. Duplicate Item Detection

Multiple items with the same name across the document indicate parsing errors. This catches them.

```javascript
// n8n Code Node — Duplicate Detection

const calculated = $('Calculation Engine').first().json.calculated_items;

const itemNameCounts = {};
calculated.forEach(item => {
  const key = item.item_name.toLowerCase().trim();
  itemNameCounts[key] = (itemNameCounts[key] || 0) + 1;
});

const duplicates = Object.entries(itemNameCounts)
  .filter(([_, count]) => count > 1)
  .map(([name, count]) => ({ item_name: name, occurrences: count }));

return [{
  json: {
    items: calculated,
    duplicates_found: duplicates.length > 0,
    duplicate_items: duplicates,
    requires_human_review: duplicates.length > 0,
  },
}];
```

---

## 5. QA Report Generator

Every processing run generates a QA report so the operator knows exactly what happened.

```javascript
// n8n Code Node — QA Report Generation

const data = $('Duplicate Detection').first().json;
const items = data.items;

const report = {
  run_id: crypto.randomUUID(),
  generated_at: new Date().toISOString(),
  
  summary: {
    total_items_extracted: items.length,
    items_with_actions: items.filter(i => i.actions && Object.keys(i.actions).length > 0).length,
    items_with_parent: items.filter(i => i.parent_item).length,
    duplicate_items_found: data.duplicate_items.length,
    items_requiring_review: items.filter(i => !i.validation.percent_balanced).length,
  },
  
  quality_score: calculateQualityScore(items, data),
  
  warnings: [
    ...data.duplicate_items.map(d => `DUPLICATE: "${d.item_name}" appears ${d.occurrences} times`),
    ...items
      .filter(i => !i.validation.percent_balanced)
      .map(i => `IMBALANCE: "${i.item_name}" percentages sum to ${i.validation.percent_sum}%`),
  ],
  
  recommendations: [],
};

function calculateQualityScore(items, data) {
  if (items.length === 0) return 0;
  const balanced = items.filter(i => i.validation.percent_balanced).length;
  const noDupes = data.duplicate_items.length === 0 ? 1 : 0.5;
  const completeness = items.filter(i => i.quantity !== null).length / items.length;
  return Math.round((balanced / items.length * 0.5 + noDupes * 0.3 + completeness * 0.2) * 100);
}

if (report.quality_score < 70) {
  report.recommendations.push('Quality below threshold — manual review recommended before Excel export.');
}
if (data.duplicate_items.length > 0) {
  report.recommendations.push('Resolve duplicate item names in source PDF before next run.');
}

return [{ json: report }];
```

---

## Design principle: hallucination-proof by architecture

The split is rigid:

| What AI does | What code does |
|---|---|
| Read natural language | Calculate arithmetic |
| Identify item names | Aggregate child quantities |
| Extract percentages as written | Multiply quantity × percent |
| Recognize parent-child relationships | Validate sums equal 100% |
| Output structured JSON | Generate QA reports |

**Why this works:** LLMs are excellent at pattern recognition in text. They are unreliable at arithmetic, especially nested or multi-step. By keeping the AI in its strength zone and code in its strength zone, the system gets the best of both — and eliminates the calculation error class entirely.
