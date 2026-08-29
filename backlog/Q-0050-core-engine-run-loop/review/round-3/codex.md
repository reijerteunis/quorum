# Code review — Q-0050, round 3

## Findings

### major — Successful steps never emit the required `step` and `done` events

`packages/core/src/engine/engine.ts:209`

The step loop calls `runStep` directly without emitting `step` before execution or `done` after a successful result. Neither `runStep` nor `askGate` supplies these events. Consequently, even the gate steps implemented by this ticket produce no step lifecycle events, contrary to AC-2’s ordering contract. Consumers cannot render which step is currently executing, and a completed step is indistinguishable from one that was never started.

Emit `step` immediately before invoking `runStep`, and emit `done` only after it resolves successfully, before applying its routing result. Add an end-to-end assertion covering both events and proving a failed or aborted step emits no `done`.

### major — Auto-advanced and dry-run gates consume correlation IDs despite never asking a question

`packages/core/src/engine/routing.ts:83`

`runStep` calls `context.nextGateId()` while constructing every gate request, before `askGate` evaluates its auto and dry short-circuits. Thus an auto-advanced or dry-preview gate consumes an ID even though no gate event is emitted and no answer can correspond to it. This contradicts AC-4’s requirement that these short-circuits run before a question is allocated and makes subsequent externally visible gate IDs contain phantom gaps.

Move ID allocation into `askGate`, after the auto/dry checks and immediately before emitting the question. Tests should assert that an auto or dry gate does not advance the run-scoped gate sequence.

### major — Returning an iterator while a pull is pending can still deliver an event after abandonment

`packages/core/src/engine/channel.ts:106`

`abandon()` sets `abandoned` but does not detach or settle an existing `pending` pull. During awaited finalisation, the producer emits rollback, terminal-info, or terminal events; `sink.emit()` then calls `settlePending()` and resolves that pre-existing `next()` with an event. This violates the channel contract that `return()` closes delivery and that an abandoning consumer cannot observe the terminal event it caused. It can also leave inconsistent results where `return()` and a prior `next()` both settle successfully.

On abandonment, atomically close delivery and settle or reject any pending pull before finalisation can enqueue events. Add a test that starts a pending `next()`, calls `return()`, emits during finalisation, and verifies the pending pull cannot receive that event.
