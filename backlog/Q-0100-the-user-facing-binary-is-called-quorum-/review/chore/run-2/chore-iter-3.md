# Q-0100 — code review, run 2 iteration 3

**Verdict: revise.**

major: packages/cli/src/binary-name.test.ts:207 The hand-written scanner treats every `/` outside a string as ordinary code unless it begins a comment, so a valid regex literal containing `'`, `"`, or a backtick changes the scanner's quote parity and can hide a later offending string while AC-4 remains green. This conflicts with AC-6's purpose of automatically covering future production modules; the implementation report acknowledges the false-negative path but leaves it open. Replace this with TypeScript-aware lexical scanning, or make the guard fail closed whenever it encounters syntax it cannot safely classify, and add a regression fixture where a regex containing a quote precedes a `harness` command literal.
