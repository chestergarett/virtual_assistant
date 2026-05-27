#!/usr/bin/env python3
"""Convert selected keys from .env to a YAML file for gcloud run --env-vars-file."""

from __future__ import annotations

import sys
from pathlib import Path


def parse_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        out[key] = value
    return out


def main() -> None:
    if len(sys.argv) < 3:
        print(
            "Usage: env-to-cloudrun-yaml.py <path-to-.env> <comma-separated-keys>",
            file=sys.stderr,
        )
        sys.exit(1)

    env_path = Path(sys.argv[1])
    allowed = {k.strip() for k in sys.argv[2].split(",") if k.strip()}
    parsed = parse_env(env_path)

    lines: list[str] = []
    for key in sorted(allowed):
        if key not in parsed or parsed[key] == "":
            continue
        val = parsed[key].replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'{key}: "{val}"')

    sys.stdout.write("\n".join(lines) + ("\n" if lines else ""))


if __name__ == "__main__":
    main()
