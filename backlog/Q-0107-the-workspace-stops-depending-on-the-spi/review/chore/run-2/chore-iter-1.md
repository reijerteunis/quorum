# Code review

Verdict: **revise**

- blocker: packages/cli/src/spike-dependencies.test.ts:475 AC-29 requires AC-10’s disposition key set to be derived from a scan of the tree so an overlooked dependency becomes red, but this suite only iterates the hand-written `DISPOSITIONS` array, checks its rows for uniqueness/evidence, and pins hand-written verdict counts. A dependency can therefore be omitted entirely while every assertion remains green—the exact silent failure AC-29 was added to prevent. Derive the pre-change dependency/site inventory independently from repository content (or another executable source of truth), compare it one-to-one with `DISPOSITIONS`, and add the required mutation proving a newly introduced qualifying reference fails until classified.
