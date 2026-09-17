# Code review — Q-0131 implement iteration 3

Verdict: **revise**

major: apps/web/test/source.test.ts:135 The AC-6 guard deliberately does not follow event-message text stored in object properties, while lines 220–224 deliberately omit unary and arithmetic numeric coercions. Consequently code such as `const carrier = { prose: event.message }; const runId = +carrier.prose.split(assembledNeedle)[1]` evades the literal, alias/extraction, and coercion checks while extracting a number from an event message—the exact behavior AC-6 requires the guard to forbid. Replace the partial text scan with enforcement that covers these data-flow/coercion forms (preferably a type-aware lint rule), and add this object-property plus unary-coercion case as a discriminating fixture.

major: apps/web/test/source.test.ts:213 `COERCES_TO_NUMBER` imposes a blanket ban on `Number`, `parseInt`, and `parseFloat` anywhere under `apps/web/src`, including conversions unrelated to event messages. AC-6 authorizes forbidding extraction from human-readable event prose, not all numeric conversion in the web application; this creates an unrequested repository-wide constraint that will reject legitimate future parsing without strengthening the uncovered coercion forms above. Scope the check to values originating from event messages instead of banning these APIs globally.
