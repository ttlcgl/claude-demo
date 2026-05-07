#!/bin/bash
# Pre-commit hook: runs linting before allowing a commit

# Run linter on staged files
npm run lint --prefix server 2>/dev/null
SERVER_LINT=$?

npm run lint --prefix frontend 2>/dev/null
FRONTEND_LINT=$?

if [ $SERVER_LINT -ne 0 ] || [ $FRONTEND_LINT -ne 0 ]; then
  echo "❌ Linting failed. Fix errors before committing."
  exit 1
fi

echo "✅ Linting passed."
exit 0
