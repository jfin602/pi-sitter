# Pi Sitter Vision

Pi Sitter is a **general-purpose, on-demand supervisor extension for Pi Coding Agent**. A worker performs implementation; on an existing trigger or verification checkpoint, Pi Sitter receives bounded task evidence, independently researches the relevant failure through read-only tools, delivers actionable repair directions, and returns to inactivity.

The system is useful across languages, frameworks and repositories. `llm-zone` is the initial consumer and benchmark authority, not an architectural dependency. Vitest provides initial machine-readable gate outcomes through an adapter; other runners may implement the same generic contract.

**Target interaction:** Worker milestone → approved tests produce structured gate report → failed/blocked gates focus Pi Sitter → scoped evidence inspection → detailed repair guidance → worker repairs → approved rerun. At final completion, Pi Sitter separately verifies original requirements and states evidence limitations.

Successful 1.0 means reliable tool isolation, honest tests and recovery, real Pi compatibility and multi-project qualification—not an unverified uplift claim or arbitrary autonomy.
