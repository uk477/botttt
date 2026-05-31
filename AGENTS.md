# AGENTS.md

## Main Rules

Always follow these rules unless the user explicitly overrides them.

1. Minimize credits, tokens, file reads, and tool calls.
2. Never scan the whole repository unless explicitly requested.
3. Never read node_modules, dist, build, coverage, lock files, generated files, or vendor folders.
4. Before editing, identify the exact relevant files.
5. Prefer small targeted changes over large rewrites.
6. Follow the existing project style and architecture.
7. Ask one short question if the task is unclear.
8. Keep answers short and practical.

## Code Style

- Write clean, modern, production-ready TypeScript.
- Use simple readable names.
- Do not use slang, jokes, or casual language in code, comments, commits, or documentation.
- Avoid overengineering.
- Avoid unnecessary abstractions.
- Preserve existing behavior unless asked otherwise.
- Fix root causes, not symptoms.

## Project Notes

- Stack: React, TypeScript, Vite, Express, SQLite.
- Validate all API input.
- Do not change database schema without approval.
- Do not change public APIs unless explicitly requested.
- Reuse existing components, utilities, and patterns.