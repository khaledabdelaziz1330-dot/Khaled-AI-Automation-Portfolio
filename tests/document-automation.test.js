'use strict';
// document-automation-system: "AI for language, code for math".
// The LLM only extracts rules; every number in the output is computed here.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runCode } = require('./helpers/n8n');

const P = 'document-automation-system';

const calculate = rules =>
  runCode(P, 'Calculation Engine (Deterministic)', { input: [{ message: { content: JSON.stringify({ rules }) } }] })[0];

const qaReport = calc =>
  runCode(P, 'Generate QA Report', { input: [calc], nodes: { 'Filter PDFs Only': [{ run_id: 'run_42' }] } })[0];

const item = (name, quantity, actions, parent) => ({
  item_name: name, quantity, actions, ...(parent ? { parent_item: parent } : {}),
});

test('converts extracted percentages into exact quantities', () => {
  const out = calculate([item('Ceiling tiles', 120, { reuse_percent: 40, dispose_percent: 30, clean_store_percent: 30 })]);
  const [tiles] = out.calculated_items;
  assert.deepEqual(tiles.calculated, { reuse_quantity: 48, dispose_quantity: 36, clean_store_quantity: 36 });
  assert.equal(tiles.validation.percent_balanced, true);
  assert.equal(tiles.validation.quantity_balanced, true);
});

test('rounds to 3 decimals instead of drifting', () => {
  const out = calculate([item('Cable', 1, { reuse_percent: 33.333, dispose_percent: 66.667 })]);
  assert.equal(out.calculated_items[0].calculated.reuse_quantity, 0.333);
  assert.equal(out.calculated_items[0].calculated.dispose_quantity, 0.667);
});

test('flags percentages that do not add up to 100', () => {
  const out = calculate([item('Doors', 10, { reuse_percent: 50, dispose_percent: 40 })]);
  assert.equal(out.calculated_items[0].validation.percent_sum, 90);
  assert.equal(out.calculated_items[0].validation.percent_balanced, false);
});

test('rejects invalid quantities instead of computing on them', () => {
  const out = calculate([item('Glass', -5, { reuse_percent: 100 }), item('Pipes', null, { reuse_percent: 100 })]);
  for (const bad of out.calculated_items) {
    assert.equal(bad.validation.error, 'invalid_quantity');
    assert.deepEqual(bad.calculated, {});
  }
});

test('detects duplicate item names regardless of case and spacing', () => {
  const out = calculate([item('Light fixtures', 4, { reuse_percent: 100 }), item(' light FIXTURES ', 2, { reuse_percent: 100 })]);
  assert.deepEqual(out.duplicates_found, [{ item_name: 'light fixtures', occurrences: 2 }]);
});

test('aggregates child items under their parent', () => {
  const out = calculate([
    item('HVAC system', 1, { dispose_percent: 100 }),
    item('Duct', 12, { reuse_percent: 100 }, 'HVAC system'),
    item('Vent', 8, { dispose_percent: 100 }, 'HVAC system'),
  ]);
  const parent = out.calculated_items.find(i => i.item_name === 'HVAC system');
  assert.deepEqual(parent.parent_aggregation, { child_count: 2, children_total_qty: 20, child_names: ['Duct', 'Vent'] });
});

test('fails closed when the LLM extracts no rules', () => {
  assert.throws(() => calculate([]), /No rules extracted/);
});

test('QA gate: a clean run scores 100 and may auto-export', () => {
  const report = qaReport(calculate([
    item('Tiles', 100, { reuse_percent: 60, dispose_percent: 40 }),
    item('Doors', 10, { reuse_percent: 100 }),
  ]));
  assert.equal(report.quality_score, 100);
  assert.equal(report.quality_label, 'excellent');
  assert.equal(report.can_auto_export, true);
  assert.deepEqual(report.warnings, []);
});

test('QA gate: any warning routes the run to human review', () => {
  const report = qaReport(calculate([
    item('Tiles', 100, { reuse_percent: 60, dispose_percent: 40 }),
    item('Doors', 10, { reuse_percent: 50 }),
  ]));
  assert.equal(report.can_auto_export, false);
  assert.ok(report.warnings.some(w => w.startsWith('IMBALANCE: "Doors"')));
  assert.equal(report.quality_score, 75); // 0.5 x 50% balanced + 0.3 + 0.2 completeness
});
