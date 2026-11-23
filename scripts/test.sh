#!/usr/bin/env bash
# Corre la suite completa: backend (Gradle, H2) y luego frontend (Vitest).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

(cd "$ROOT/backend" && ./gradlew test)
(cd "$ROOT/frontend" && npm test)
