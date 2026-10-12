# CLAUDE.md

## Issue tracking (Plane)

Project **BAL**, workspace `ymir-bootstrap`. Use the plane MCP tools. A branch is named after its
work item (`BAL-30-glyph-atlas`).

## Look at the std first

Before writing anything heavy (a lexer, a parser, a container, an encoding, a format), look for it
in the std of the compiler you build with: `~/ymir/ymir-dev/repos/midgard/midgard/std` for
`ymirc`. It already has, among others, `syntax` (a `Lexer` with tokens, comments and rewind, a
`Tokenizer`, `Regex`, `SyntaxError`), `config` (toml, json), `conv`, `format`, `encoding`, `fs`,
`algorithm` and `concurrency`. Build on it rather than rewriting it.

## The rendering pipeline

`doc/render-graph.md` describes the render graph, the graph of a scene, its shadows, its ambient
occlusion and its post-process chain; read it before touching a pass. In short:

- **Frames on request.** The window draws a frame only when one is requested
  (`Window::requestFrame`, which every `setData` of a GPU buffer does). `nbFrames` frames are in
  flight; the slot of a frame is `getCurrentFrame` of its subpass.
- **Recordings are kept.** Each subpass keeps the recording of each frame slot and submits it
  again until it is recorded again: `Window::redrawPipeline` records every subpass of the next
  frames (needed when a recording binds something new: a buffer replaced, a draw added without
  multi-draw), `redrawPass` one subpass only. What changes each frame is data the recordings read
  (buffers written by the CPU, commands written by the GPU), not the recordings.
- **Render graph** (`VulkanPipeline`, `core/driver/graph`). A *subpass* (`DrawSubpass`,
  `ComputeSubpass`) is one command buffer submitted per frame, registered by name
  (`registerSubPass`); a *pass* is a recording in it, declared with the resources it uses
  (`declarePass (GraphPass (...))`, `importBuffer`, `createImage`, `Usage`). The graph orders the
  passes, puts the barriers between the passes of a subpass and the semaphores between subpasses.
  Graph changes go between `Window::lockFrame` and `unlockFrame`; `enablePass` switches a pass,
  `optional-> true` drops a use nothing wrote.
- **Buffers.** What the CPU writes for the GPU is an `InFlightBuffer` (a host-visible copy per
  frame, flushed at the submission of its frame), usually through `ObjectStorage` (slots of a
  fixed stride, allocated in runs, grown by replacement). What the GPU writes and another frame may
  still read gets one buffer per frame in flight (the commands and words of `InstanceBatch`).
  Geometry lives in a `GeometryPool` per shader (one device-local vertex and index buffer,
  `GeometryRange`s placed by vertex offset and first index). A replaced buffer is retired, never
  disposed in place: `Window::retire` (the device waits for every recording using it),
  `VulkanSubpass::retire` (only that subpass uses it), `retireAfterFrame` (no recording uses it).
- **The draws of a scene.** `ShaderNodeScene` holds a `ShaderGroup` per raster shader config
  (the shader of the material). A group holds the `GeometryPool`, the objects (`ObjectStorage` of
  `OBJECT_STRIDE`: world, cross-fade, material word, levels, world box, previous world, laid out
  as the `Object` struct of the shaders), the clusters, a `MotionTracker` (previous worlds for the
  motion vectors of TAA, advanced at each frame submit by `FrameMotion`), the `ShadowCasters`, and
  a `MaterialBatch` per material batch key (descriptor set + `InstanceBatch` drawn by one
  multi-draw). A `VisualInstance3D` entering the scene gets a `SceneDraws` (`Scene::registerDraws`):
  its slot, its shared geometry, its draws (`InstanceDraw`, the word of an instance being
  `slot << 2 | role`).
- **A frame of a scene.** The skin subpass moves the vertices of the skinned instances first (a
  `[skin]` variant of the shader, see `doc/render-graph.md`); `onDeferredPrepare` lays the draws
  out (`ShaderGroup::layout`); the deferred subpass records the cull pass (`cull.comp`: objects,
  then clusters, writing indirect commands), the g-buffer (a depth prepass then the shader), the depth pyramid, the late cull and
  late g-buffer; the shadow maps are subpasses of their own drawing the casters with the shadow
  pipeline of each shader (positions only); the composition and the post chain read the g-buffer.
  CPU culling (`VisibilityScene`, a BVH of the world boxes) is the fallback and the reference of
  the GPU one, and culls the shadow casters.
- **Shaders** are toml configs (`res/shaders/base/...`, `DefaultShaders`) naming SPIR-V files,
  the vertex entries (`VertexEntry`, interleaved floats in enum order), the descriptor sets and the
  push constants; `res/shaders/compile.sh` (glslc, the `shader_compile` command of `gyllir.toml`)
  builds the `.spv` next to their sources, ignored by git. A raster shader describes its skinned
  variant in a `[skin]` table. A shader struct mirrored on the CPU (`Object`, `Cluster`,
  `SkinWeightSlot`, push constants) changes on both sides at once.
- **Locks.** The rendering thread takes the pipeline lock then the scene lock; never redraw the
  pipeline while holding the scene lock (see `Scene::registerNode`).

## Commit policy

Taken from balder-dev (`../../CLAUDE.md`), itself taken from bootstrap:

- split work in logical commits
- a commit is one change: a fix, a refactor, a feature, or the tests of one of them. A change
  spanning several modules (a protocol and the classes ported to it, a declaration and the code
  using it for the same purpose) is one commit touching them all; two unrelated changes to the
  same module are two commits
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
