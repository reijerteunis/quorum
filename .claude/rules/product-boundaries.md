# Product boundaries

- Quorum is product-agnostic. Nothing in this repository references feedmind, flextann or any other SaaS product except as an example name in demo data. Product knowledge belongs in *that* repo's `harness/` context files.
- "Harness" is the concept and the folder (`harness/`); "Quorum" is the product. Never call the product a harness, never call the folder quorum.
- BYOS — bring your own subscriptions. No API keys, ever, on any code path, including tests and docs examples.
- The vendor CLIs keep owning interactive hacking. Quorum owns the flow; it does not rebuild a chat IDE.
- Flows are YAML files in the project; the UI edits files and never holds the truth.
- Human-gated by default; `auto` is opt-in per gate; `human-locked` cannot be overridden.
- Out of v1 (do not build by accident): multi-user, remote daemon, cloud sync, plugin marketplace, visual node canvas, eval suites, Gemini adapter (roadmap, community), desktop shell.
