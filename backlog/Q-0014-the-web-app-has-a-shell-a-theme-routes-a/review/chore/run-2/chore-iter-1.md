# Review

Verdict: **revise**

major: apps/web/package.json:16 `jsdom@^30.0.1` requires Node `^22.22.2 || ^24.15.0 || >=26`, while the workspace supports Node `>=22.13.0`. A supported Node 22 installation can therefore fail to install or run the required smoke test. Select a jsdom version compatible with the full workspace engine range, or deliberately raise and consistently document/test the workspace minimum in a separately authorized change.
