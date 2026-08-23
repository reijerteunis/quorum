import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export class FlowError extends Error {}

export function flattenSteps(steps = []) { return steps.flatMap((step) => (step.parallel ? step.parallel : [step])); }

function groupBy(values, keyOf) {
  const groups = new Map();
  for (const value of values) {
    const key = keyOf(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

function writesOf(step) {
  const output = step.output ?? {};
  return [...(output.write ? [output.write] : []), ...(output.writes ?? [])];
}

function globMatch(pattern, value) {
  return new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$').test(value)
    || (pattern.endsWith('/') && value.startsWith(pattern));
}

export function lintFlow(flow) {
  const problems = [];
  const steps = flattenSteps(flow.steps);
  const ids = steps.filter((step) => step.id).map((step) => step.id);
  ids.forEach((id, index) => { if (ids.indexOf(id) !== index) problems.push(`duplicate step id "${id}"`); });
  for (const step of steps) {
    if (step.on_fail) {
      if (!step.on_fail.goto) problems.push(`${step.id}: on_fail without goto`);
      else if (!String(step.on_fail.goto).startsWith('flow:') && !ids.includes(step.on_fail.goto)) problems.push(`${step.id}: goto target "${step.on_fail.goto}" not found`);
      if (!Number.isInteger(step.on_fail.max_iterations) || step.on_fail.max_iterations <= 0) {
        problems.push(`${step.id}: on_fail.max_iterations must be an integer greater than zero`);
      }
      const counter = step.on_fail.counter;
      if (counter != null && (typeof counter !== 'string' || !counter.trim())) {
        problems.push(`${step.id}: on_fail.counter must be a non-empty unprefixed key`);
      } else if (typeof counter === 'string' && counter.startsWith('iterations.')) {
        const corrected = counter.slice('iterations.'.length);
        problems.push(`${step.id}: counter "${counter}" must be unprefixed; use "${corrected}"`);
      }
      if (step.on_fail.on_exhausted !== 'gate') problems.push(`${step.id}: on_exhausted must be "gate"`);
    }
    if (step.output?.verdict && !step.on_fail && !step.route) problems.push(`${step.id}: has a verdict but no on_fail/route — verdicts must go somewhere`);
    if (step.fan_out && !step.step) problems.push(`${step.id}: fan_out needs a step template`);
    if (step.type === 'integrate' && !step.branches) problems.push(`${step.id}: integrate needs branches`);
  }
  if (flow.cross_vendor === 'required') {
    let invalidPanel = false;
    for (const group of flow.steps ?? []) {
      if (!group.parallel || group.parallel.length < 2) continue;
      const byRole = groupBy(group.parallel, (step) => step.role);
      for (const members of byRole.values()) {
        if (members.length < 2) continue;
        const adapters = new Set(members.map((step) => step.adapter));
        if (adapters.size < 2) {
          invalidPanel = true;
          problems.push(`parallel group ${members.map((step) => step.id).join(', ')} shares role "${members[0].role}" and adapter "${members[0].adapter}" — cross_vendor: required needs at least two adapters`);
        }
      }
    }
    if (!invalidPanel) {
      const producer = {};
      for (const step of steps) for (const written of writesOf(step)) producer[written] = step.adapter;
      for (const step of steps) {
        if (!step.output?.verdict) continue;
        const reviewed = (step.input?.backlog ?? []).flatMap((input) => Object.keys(producer).filter((written) => globMatch(input, written)));
        if (reviewed.length && reviewed.every((written) => producer[written] === step.adapter)) {
          problems.push(`${step.id}: every input it judges (${reviewed.join(', ')}) was written by its own vendor (${step.adapter}) — cross_vendor: required`);
        }
      }
    }
  }
  for (const step of steps) {
    const target = step.on_fail?.goto;
    if (!target || String(target).startsWith('flow:')) continue;
    const written = writesOf(step);
    if (!written.length) continue;
    const destination = steps.find((candidate) => candidate.id === target);
    if (!destination || destination.fan_out) continue;
    const receives = destination.input?.backlog ?? [];
    if (!written.some((output) => receives.some((input) => globMatch(input, output)))) {
      problems.push(`${step.id}: loops back to "${target}", which never receives ${written.join(', ')} — the loop cannot converge`);
    }
  }
  if (!flow.consumes || !flow.produces) problems.push('flow needs consumes/produces');
  const gates = steps.filter((step) => step.gate);
  if (flow.produces === 'deployed' && !gates.some((gate) => gate.gate === 'human-locked')) problems.push('deploy flow must contain a human-locked gate');
  if (problems.length) throw new FlowError(`flow ${flow.name ?? flow.file} invalid:\n  - ${problems.join('\n  - ')}`);
  return true;
}

export function lintFlowDirectory(directory) {
  const records = [];
  const flows = [];
  for (const filename of fs.readdirSync(directory).filter((name) => name.endsWith('.yaml')).sort()) {
    const file = path.join(directory, filename);
    try {
      const flow = YAML.parse(fs.readFileSync(file, 'utf8'));
      flow.file = file;
      lintFlow(flow);
      flows.push(flow);
      records.push({ file, flow, problems: [] });
    } catch (error) {
      records.push({ file, problems: [error.message] });
    }
  }
  const byFilename = new Map(records.filter((record) => record.flow).map((record) => [path.basename(record.file, '.yaml'), record.flow]));
  const byStage = groupBy(flows, (flow) => flow.consumes);
  for (const source of flows) {
    const record = records.find((candidate) => candidate.flow === source);
    for (const step of flattenSteps(source.steps)) {
      const edge = step.on_fail?.goto;
      if (!String(edge ?? '').startsWith('flow:')) continue;
      const targetName = edge.slice(5);
      const target = byFilename.get(targetName);
      if (!target) {
        record.problems.push(`flow ${source.name}: target flow ${targetName} is missing or unloadable`);
        continue;
      }
      let stage = target.produces;
      let current = target;
      const visited = new Map();
      while (stage !== source.consumes) {
        const pair = `${current.name}\0${stage}`;
        if (visited.has(pair)) {
          const cycle = [...visited.values(), current.name].join(', ');
          record.problems.push(`flow ${source.name}: target flow ${targetName} has a cycle at stage ${stage}; implicated flows: ${cycle}`);
          break;
        }
        visited.set(pair, current.name);
        const consumers = byStage.get(stage) ?? [];
        if (consumers.length === 0) {
          record.problems.push(`flow ${source.name}: target flow ${targetName} dies at stage ${stage}; it never returns to ${source.consumes}`);
          break;
        }
        if (consumers.length > 1) {
          record.problems.push(`flow ${source.name}: target flow ${targetName} is ambiguous at stage ${stage}; implicated flows: ${consumers.map((flow) => flow.name).join(', ')}`);
          break;
        }
        [current] = consumers;
        stage = current.produces;
      }
    }
  }
  return records;
}

export function validateFlowDirectory(directory) {
  const records = lintFlowDirectory(directory);
  const invalid = records.filter((record) => record.problems.length);
  if (invalid.length) {
    throw new FlowError(invalid.map((record) => `${path.basename(record.file)}:\n  - ${record.problems.join('\n  - ')}`).join('\n'));
  }
  return records.map((record) => record.flow);
}
