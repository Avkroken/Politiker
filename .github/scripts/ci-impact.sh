#!/usr/bin/env bash
set -euo pipefail

out="${GITHUB_OUTPUT:-/dev/stdout}"
node=false
python=false
all=false
base="${CI_BASE_SHA:-}"
head="${CI_HEAD_SHA:-${GITHUB_SHA:-HEAD}}"

if [[ -z "$base" || "$base" =~ ^0+$ ]]; then
  all=true
elif ! git cat-file -e "${base}^{commit}" 2>/dev/null || ! git cat-file -e "${head}^{commit}" 2>/dev/null; then
  all=true
else
  changed="$(git diff --name-only --diff-filter=ACMRDTUXB "$base" "$head")"
  [[ -n "$changed" ]] || all=true

  while IFS= read -r file; do
    [[ -n "$file" ]] || continue
    case "$file" in
      app/*|.node-version)
        node=true
        ;;
      kontakter/*)
        python=true
        ;;
      shared/*|infra/*|forening/*)
        all=true
        ;;
      .github/workflows/ci.yml|.github/scripts/ci-impact.sh)
        all=true
        ;;
      *.md|docs/*|AGENTS.md|CLAUDE.md|LICENSE|SECURITY.md|TODO.md)
        ;;
      .github/*|*.json|*.yaml|*.yml|*.toml|*.lock|Dockerfile*|docker-compose*.yml|docker-compose*.yaml)
        all=true
        ;;
      *)
        all=true
        ;;
    esac
  done <<< "${changed:-}"
fi

if [[ "$all" == true ]]; then
  node=true
  python=true
fi

printf 'node=%s\npython=%s\nall=%s\n' "$node" "$python" "$all" >> "$out"
printf 'CI impact: node=%s python=%s all=%s\n' "$node" "$python" "$all"
