# Q-0054 code review — chore run 2, iteration 3

Verdict: **revise**

major: packages/core/src/spike-parity.test.ts:387 `specifiersOf` only recognizes static `import … from` declarations whose entire clause is on one line. A formatter-wrapped source import such as `import {\n  runFlow\n} from '../src/engine.js'` is silently omitted, making `importsSource` false; a binary-spawning mixed file can therefore be accepted as `cli` without any problem. Parse multiline import clauses or explicitly reject every static import form the scanner cannot resolve, and add a demonstrated wrapped `../src/` case that fails before the fix.

major: packages/core/src/spike-parity.test.ts:741 Directly imported child-process launchers are inspected only when the imported local identifier itself is called. A file can use `const run = spawnSync; run(process.execPath, [candidate])` while importing `../src/`; neither `childProcessBindings` nor `launchSites` reports the non-call use of `spawnSync`, so the file can be accepted as `ported` even though its binary target is unresolved. This is the same indirect-helper failure AC-2 requires to stop rather than default. Track such aliases through to their calls or reject any directly bound launcher use that is not a direct call, with a demonstrated fail-closed case.
