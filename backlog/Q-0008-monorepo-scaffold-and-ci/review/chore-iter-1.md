# Q-0008 chore review — iteration 1

major: package.json:16 The declared `engines.node: ">=22"` overstates the supported runtime: ESLint 10.9.0 requires Node 22.13 or newer, while Vite 8.2.2 and its Rolldown dependency require Node 22.12 or newer. A contributor using a valid Node 22.0–22.11 installation can therefore encounter engine warnings or runtime failures despite satisfying the repository contract. Select dependency versions supporting the full declared Node ≥22 range, or obtain a requirements change before raising the repository’s minimum Node version.
