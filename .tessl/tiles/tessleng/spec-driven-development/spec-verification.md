# Spec Verification

Spec verification provides cryptographic proof that code and tests remain synchronized with their source specifications. When agents generate or modify code from specs, they stamp files with hash-based headers. These stamps enable automated detection of drift between specs and implementation.

## The spec-verifier Tool

This standalone Python script (stdlib only, no dependencies) provides two commands:

```bash
# Check synchronization status
./.tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.py status [path]

# Stamp files after synchronizing with spec
./.tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.py stamp <spec-file>
```

**Installation:** See [spec-verifier.tool.md](tools/spec-verifier.tool.md) for the extraction command.

## The Stamp Header

When files are stamped, a single-line header is prepended:

```typescript
// @specstamp {"spec":"9679ea57a5a1","code":"9e976145ebc0","spec_path":"specs/calculator.spec.md","date":"2025-11-12"}
```

**Fields:**
- `spec`: First 12 characters of SHA256 hash of the spec's content
- `code`: First 12 characters of SHA256 hash of the code (excluding the stamp itself)
- `spec_path`: Relative path from project root to the source spec
- `date`: ISO 8601 date when the file was stamped

The tool supports multiple comment styles and automatically detects the appropriate format based on file extension (`//`, `#`, `--`, `<!-- -->`).

## File Status States

The status command reports one of six states for each file:

| State | Meaning | Spec Hash Match | Code Hash Match |
|-------|---------|-----------------|-----------------|
| **unstamped** | File has no stamp header | N/A | N/A |
| **up-to-date** | File is synchronized | ✓ | ✓ |
| **outdated** | Spec changed since stamp | ✗ | ✓ |
| **dirty-up-to-date** | Code changed but spec hasn't | ✓ | ✗ |
| **dirty-outdated** | Both spec and code changed | ✗ | ✗ |
| **missing** | Linked file doesn't exist | N/A | N/A |

## Agent Workflow

When an agent generates or modifies code from a spec:

1. **Generate/modify code** to match spec requirements
2. **Run tests** to verify correctness
3. **Stamp files** using `spec-verifier.py stamp specs/module.spec.md`
4. **Commit** stamped files along with the spec

Example:
```bash
# After implementing requirements from calculator.spec.md
./.tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.py stamp specs/calculator.spec.md
# Output:
# [ok] stamped: src/calculator.py
# [ok] stamped: tests/test_calculator.py
# Updated 2, skipped 0, failed 0
```

## Verification in CI

CI pipelines should verify that all code remains synchronized:

```yaml
- name: Verify spec synchronization
  run: ./.tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.py status specs/
```

The command exits with code 0 if all files are up-to-date, or non-zero if any files have drifted from their specs. This prevents merging unsynchronized code.

## Status Command Options

```bash
# Check specific spec
./.tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.py status specs/calculator.spec.md

# Check all specs in directory (default: current directory)
./.tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.py status specs/

# JSON output for programmatic use
./.tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.py status specs/ --format json

# Summary only (no per-file details)
./.tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.py status specs/ --summary-only
```

## Stamp Command Options

```bash
# Stamp all files linked from a spec
./.tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.py stamp specs/module.spec.md

# Only stamp files that aren't up-to-date
./.tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.py stamp specs/module.spec.md --only-dirty

# Preview without writing
./.tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.py stamp specs/module.spec.md --dry-run

# Specify project root for relative paths
./.tessl/tiles/tessleng/spec-driven-development/tools/spec-verifier.py stamp specs/module.spec.md --root /path/to/project
```

## When to Stamp

Agents MUST stamp files in these scenarios:

- After generating code from a spec
- After modifying code to match updated spec requirements
- After creating or updating tests linked from a spec
- When reconciling drift detected by the status command

Agents should NOT stamp files:

- When only refactoring without spec changes
- When making changes unrelated to spec requirements
- For files not explicitly linked in specs via `targets:` frontmatter or `[@test]` links

## Interpreting Drift

**outdated (spec changed):**
- Spec requirements were updated
- Code needs regeneration or manual updates to align
- Agent should review spec changes and update implementation

**dirty-up-to-date (code changed):**
- Code was modified outside the spec-driven workflow
- If changes are intentional, update the spec to reflect them
- Then regenerate or manually align code, and restamp

**dirty-outdated (both changed):**
- Both spec and code were modified independently
- Requires manual reconciliation
- Determine which changes are authoritative, align the other, then restamp

## Hash Computation

Spec hash: SHA256 of the entire spec file content

Code hash: SHA256 of the code file content **excluding** the `@specstamp` header and with leading/trailing whitespace trimmed

This ensures the stamp itself doesn't affect the hash, allowing idempotent restamping.
