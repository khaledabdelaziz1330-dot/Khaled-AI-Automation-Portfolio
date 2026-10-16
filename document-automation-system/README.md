# Document Intelligence Pipeline — Construction Specifications

AI-assisted document processing pipeline for construction specification instructions
(Gmail Intake · PDF Parsing · AI Extraction · Deterministic Calculations · QA Gate)

---

![document automation workflow](document-automation-workflow.png)

*Screenshot: the workflow as originally built in the n8n editor (Drive-based intake, multi-stage layout). The exported [`workflow.json`](workflow.json) is the sanitized reference version of this pipeline, with Gmail intake and a consolidated node layout; this documentation describes `workflow.json`.*

---

## What This System Does

An AI-assisted pipeline that turns **construction specification PDFs** into structured Excel outputs.

Specification PDFs arrive by email. Each PDF lists items, their quantities and natural-language handling instructions ("reuse 40%, dispose 30%, clean and store 30%"). An LLM is used **only** to extract those instructions as structured rules, with numbers exactly as written. Every calculation, parent/child aggregation, validation and output step runs **deterministically in code**.

---

## How It Works

### Phase 1: Intake
1. **Gmail New PDF** — Gmail trigger polls the inbox every minute for unread messages from an allow-listed set of senders and downloads attachments
2. **Filter PDFs Only** — keeps PDF attachments, captures sender and subject, and assigns each PDF a `run_id`; emails without a PDF fail fast

### Phase 2: Parsing & Rule Extraction
1. **Extract PDF Text** — n8n's native Extract From File node converts the PDF to text (pages joined)
2. **AI Rule Extraction** — OpenAI `gpt-4o` (temperature 0, JSON mode) extracts items, parent items, quantities, units and action percentages (reuse, dispose, clean & store) exactly as stated; unclear values are returned as `null`

### Phase 3: Deterministic Calculation & QA
1. **Calculation Engine (Deterministic)** — computes action quantities from percentages, checks percentage balance and quantity conservation per item, aggregates child items under their parents, and detects duplicate item names
2. **Generate QA Report** — produces a weighted quality score, a quality label, warnings (imbalance, duplicate, invalid quantity) and recommendations

### Phase 4: Quality Gate & Delivery
1. **Quality Gate** — auto-exports only when the score is at least 70% **and** no blocking warnings were raised
2. **Pass:** **Generate Excel** → **Send Excel Result** emails the spreadsheet and QA summary back to the sender
3. **Fail:** **Send to Review Queue** emails the score, warnings and recommendations to the review inbox
4. **Log Processing Run** — both paths append the run to a Google Sheets processing log

Unhandled failures (for example, a PDF with no text layer) go to the portfolio's [shared error handler](../shared-error-handler) through the workflow's `errorWorkflow` setting.

---

## Workflow Architecture

```
Gmail New PDF (trigger)
  → Filter PDFs Only
    → Extract PDF Text
      → AI Rule Extraction (OpenAI gpt-4o, JSON mode)
        → Calculation Engine (Deterministic)
          → Generate QA Report
            → Quality Gate
              ├── pass → Generate Excel → Send Excel Result (Gmail) → Log Processing Run (Sheets)
              └── fail → Send to Review Queue (Gmail) → Log Processing Run (Sheets)

errorWorkflow → shared error handler
```

---

## Stack

| Layer | Tools |
|---|---|
| **Orchestration** | n8n (self-hosted on VPS) |
| **Intake** | Gmail trigger (sender allow-list, attachment download) |
| **AI** | OpenAI `gpt-4o` (structured extraction from natural language only) |
| **Logic** | JavaScript (deterministic calculations, aggregation, validation, QA scoring) |
| **Output** | n8n Convert to File (Excel), Gmail (results and review queue) |
| **Data** | Google Sheets (processing log) |

---

## Key Design Decisions

- **AI is used narrowly** — only for extracting rules from unstructured text. All arithmetic and aggregation is deterministic code, which removes LLM arithmetic errors as a failure class.
- **Numbers extracted as written** — the prompt forbids derived values and validation; the model reports, the code decides.
- **Quantity conservation checks** — every item's computed action quantities are checked against its stated quantity.
- **Duplicate detection** — repeated item names are flagged as likely parsing errors.
- **Strict quality gate** — a run auto-exports only when it clears the score threshold with zero blocking warnings; everything else goes to a human.
- **QA reporting** — every run produces a quality report so results can be audited.

---

## Impact

Measured on 1,200 documents over 90 days (see [PERFORMANCE.md](PERFORMANCE.md)):

- **No LLM-generated arithmetic** — every number in the output is computed in code (100% arithmetic correctness for the extracted inputs)
- **84% of runs clear the 70% QA threshold**; runs that do not are always routed to human review
- **15–30 seconds per PDF** end-to-end, at **~$0.03–0.05 per document**
- **98% processing success rate**
- ~100 documents/month replaces an estimated 20–30 hours of manual data entry

---

## Notes

- This system demonstrates a hybrid AI approach: LLMs where they excel (understanding natural language), deterministic code where numerical accuracy matters
- The separation between AI extraction and mathematical processing is intentional and enforced at a structured JSON boundary
- Accuracy limits sit in extraction, not arithmetic: item names 96%, quantities 97%, percentage rules 94%, parent-child relationships 88%
