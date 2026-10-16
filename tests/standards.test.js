'use strict';
// Portfolio-wide engineering standards (see PATTERNS.md and SECURITY.md),
// enforced on every workflow.json in the repository.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, projects, loadWorkflow } = require('./helpers/n8n');

const EXTERNAL_TYPES = new Set([
  'httpRequest', 'openAi', 'gmail', 'googleSheets', 'googleCalendar', 'telegram', 'slack', 'rssFeedRead',
]);
const LLM_TYPES = new Set(['openAi']);
const ROUTERS = new Set(['if', 'switch']);
// Outbound messages and bookings are non-idempotent: a retry after a request that actually
// succeeded would message someone twice or double-book a slot.
const NON_IDEMPOTENT = /\b(send|create booking|book trial)\b/i;

const SECRET_PATTERNS = [
  /sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/, // OpenAI / Anthropic keys
  /AKIA[0-9A-Z]{16}/, // AWS access key
  /AIza[0-9A-Za-z_-]{30,}/, // Google API key
  /xox[abpr]-[0-9A-Za-z-]{10,}/, // Slack token
  /EAA[0-9A-Za-z]{30,}/, // Meta access token
  /ghp_[0-9A-Za-z]{30,}/, // GitHub token
  /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/, // Telegram bot token
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

const kind = node => node.type.split('.').pop();
const isSticky = node => kind(node) === 'stickyNote';

for (const project of projects()) {
  describe(project, () => {
    const raw = fs.readFileSync(path.join(ROOT, project, 'workflow.json'), 'utf8');
    const wf = loadWorkflow(project);
    const nodes = wf.nodes.filter(n => !isSticky(n));
    const names = new Set(wf.nodes.map(n => n.name));

    test('every connection points to an existing node', () => {
      for (const [source, conn] of Object.entries(wf.connections)) {
        assert.ok(names.has(source), `unknown source node "${source}"`);
        for (const targets of conn.main || []) {
          for (const t of targets || []) assert.ok(names.has(t.node), `"${source}" -> unknown node "${t.node}"`);
        }
      }
    });

    test('node names and ids are unique', () => {
      assert.equal(new Set(wf.nodes.map(n => n.name)).size, wf.nodes.length, 'duplicate node name');
      assert.equal(new Set(wf.nodes.map(n => n.id)).size, wf.nodes.length, 'duplicate node id');
    });

    test('credentials are placeholders, never real ids', () => {
      for (const node of nodes) {
        for (const [type, cred] of Object.entries(node.credentials || {})) {
          assert.match(String(cred.id), /^REPLACE_/, `${node.name}: ${type} credential id is not a placeholder`);
        }
      }
    });

    test('no secrets or private keys in the export', () => {
      for (const pattern of SECRET_PATTERNS) assert.doesNotMatch(raw, pattern);
    });

    test('failures are routed to the shared error handler', { skip: project === 'shared-error-handler' }, () => {
      assert.ok(wf.settings?.errorWorkflow, 'settings.errorWorkflow is not set');
    });

    test('external reads and AI calls retry 3x, 2 s apart; sends and bookings never auto-retry', () => {
      for (const node of nodes.filter(n => EXTERNAL_TYPES.has(kind(n)))) {
        if (NON_IDEMPOTENT.test(node.name)) {
          assert.ok(!node.retryOnFail, `${node.name}: non-idempotent action must not auto-retry`);
        } else {
          assert.equal(node.retryOnFail, true, `${node.name}: missing retryOnFail`);
          assert.equal(node.maxTries, 3, `${node.name}: maxTries should be 3`);
          assert.equal(node.waitBetweenTries, 2000, `${node.name}: waitBetweenTries should be 2000 ms`);
        }
      }
    });

    test('an LLM call is never triggered twice by parallel branches', () => {
      const typeOf = Object.fromEntries(wf.nodes.map(n => [n.name, kind(n)]));
      for (const node of nodes.filter(n => LLM_TYPES.has(kind(n)) || /claude|anthropic/i.test(n.name))) {
        const sources = new Set();
        for (const [source, conn] of Object.entries(wf.connections)) {
          for (const targets of conn.main || []) {
            if ((targets || []).some(t => t.node === node.name)) sources.add(source);
          }
        }
        // Several branches of one IF/Switch are mutually exclusive; anything else needs a Merge first.
        const ok = sources.size <= 1 || [...sources].every(s => ROUTERS.has(typeOf[s]));
        assert.ok(ok, `${node.name} has parallel inputs from ${[...sources].join(', ')} — join them with a Merge node`);
      }
    });
  });
}
