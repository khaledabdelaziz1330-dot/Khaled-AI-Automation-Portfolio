'use strict';
// hostzera-chat-widget: input guards and deterministic retrieval — the model only ever sees
// the top-ranked knowledge-base rows, or an explicit "no match".

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runCode } = require('./helpers/n8n');

const P = 'hostzera-chat-widget';

const validate = body =>
  runCode(P, 'Validate Request', { input: [{ body, headers: { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'test' } }] })[0];

const KB = [
  { product: 'VPS Hosting', description: 'Virtual private server with root access and SSD storage', tags: 'vps server root ssd', price: '€12/mo', url: '/vps' },
  { product: 'WordPress Hosting', description: 'Managed hosting optimised for WordPress sites', tags: 'wordpress cms blog', price: '€5/mo', url: '/wordpress' },
  { product: 'Domain Registration', description: 'Register .com, .nl and .eu domains', tags: 'domain dns', price: '€9/yr', url: '/domains' },
  { product: 'Email Hosting', description: 'Professional email on your own domain', tags: 'email mailbox', price: '€2/mo', url: '/email' },
  { product: 'SSL Certificates', description: 'Secure your site with HTTPS', tags: 'ssl https security', price: '€0', url: '/ssl' },
  { product: 'Dedicated Server', description: 'Bare-metal server with full hardware control', tags: 'server dedicated', price: '€90/mo', url: '/dedicated' },
  { product: 'Website Builder', description: 'Drag-and-drop site builder', tags: 'builder website', price: '€4/mo', url: '/builder' },
];

const retrieve = message =>
  runCode(P, 'KB Retrieval & Scoring', {
    nodes: { 'Validate Request': [{ message }], 'Get Knowledge Base': KB },
  })[0];

test('rejects requests without a message or session', () => {
  assert.throws(() => validate({ session_id: 's1' }), /message/);
  assert.throws(() => validate({ message: 'hi' }), /session_id/);
});

test('caps message length before anything reaches the LLM', () => {
  assert.throws(() => validate({ session_id: 's1', message: 'x'.repeat(1001) }), /exceeds 1000/);
  assert.equal(validate({ session_id: 's1', message: '  Hello  ' }).message, 'Hello');
});

test('an exact product-name match ranks first', () => {
  const out = retrieve('Do you have VPS hosting with root access?');
  assert.equal(out.retrieved_products[0].product, 'VPS Hosting');
});

test('returns at most 5 rows of context', () => {
  const out = retrieve('server hosting domain email ssl builder wordpress dedicated');
  assert.ok(out.retrieved_count <= 5);
  assert.equal(out.retrieved_products.length, out.retrieved_count);
});

test('says explicitly when nothing matches, so the model hands off instead of inventing', () => {
  const out = retrieve('Bicycles?');
  assert.equal(out.retrieved_count, 0);
  assert.equal(out.retrieved_context, 'No matching products found in knowledge base.');
});

test('detects Arabic and formats the last 10 turns of history', () => {
  const history = Array.from({ length: 14 }, (_, i) => ({
    direction: i % 2 ? 'outbound' : 'inbound', user_message: `q${i}`, ai_response: `a${i}`,
  }));
  const out = runCode(P, 'Detect Language & Format History', {
    nodes: { 'Validate Request': [{ message: 'كم سعر الاستضافة؟' }], 'Get Session History': history },
  })[0];
  assert.equal(out.detected_language, 'ar');
  assert.equal(out.history.length, 10);
  assert.deepEqual(out.history[0], { role: 'user', content: 'q4' });
});
