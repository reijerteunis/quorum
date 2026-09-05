# Q-0101 — code review, chore run 2, iteration 4

verdict: revise

blocker: packages/core/src/spike-parity.test.ts:185 AC-10 explicitly requires `q0033-surface.js` to gain its sixth `binaryCarriedBy` counterpart, but the list remains unchanged at five entries. The implement report acknowledges this while claiming AC-10 is satisfied. Because AC-8 is required by R-8 to land in `run.test.ts`, which is already listed, there is no requirements-defined sixth path the implementer can safely add. Obtain a gate erratum correcting AC-10 or naming the missing counterpart, then make the register and its assertions match that ruling.
