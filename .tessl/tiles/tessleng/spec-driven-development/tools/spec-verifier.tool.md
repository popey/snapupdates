# spec-verifier Tool

A standalone Python script for managing spec stamps and verification without external dependencies.

## Installation

From your project root, extract the tool:

```bash
sed -n '/^```python$/,/^```$/p' .tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.tool.md | \
  sed '1d;$d' > .tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.py && \
  chmod +x .tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.py
```

See [spec-verification.md](../spec-verification.md) for usage and workflow.

## Source Code

```python
#!/usr/bin/env python3
"""
spec-verifier - Spec/code stamp and status verification

A standalone tool for managing spec stamps without external dependencies.
Detects spec/code divergence and stamps files with verification hashes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any


# ============================================================================
# Hash Functions
# ============================================================================


def compute_spec_hash(spec_text: str) -> str:
    """Compute the first 12 chars of SHA256 hash of spec content."""
    return hashlib.sha256(spec_text.encode("utf-8")).hexdigest()[:12]


def _strip_tag_block(code_text: str) -> str:
    """Remove @specstamp tag from code."""
    match = extract_tag(code_text)
    if not match:
        return code_text
    start, end = match.span()
    # Remove leading/trailing blank lines around the tag
    before = code_text[:start].rstrip("\n")
    after = code_text[end:].lstrip("\n")
    join = (before + "\n\n" if before else "") + after
    return join if join else after


def compute_code_hash(code_text: str) -> str:
    """Compute the first 12 chars of SHA256 hash of code without stamp."""
    body = _strip_tag_block(code_text).strip()
    return hashlib.sha256(body.encode("utf-8")).hexdigest()[:12]


# ============================================================================
# Tag Parsing / Emission
# ============================================================================


TAG_PREFIX = r"\s*(?://|#|--)[ \t]*"
STAMP_LINE = r"User stamped this file as up-to-date on \d{4}-\d{2}-\d{2}"

# Previous Tessl multi-line header (legacy; for removal/replacement only)
_LEGACY_MULTI = (
    rf"{TAG_PREFIX}GENERATED FROM SPEC - DO NOT EDIT\s*\n"
    rf"{TAG_PREFIX}@generated with .* from .*(?:\s*\n"
    rf"{TAG_PREFIX}(?: ?\((?:spec|code):[a-f0-9]{{8}}\)){{0,2}}(?:.*)?"
    rf"(?:\s*\n{TAG_PREFIX}{STAMP_LINE})?)?"
)
_LEGACY_XML = (
    r"\s*<!--\s*GENERATED FROM SPEC - DO NOT EDIT\s*-->\s*\n"
    r"\s*<!--\s*@generated with .* from .*\s*-->"
    r"(?:\s*\n\s*<!--\s*(?: ?\((?:spec|code):[a-f0-9]{8}\))?(?:.*?)?\s*-->(?:\s*\n\s*<!--\s*"
    + STAMP_LINE
    + r"\s*-->)?)?"
)
LEGACY_TAG_RE = re.compile(rf"^({_LEGACY_MULTI}|{_LEGACY_XML})$", re.M)

# New one-line JSON header
NEW_LINE_RE = re.compile(rf"^{TAG_PREFIX}@specstamp\s+(\{{.*\}})\s*$", re.M)
NEW_HTML_RE = re.compile(r"^\s*<!--\s*@specstamp\s+(\{.*\})\s*-->\s*$", re.M)


def extract_tag(code_text: str) -> Optional[re.Match[str]]:
    """Extract @specstamp tag from code."""
    # Prefer new style, then legacy
    m = NEW_LINE_RE.search(code_text) or NEW_HTML_RE.search(code_text)
    if m:
        return m
    return LEGACY_TAG_RE.search(code_text)


_SPEC_HASH_RE_LEGACY = re.compile(r"\(spec:([a-f0-9]{8})\)")
_CODE_HASH_RE_LEGACY = re.compile(r"\(code:([a-f0-9]{8})\)")


def extract_hashes(code_text: str) -> Tuple[Optional[str], Optional[str]]:
    """Return (spec, code) hashes if present in the header."""
    m = NEW_LINE_RE.search(code_text) or NEW_HTML_RE.search(code_text)
    if m:
        try:
            payload = json.loads(m.group(1))
            return payload.get("spec"), payload.get("code")
        except Exception:
            return None, None

    m2 = LEGACY_TAG_RE.search(code_text)
    if m2:
        segment = m2.group(0)
        sm = _SPEC_HASH_RE_LEGACY.search(segment)
        cm = _CODE_HASH_RE_LEGACY.search(segment)
        return (sm.group(1) if sm else None, cm.group(1) if cm else None)
    return None, None


def _comment_style_for(path: Path) -> Optional[str]:
    """Determine comment style based on file extension."""
    ext = path.suffix.lower()
    # Double-slash languages
    if ext in {
        ".ts", ".tsx", ".js", ".jsx", ".java", ".kt", ".c", ".cc",
        ".cpp", ".h", ".hpp", ".go", ".rs", ".swift", ".cs", ".scala",
    }:
        return "//"
    # Hash-single
    if ext in {".py", ".sh", ".rb", ".pl", ".toml", ".yml", ".yaml", ".ini"}:
        return "#"
    # SQL style
    if ext in {".sql"}:
        return "--"
    # HTML/XML block comments
    if ext in {".html", ".htm", ".xml", ".xhtml"}:
        return "html"
    return None


def _build_tag_lines(
    spec_rel_path: str,
    spec_hash: str,
    code_hash: str,
    style: str,
    add_user_stamp: bool,
) -> str:
    """Build @specstamp tag line."""
    payload = {
        "spec": spec_hash,
        "code": code_hash,
        "spec_path": spec_rel_path,
        "date": date.today().isoformat() if add_user_stamp else None,
    }
    if payload["date"] is None:
        del payload["date"]
    data = json.dumps(payload, separators=(",", ":"))

    if style == "html":
        return f"<!-- @specstamp {data} -->"
    return f"{style} @specstamp {data}"


def insert_or_replace_tag(
    code_text: str,
    code_path: Path,
    spec_rel_path: str,
    spec_hash: str,
    add_user_stamp: bool = True,
) -> Optional[str]:
    """Insert or replace @specstamp tag in code."""
    style = _comment_style_for(code_path)
    if style is None:
        return None
    code_hash = compute_code_hash(code_text)
    tag = _build_tag_lines(spec_rel_path, spec_hash, code_hash, style, add_user_stamp)
    m = extract_tag(code_text)
    if m:
        start, end = m.span()
        return code_text[:start] + tag + code_text[end:]
    # No header found; prepend
    return tag + "\n\n" + code_text


# ============================================================================
# Spec Parsing
# ============================================================================


_TEST_LINK_RE = re.compile(r"\[@test\]\(([^)]+)\)")
_YAML_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL | re.MULTILINE)


def parse_spec_links(spec_text: str) -> List[Tuple[str, str]]:
    """Return list of (kind, raw_path) where kind is 'target' or 'test'.

    Parses:
    - 'target' entries from YAML frontmatter targets: field
    - 'test' entries from [@test](...) links in body
    """
    out: List[Tuple[str, str]] = []

    # Parse YAML frontmatter for targets
    fm_match = _YAML_FRONTMATTER_RE.match(spec_text)
    if fm_match:
        frontmatter = fm_match.group(1)
        # Simple YAML parsing for targets list
        in_targets = False
        for line in frontmatter.split('\n'):
            line = line.rstrip()
            if line.startswith('targets:'):
                in_targets = True
                continue
            if in_targets:
                if line.startswith('  - '):
                    # Extract target path
                    target_path = line[4:].strip()
                    out.append(('target', target_path))
                elif not line.startswith('  '):
                    # End of targets list
                    in_targets = False

    # Parse [@test] links from body
    for m in _TEST_LINK_RE.finditer(spec_text):
        out.append(('test', m.group(1).strip()))

    return out


# ============================================================================
# Status Detection
# ============================================================================


@dataclass
class FileStatus:
    path: Path
    status: str  # missing | up-to-date | outdated | dirty-up-to-date | dirty-outdated | unstamped
    spec_hash: Optional[str]
    code_hash: Optional[str]
    current_spec_hash: Optional[str]
    current_code_hash: Optional[str]


def determine_status_for_file(spec_hash: str, file_path: Path) -> FileStatus:
    """Determine the status of a file relative to the spec."""
    if not file_path.exists():
        return FileStatus(file_path, "missing", None, None, spec_hash, None)
    text = file_path.read_text(encoding="utf-8", errors="ignore")
    stored_spec, stored_code = extract_hashes(text)
    current_code = compute_code_hash(text)
    if stored_spec is None and stored_code is None:
        return FileStatus(file_path, "unstamped", None, None, spec_hash, current_code)
    spec_outdated = stored_spec != spec_hash
    code_dirty = stored_code != current_code
    if code_dirty and spec_outdated:
        st = "dirty-outdated"
    elif code_dirty:
        st = "dirty-up-to-date"
    elif spec_outdated:
        st = "outdated"
    else:
        st = "up-to-date"
    return FileStatus(file_path, st, stored_spec, stored_code, spec_hash, current_code)


# ============================================================================
# Discovery
# ============================================================================


def find_spec_files(target: Optional[str | os.PathLike[str]] = None) -> List[Path]:
    """Find all spec files in target path."""
    p = Path(target) if target else Path(".")
    if p.is_file() and p.name.endswith(".spec.md"):
        return [p]
    if p.is_dir():
        return [*p.rglob("*.spec.md")]
    return []


def resolve_link(spec_path: Path, raw_link: str) -> Path:
    """Resolve a link path relative to spec file."""
    return (spec_path.parent / raw_link).resolve()


# ============================================================================
# Utilities
# ============================================================================


def _rel_to(p: Path, root: Path) -> str:
    """Get relative path from root."""
    try:
        return str(p.relative_to(root))
    except Exception:
        return str(p)


def _summarize(statuses: List[str]) -> Dict[str, int]:
    """Summarize status counts."""
    summary: Dict[str, int] = {}
    for s in statuses:
        summary[s] = summary.get(s, 0) + 1
    return summary


# ============================================================================
# Commands
# ============================================================================


def cmd_status(args: argparse.Namespace) -> int:
    """Status command implementation."""
    root = Path(args.root or Path.cwd())
    specs = find_spec_files(args.path)
    if not specs:
        print("No spec files found.", file=sys.stderr)
        return 1

    all_statuses: List[str] = []
    result: Dict[str, Any] = {"root": str(root), "specs": []}
    for spec in specs:
        spec_text = spec.read_text(encoding="utf-8")
        spec_hash = compute_spec_hash(spec_text)
        links = parse_spec_links(spec_text)

        if not links:
            continue

        spec_entry: Dict[str, Any] = {
            "spec": _rel_to(spec, root),
            "spec_hash": spec_hash,
            "links": [],
        }
        if not args.format:
            print(f"Spec {_rel_to(spec, root)} (spec:{spec_hash})")
        for kind, raw in links:
            if kind not in {"target", "test"}:
                continue
            code_path = resolve_link(spec, raw)
            fs = determine_status_for_file(spec_hash, code_path)
            status = fs.status
            all_statuses.append(status)

            entry = {
                "kind": kind,
                "path": _rel_to(code_path, root),
                "status": status,
                "stored": {"spec": fs.spec_hash, "code": fs.code_hash},
                "current": {"spec": fs.current_spec_hash, "code": fs.current_code_hash},
            }
            spec_entry["links"].append(entry)
            if not args.format and not args.summary_only:
                print(f"  - {kind}: {_rel_to(code_path, root)} :: {status}")
        result["specs"].append(spec_entry)
        if not args.format and not args.summary_only:
            print()

    summary = _summarize(all_statuses)
    result["summary"] = summary
    if args.format == "json":
        if args.summary_only:
            print(json.dumps({"root": str(root), "summary": summary}, indent=2))
        else:
            print(json.dumps(result, indent=2))
    else:
        # human output
        print("Summary:")
        for k in sorted(summary.keys()):
            print(f"  {k}: {summary[k]}")

    has_errors = any(s != "up-to-date" for s in all_statuses)
    return 0 if not has_errors else 1


def cmd_stamp(args: argparse.Namespace) -> int:
    """Stamp command implementation."""
    root = Path(args.root or Path.cwd())
    spec_path = Path(args.spec)
    if not spec_path.exists():
        print(f"Spec not found: {args.spec}", file=sys.stderr)
        return 1
    spec_text = spec_path.read_text(encoding="utf-8")
    spec_hash = compute_spec_hash(spec_text)
    links = parse_spec_links(spec_text)
    if not links:
        print("No targets or [@test] links found.")
        return 0

    updated = 0
    skipped = 0
    failed = 0
    for kind, raw in links:
        if kind not in {"target", "test"}:
            continue
        code_path = resolve_link(spec_path, raw)
        rel_code = _rel_to(code_path, root)
        try:
            text = code_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            print(f"[skip] missing: {rel_code}")
            skipped += 1
            continue

        # only-dirty gate
        if hasattr(args, "only_dirty") and args.only_dirty:
            st = determine_status_for_file(spec_hash, code_path).status
            if st == "up-to-date":
                print(f"[skip] up-to-date: {rel_code}")
                skipped += 1
                continue

        stamped = insert_or_replace_tag(
            text,
            code_path,
            _rel_to(spec_path, root),
            spec_hash,
            add_user_stamp=True,
        )
        if stamped is None:
            print(f"[skip] unsupported comment style: {rel_code}")
            skipped += 1
            continue
        try:
            if hasattr(args, "dry_run") and args.dry_run:
                print(f"[dry-run] stamp -> {rel_code}")
            else:
                code_path.write_text(stamped, encoding="utf-8")
                print(f"[ok] stamped: {rel_code}")
            updated += 1
        except Exception as e:
            print(f"[err] failed to write {code_path}: {e}")
            failed += 1

    print(f"Updated {updated}, skipped {skipped}, failed {failed}")
    return 0 if failed == 0 else 1


# ============================================================================
# CLI
# ============================================================================


def build_parser() -> argparse.ArgumentParser:
    """Build argument parser."""
    p = argparse.ArgumentParser(
        prog="spec-verifier",
        description="Spec/code stamp & status CLI",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    p_status = sub.add_parser(
        "status", help="Check whether code/tests match stamped spec hashes"
    )
    p_status.add_argument(
        "path", nargs="?", help="Spec file or directory (defaults to .)"
    )
    p_status.add_argument(
        "--root", help="Project root to make paths relative to (defaults to CWD)"
    )
    p_status.add_argument("--format", choices=["json"], help="Output format")
    p_status.add_argument(
        "--summary-only", action="store_true", help="Only print summary counts"
    )
    p_status.set_defaults(func=cmd_status)

    p_stamp = sub.add_parser("stamp", help="Stamp linked code/tests for a spec")
    p_stamp.add_argument("spec", help="Path to a single .spec.md file")
    p_stamp.add_argument(
        "--root", help="Project root to make paths relative to (defaults to CWD)"
    )
    p_stamp.add_argument(
        "--only-dirty",
        action="store_true",
        help="Only rewrite files that are not up-to-date",
    )
    p_stamp.add_argument(
        "--dry-run", action="store_true", help="Preview changes without writing"
    )
    p_stamp.set_defaults(func=cmd_stamp)

    return p


def main(argv: List[str] | None = None) -> int:
    """Main entry point."""
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
```
