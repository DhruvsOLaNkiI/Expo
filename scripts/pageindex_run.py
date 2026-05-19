#!/usr/bin/env python3
"""
Run PageIndex from the expo repo root with env wired for Gemini (LiteLLM).

Loads, in order (later overrides earlier):
  1. Project root `.env` (optional)
  2. `pageindex/.env` (optional)

Maps `OPENROUTER_API_KEY` (preferred) or `VITE_GEMINI_API_KEY` → `GEMINI_API_KEY` for LiteLLM.

Usage:
  python3 scripts/pageindex_run.py --pdf_path examples/documents/2023-annual-report.pdf
  npm run pageindex:run-example
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def _parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        out[key] = val
    return out


def _pageindex_python(pageindex: Path) -> str:
    mac_linux = pageindex / ".venv" / "bin" / "python3"
    if mac_linux.is_file():
        return str(mac_linux)
    win = pageindex / ".venv" / "Scripts" / "python.exe"
    if win.is_file():
        return str(win)
    return sys.executable


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    pageindex = root / "pageindex"
    runner = pageindex / "run_pageindex.py"
    if not runner.is_file():
        print("error: pageindex submodule missing. Run: git submodule update --init --recursive", file=sys.stderr)
        sys.exit(1)

    merged: dict[str, str] = {}
    merged.update(_parse_env_file(root / ".env"))
    merged.update(_parse_env_file(pageindex / ".env"))

    for k, v in merged.items():
        if k not in os.environ or not os.environ.get(k, "").strip():
            os.environ[k] = v

    if not os.environ.get("OPENROUTER_API_KEY", "").strip():
        or_vite = os.environ.get("VITE_OPENROUTER_API_KEY", "").strip()
        if or_vite:
            os.environ["OPENROUTER_API_KEY"] = or_vite

    if not os.environ.get("GEMINI_API_KEY", "").strip() and not os.environ.get("GOOGLE_API_KEY", "").strip():
        vite = os.environ.get("VITE_GEMINI_API_KEY", "").strip()
        if vite:
            os.environ["GEMINI_API_KEY"] = vite

    has_openrouter = bool(os.environ.get("OPENROUTER_API_KEY", "").strip())
    has_gemini = bool(os.environ.get("GEMINI_API_KEY", "").strip() or os.environ.get("GOOGLE_API_KEY", "").strip())

    if not has_openrouter and not has_gemini:
        print(
            "error: No LLM API key found. Set one of:\n"
            "  OPENROUTER_API_KEY in project root .env (recommended — https://openrouter.ai/keys)\n"
            "  or GEMINI_API_KEY / VITE_GEMINI_API_KEY for Google Gemini.\n",
            file=sys.stderr,
        )
        sys.exit(1)

    py = _pageindex_python(pageindex)
    venv_ok = (pageindex / ".venv" / "bin" / "python3").is_file() or (pageindex / ".venv" / "Scripts" / "python.exe").is_file()
    if not venv_ok:
        print(
            "error: pageindex/.venv not found or incomplete. Run: npm run pageindex:install\n"
            "(Uses a local venv because system Python often blocks global pip — PEP 668.)",
            file=sys.stderr,
        )
        sys.exit(1)

    os.chdir(pageindex)
    cmd = [py, "run_pageindex.py", *sys.argv[1:]]
    raise SystemExit(subprocess.call(cmd))


if __name__ == "__main__":
    main()
