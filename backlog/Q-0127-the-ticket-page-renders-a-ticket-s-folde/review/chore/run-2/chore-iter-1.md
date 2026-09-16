# Review — Q-0127 chore run 2, iteration 1

Verdict: **revise**

major: apps/web/src/ticket-page.tsx:213 File requests all share only the page-level `generation`, so opening file B before file A finishes does not invalidate A. If A resolves last, line 219 overwrites `file` with A while `selected` still identifies B; the same race exists between the automatic `ticket.md` request and an artifact selected immediately afterward. Track a separate monotonically increasing file-request generation (or verify both generation and requested `rel`) before applying a response, and add a deferred-response test that resolves two selections in reverse order.

major: apps/web/src/ticket-page.tsx:301 Changing tabs updates only `tab`; it leaves `selected` and `file` from the previous tab intact. Consequently, selecting an artifact and then switching tabs renders the previous tab’s contents beneath the new tab’s file list, while the selected path is not present in that list. Clear the file selection/state when changing tabs or maintain selection state per tab, and test that no file from the prior tab remains visible after a tab switch.
