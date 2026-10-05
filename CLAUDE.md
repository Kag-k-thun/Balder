# CLAUDE.md

## Issue tracking (Plane)

Project **BAL**, workspace `ymir-bootstrap`. Use the plane MCP tools. A branch is named after its
work item (`BAL-30-glyph-atlas`).

## Commit policy

Taken from balder-dev (`../../CLAUDE.md`), itself taken from bootstrap:

- split work in logical commits
- a commit is one piece: one module, or one behavior. A feature spread over several modules is
  one commit per module, never a single commit adding them all
- order the commits like the dependencies they touch: chore, then declarations, then what uses
  them, then tests, then docs. Across repositories, a binding is committed before the Balder
  code that uses it
- a commit never uses what a later one declares, even though compilation within the branch is
  not required: what is shared comes before what uses it, and a dispatch comes after everything
  it dispatches to
- rewrite history when a new commit modifies something that was introduced by another commit of
  the same branch
- there's no need for tests to pass, and code to compile between commits as long as the last
  commit of the branch compiles and tests succeed
- don't add co-authors
- commit messages are just one line long

### Commit messages

`[BAL-XXX] kind: message`, or with a scope naming the area the commit touches,
`[BAL-XXX][scope] kind: message`:

```
[BAL-30] chore: ignore the local gyllir override and the test outputs
[BAL-30][alloc] feat: add SegmentList, a best-fit allocator of one dimensional ranges
[BAL-30][alloc] refactor: make FreeList delegate its segments to SegmentList
[BAL-30][font] test: cover GlyphCache placement and the eviction guard
```

Kinds: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`. A commit spanning the whole
repository (a chore) takes no scope.

### Pull requests

Titles read `[BAL-XXX][kind] Title`, `[kind]` being optional and defaulting to a feature. The
Plane sync workflow takes the work item from that tag.

### Before committing

Run `~/ymir/ymir-dev/repos/bootstrap/tools/yr-optimize-imports.sh` from the repository root: it
rewrites the `use` block of every `.yr` file under `src/` and `test/` the branch changed into its
canonical form (nested groups merged, duplicates dropped, roots sorted with local roots first,
then `std`, then external `::` roots). It is idempotent and leaves tidy files untouched.
**Rebuild after it: dropping or merging a `use` can break compilation**, so it runs before the
final `gyllir test`.

Never commit a `gyllir.toml` pointing at a local checkout. Local links and the compiler override
go in `gyllir.toml.override`, which is listed in `.gitignore` and never committed:

```toml
compiler = "ymirc"

[dependencies]
yharfbuzz = {version = "*", url = {local = "/home/emile/ymir/3D/balder-dev/repos/yharfbuzz"}}
```

`uv run start` (balder-dev) still links by rewriting the tracked `gyllir.toml` (lines ending in
`# balder-dev link`); run `uv run unlink` before committing one.
