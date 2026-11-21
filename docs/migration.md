# Extraction audit

The source lived in a standalone folder within `llm-zone` as untracked files at extraction time. The original manifest was private, the TypeScript configuration referenced absolute dependency paths, and no package entry point was declared. Reusable lifecycle, event analysis, feedback, completion decisions, broker, UI, and separate-session code were copied into this package. The frozen project-specific gates and adapter, launch scripts, and benchmark results remain benchmark material and are excluded.

Pi Sitter renamed active APIs, commands, session record types, configuration variables, labels, and file paths. The diagnosis model check now uses Pi's selected model instead of LM Studio. Pi runtime imports are package names resolved by Pi, and the manifest declares host-provided peers. The nested supervisor session defaults to Pi's normal agent configuration directory when no override is set. A host-owned verification command provides a generic completion integration.

The original benchmark qualification files imported the old source by relative paths. They must be wired to a qualified Pi Sitter release before that supervisor-specific benchmark can resume. Standard `llm-zone` benchmark runs that do not enable the supervisor are unaffected. No development snapshot is installed into formal benchmarking.

Remaining work before release qualification: review verifier report schema more strictly, test actual supervisor model inference with a configured model, qualify an adapter for direct MCP inspection before enabling that disabled capability, and run the old benchmark integration against a released package. These are separate from the core package's isolated loading and deterministic regression tests.
