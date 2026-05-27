# shellcheck shell=bash
# Load project root .env into the current shell (export all keys).
load_project_env() {
  local root="${1:-}"
  if [[ -z "$root" ]]; then
    echo "load_project_env: missing project root" >&2
    return 1
  fi
  local env_file="$root/.env"
  if [[ ! -f "$env_file" ]]; then
    echo "Missing $env_file — copy from .env.example" >&2
    return 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
}
