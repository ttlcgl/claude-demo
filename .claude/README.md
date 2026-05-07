# Claude Code Project Configuration

This directory contains Claude Code configuration and custom extensions for this project.

## Folder Structure

```
.claude/
├── settings.json          # Project-level Claude Code settings & hooks
├── keybindings.json       # Custom keyboard shortcuts (optional)
├── commands/              # Custom slash commands (/your-command)
├── skills/                # Custom workflow skills (reusable processes)
├── agents/                # Custom agent definitions (specialized workers)
├── hooks/                 # Git hooks and automation scripts
├── templates/             # File templates for new code
├── memory/                # Session memory files (persistent across conversations)
└── README.md              # This file
```

## Getting Started

### Commands (`.claude/commands/`)
Custom slash commands that run in Claude Code. Example: `/demo-test`, `/pr-review`.

### Skills (`.claude/skills/`)
Reusable workflows that Claude can invoke. Example: `/quick-test` runs tests for changed files.

### Agents (`.claude/agents/`)
Specialized agents that handle specific tasks. Example: code-reviewer agent for PR reviews.

### Hooks (`settings.json`)
Automated triggers for git events or Claude actions. Configure in `settings.json` under `hooks`.

### Templates (`.claude/templates/`)
Boilerplate files for new components, tests, etc.

### Memory (`.claude/memory/`)
Persistent notes about the project, user preferences, and learnings that Claude remembers across sessions.

## Example Usage

```bash
# Custom command
/pr-review

# Custom skill (if configured)
/quick-test --coverage

# Dispatch custom agent
Hey code-reviewer, review this PR for security issues.
```

## Documentation

- [Claude Code Docs](https://claude.com/docs)
- [Custom Skills Guide](https://claude.com/docs/skills)
- [Agent Development](https://claude.com/docs/agents)
