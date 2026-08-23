import fs from 'node:fs';
import path from 'node:path';
import { FlowError, flattenSteps, loadFlow } from './engine.js';

export function validateFlowDirectory(harnessDir) {
  const dir = path.join(harnessDir, 'flows');
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.yaml')).sort();
  const flows = new Map();
  const diagnostics = [];

  for (const file of files) {
    try {
      const flow = loadFlow(path.join(dir, file));
      flows.set(flow.name, flow);
    } catch (error) {
      diagnostics.push(`${file}: ${error.message}`);
    }
  }

  const consumers = new Map();
  for (const flow of flows.values()) {
    const list = consumers.get(flow.consumes) ?? [];
    list.push(flow); consumers.set(flow.consumes, list);
  }

  for (const source of flows.values()) {
    for (const step of flattenSteps(source.steps)) {
      const edge = step.on_fail?.goto;
      if (!String(edge ?? '').startsWith('flow:')) continue;
      const targetName = edge.slice(5);
      const target = flows.get(targetName);
      if (!target) {
        diagnostics.push(`${source.name}: target flow ${targetName} is missing or could not load (terminal stage unknown)`);
        continue;
      }
      let stage = target.produces;
      let current = target;
      const visited = new Map();
      while (stage !== source.consumes) {
        const pair = `${current.name}\u0000${stage}`;
        if (visited.has(pair)) {
          const implicated = [...visited.values(), current.name].join(', ');
          diagnostics.push(`${source.name}: target flow ${targetName} return chain cycles at stage ${stage}; implicated flows: ${implicated}`);
          break;
        }
        visited.set(pair, current.name);
        const next = consumers.get(stage) ?? [];
        if (!next.length) {
          diagnostics.push(`${source.name}: target flow ${targetName} return chain has a dead end at terminal stage ${stage}`);
          break;
        }
        if (next.length > 1) {
          diagnostics.push(`${source.name}: target flow ${targetName} return chain is ambiguous at stage ${stage}; implicated flows: ${next.map((f) => f.name).join(', ')}`);
          break;
        }
        current = next[0];
        stage = current.produces;
      }
    }
  }

  if (diagnostics.length) throw new FlowError(`flow directory invalid:\n  - ${diagnostics.join('\n  - ')}`);
  return [...flows.values()];
}
