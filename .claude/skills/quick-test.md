---
name: quick-test
description: Run tests for the current modified files and report results
type: skill
---

# Quick Test Skill

Rapidly run tests for only the files you've changed, not the entire suite.

## What This Does

1. Identifies modified files since the last commit
2. Determines which test files are relevant
3. Runs only those tests
4. Reports pass/fail with timing

## When to Use

- After making changes and want quick feedback
- Before committing to catch local issues
- During active development to stay in flow

## Usage

```
/quick-test
```

or

```
/quick-test --coverage
```

## Output

Returns a summary of test results with:
- Number passed/failed
- Execution time
- Coverage impact (if requested)
