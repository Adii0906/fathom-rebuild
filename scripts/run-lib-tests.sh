#!/usr/bin/env bash
# Runs logic + API tests with Node's built-in TypeScript support (Node >= 22.7), no install needed.
# See scripts/prepare-tests.mjs for how imports are rewritten and LangGraph is shimmed.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
node scripts/prepare-tests.mjs "$PWD" "$tmp"
node --experimental-transform-types --no-warnings --test "$tmp"/tests/*.test.ts
