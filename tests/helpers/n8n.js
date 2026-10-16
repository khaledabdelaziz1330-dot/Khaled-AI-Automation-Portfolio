'use strict';
// Minimal n8n Code-node runtime for tests.
// Code is loaded from each project's workflow.json at test time, so the tests
// exercise exactly the code that ships — never a copy that could drift.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function projects() {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, 'workflow.json')))
    .map(d => d.name)
    .sort();
}

function loadWorkflow(project) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, project, 'workflow.json'), 'utf8'));
}

function getNode(project, nodeName) {
  const node = loadWorkflow(project).nodes.find(n => n.name === nodeName);
  if (!node) throw new Error(`Node "${nodeName}" not found in ${project}/workflow.json`);
  return node;
}

// n8n's item accessors: $input.all(), $input.first(), $('Node').item, ...
function accessor(list) {
  const items = list.map(json => ({ json }));
  return { all: () => items, first: () => items[0], last: () => items[items.length - 1], item: items[0] };
}

const quietConsole = { log() {}, info() {}, warn() {}, error() {}, debug() {} };

/**
 * Run a Code node ("Run Once for All Items" mode).
 * @param {string} project   project folder, e.g. 'clinic-booking-system'
 * @param {string} nodeName  Code node name in that workflow
 * @param {object} ctx       { input: [json...], nodes: { 'Node Name': [json...] }, env: {}, now }
 * @returns {object[]}       the node's output items, unwrapped to their .json
 */
function runCode(project, nodeName, { input = [], nodes = {}, env = {}, now } = {}) {
  const code = getNode(project, nodeName).parameters.jsCode;
  const $input = accessor(input);
  const $ = name => {
    if (!(name in nodes)) throw new Error(`Test did not provide output for upstream node "${name}"`);
    return accessor(nodes[name]);
  };
  const fn = new Function('$input', '$', '$env', '$now', 'console', code);
  return fn($input, $, env, now, quietConsole).map(item => item.json);
}

// Outbound connections of a node: [{ output, target }]
function outgoing(workflow, nodeName) {
  const main = workflow.connections[nodeName]?.main || [];
  return main.flatMap((targets, output) => (targets || []).map(t => ({ output, target: t.node })));
}

module.exports = { ROOT, projects, loadWorkflow, getNode, runCode, outgoing };
