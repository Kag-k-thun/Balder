# The editor

The editor of Balder lives in `editor/`, beside the library, as the start of a game engine editor: the outline of the
scene on the left, its viewport in the middle, the inspector of the node selected on the right, under a menu bar and
above a status bar.

```
gyllir build editor
./balder-editor                          # a new scene, editor/scenes/new.scene
./balder-editor --scene path/to/a.scene  # a scene file
```

| Directory | Holds |
|---|---|
| `editor/src` | the sources, the target `editor` of `gyllir.toml` (built as `balder-editor`) |
| `editor/ui` | the `.gui` and the `.style` files of its interface |
| `editor/scenes` | `new.scene`, the scene a new scene starts from |
| `editor/editor.toml` | the configuration of its window |

## Using it

- **Viewport**: a click selects the node under the cursor (Ctrl toggles it), the middle button turns the camera around
  the point it looks at, Shift and the middle button slide it, the wheel brings it closer. Once clicked, the viewport
  takes the keys W, E and R (translate, rotate, scale, the key of the mode in use switching between the world and the
  local axes), Delete, Ctrl+D (duplicate) and F (look at the selection, or at the whole scene).
- **Flight**: holding the right button flies the camera, the mouse captured turning it where it stands, W, A, S and D
  moving it forward, to the left, back and to the right, E and Q up and down, Shift four times faster, the wheel
  changing its speed. The keys are read by their place on the keyboard (Z, Q, S and D on an AZERTY one), and taken by
  the viewport alone while it flies. The speed is a share of the distance to the point the camera looks at, the one F
  frames, so that a room and a terrain are crossed alike, and each scene opened keeps its own while the editor runs
  (`CameraFlight`, `balder::scene::node::node3D::camera::flight`); the motion eases in and out. Releasing the button
  turns the camera again around the point in front of it, and F frames the selection from where the flight left it.
- **Icons**: the nodes without geometry, the lights (a sun, a bulb or a lamp, by their type), the cameras, the empties,
  the markers (by their purpose), the paths, their points (smaller) and the volumes, are drawn as icons over the
  viewport, a click on an icon selecting its node before the meshes behind it; a selected icon is orange, and the gizmo
  moves its node as any other. A selected light shows its shape (arrows along a direction light, the sphere of the
  range of a point light, the cones of a spot light), a selected camera its frustum. The wireframe of a volume and the
  curve of a path are drawn at all times, in blue, in orange once selected. The colliders of the bodies are drawn at
  all times too (`debug_view::drawCollider`), in the colours of the debug view of the physics: grey a static body, blue
  a kinematic one or a character, orange a dynamic one, yellow a trigger, fainter until the body is selected; a body
  without a mesh under it, and a character, have an icon of their own. *View → Hide the icons* hides them all, the
  wireframes, the curves and the colliders with them, and shows them again.
- **Nodes without a mesh**: an *empty* (`Empty3D`) only places the nodes under it. A *marker* (`Marker3D`) is an empty
  with a purpose (a spawn point, a waypoint, a socket, or none given) and tags, the game looking it up by its name
  (`Marker3D::find`), its tags (`tagged`) or its purpose (`ofPurpose`) under a node. A *path* (`Path3D`) is a curve,
  Catmull-Rom or Bézier, open or closed, through its points, the `PathPoint3D` under it in their order, sampled by the
  distance along it (`curve`, `pointAt`, `directionAt`, `Curve` of `balder::math::curve`): its points are nodes, moved by
  the gizmo, removed, copied and reordered in the outline as any other; *Add → Point of the path* inserts one after the
  point selected (halfway to the next one) or at the end of the path selected; a point of a Bézier path leaves along its
  X axis, as far as its scale along X, so the gizmo turns and stretches its handles. A *volume* (`Volume3D`) is a box, a
  sphere or a capsule standing along Y, a part of the compound of the body over it, or turned into a trigger (see the
  physics bodies below):
  selected alone, a white square on each face drags the face along its normal, the opposite face staying where it is (a
  sphere and the sides of a capsule growing about their centre).
- **Physics bodies**: a *body* (`PhysicsBody3D`) is the parent of what it moves, the meshes under it drawing it: its
  collider is a box, a sphere, a capsule, a cylinder or a plane of its sizes, the hulls or the triangles of the model
  under it, or the compound of the volumes under it, each placed where it is (`PhysicsBody3D::reshape`, the shape
  described by a `BodyShape`). *Add → Physics → Physics body around the selection* puts each node selected under a new
  body at its place, as one change: the body stands at the centre of a shape fitted to the node (the box of a cube or of
  a model, the sphere of a sphere, the plane of a plane, a unit box for the other nodes), the node keeping its place in
  the world under it; a volume is turned into a static trigger of its shape, of its name and of its transform, the nodes
  under it going under the body (`WrapCommand`). A *character* (`CharacterBody3D`) is a kinematic capsule. Selected
  alone, a body of a box, a sphere, a capsule or a cylinder has the white squares of a volume on the faces of its
  collider. The editor never steps the physics (`Scene::simulates`, false in an `EditableScene`): the bodies are in the
  world of the scene, hit by the picking and the queries, but a dynamic body stays where it is placed; the simulation is
  the play mode (BAL-134). After each change, a body of a compound takes the volumes under it again.
- **Outline**: the nodes of the scene in their order, each after the icon of its kind (`editor/ui/icons`, coloured by
  family: the meshes blue, the lights yellow, the markers green, the paths cyan, the volumes purple, the bodies and the
  characters orange),
  a click selecting a node, Ctrl and Shift selecting several, Enter or a double click looking at it. It follows the selection of the viewport. The rows selected are dragged: onto
  a row, their nodes go under its node, after its children; between two rows, to that place, under the parent of the
  line, which tells the level; below the rows, to the end of the first level. Each node keeps its place in the world,
  its transform computed again in the space of its new parent, or keeps its transform with Alt held at the drop. A node
  goes neither under itself nor under a node under it, nor in or out of a model (its meshes come from its file), and a
  node named as a child of its new parent takes a free name (`cube_2`).
- **Inspector**: the name of the node selected last, then the panel of its kind, refreshed as the gizmo moves it. An
  object (a mesh, a model, an empty, a marker, a path, a point, a volume) shows its position, its rotation (in degrees)
  and its scale, then a marker its purpose and its tags (separated by spaces, applied when Enter is pressed), a path
  its curve and whether it is closed, a volume its shape and its size (the sides of a box, the radius of a sphere, the
  radius and the height of a capsule, its caps included), a body its motion (static, kinematic, dynamic), its shape and
  its sizes (the model of a hull or a mesh told under them), its friction and its restitution, the mass, the damping,
  the rolling and spinning frictions, the sleep and the bullet of a dynamic body, whether it is a trigger, then the
  layers it is in and the layers it touches as two fields of 32 boxes, a character its radius, its height and its
  layers only; a light its position,
  its direction, its colour, its intensity, its range, the angles of its cone and whether it casts shadows, the fields
  its type does not use left out (no position for a direction light, no direction for a point light, a cone for a spot
  light only). A name is applied when Enter is pressed; a field changed gives its value to every node selected of the
  kind of the panel, each keeping its other values. One direction light casts shadows at a time. Each panel is a
  `Collapsible` the user folds by its header (a body in four: *Physics body*, *Material*, *Dynamics* and *Collision
  layers*, the last one folded at first), and the inspector scrolls over the panels taller than the window instead of
  growing the editor.
- **Convex hulls**: a model has a panel of the convex decomposition saved next to its file (`teapot.obj` giving
  `teapot.hulls`, see the convex decomposition of `doc/physics.md`), the shape of a body of the hulls of the model: the
  hulls and their vertices, the settings they were made with, drawn over the model, each in its colour, in the `hulls`
  layer of the debug lines of the scene (*Show the hulls* hides them). The editor does not decompose the models: the
  export of a project will (BAL-138), the `decompose` tool meanwhile; a model without hulls saved gives a body the hull
  of each of its meshes (`SolidObjectModel::hulls`) (`HullsPanel`).
- **Menus**: *Scene* opens a new scene or a scene file and saves the scene (Ctrl+S) or saves it in another file
  (Ctrl+Shift+S), *Add* adds a cube, a sphere, a plane, a model read from a
  file, an empty, a marker (a spawn point, a waypoint, a socket), a path of three points, a volume, a body (a static unit
  box), a character or a light where the centre of the viewport meets a surface (or at the point the camera looks at),
  a point to the path selected, or a body around each node selected, its kinds grouped in submenus opening as they are
  hovered (*Mesh*, *Light*, *Marker*, *Path*, *Volume*, *Physics*), and Ctrl+E opening it under the cursor,
  *Edit* undoes and redoes the changes, its items naming them (`Undo: Deleted cube`), then duplicates, deletes and
  frames the selection, and *View* hides or shows the icons.
- **Undo**: Ctrl+Z undoes the last change, Ctrl+Shift+Z or Ctrl+Y redoes it, wherever the focus is. Every change of the
  scene is undone, the nodes selected before it being selected again; the steps of one field of the inspector (its
  arrows clicked, its keys held, its wheel turned) are undone as one change. Opening a scene starts the history again.

- **Saving**: a change marks the scene as unsaved, by a `*` in the title of the window and on the right of the status
  bar, which tells the file of the scene, until it is saved; undoing the changes made since the last save marks it
  saved again. A new scene has no file yet: its first save asks for one,
  given the extension `.scene` when it has none. New, Open and Quit (from the menu or by closing the window) ask
  whether to save the changes first, to discard them, or to do nothing.

The nodes named `__…__` belong to the editor (its camera, the gizmo, the icons): they are neither shown, nor removed with the
scene, nor saved.

## Commands

Every change of the scene is a command (`EditCommand`) run by `SceneEditor::execute`, which applies it, keeps it in
its history and emits `edited`; the outline, the inspector and the status bar follow the changes from there. A drag of
the gizmo moves the nodes while it lasts and is recorded as a `TransformCommand` once released.

Each command reverts the change it made (`revert`), on the scene as it left it, and makes it again when applied anew,
on the scene as it found it. `SceneEditor::undo` reverts the last command applied and `redo` applies again the last one
undone, both emitting `edited` with it as `execute` does, so nothing else follows them in a way of its own. A command
executed after commands undone drops them; an open starts the history again (`startsHistory`), and is not undone.

- **Nodes are kept, not rebuilt.** A removal keeps the nodes it detached and their parents, an addition, a copy and an
  open the nodes they built: undone or redone, they detach the nodes (`dispose`) or attach them again
  (`Node::attach`, the nodes under them entering the scene after them) at the place they had among their siblings. The
  other commands of the history keep naming the same nodes. A move keeps the nodes in the scene (`Node::moveUnder`),
  and undone moves them back, the last one first, each to its parent, its place, its name and its transform. The meshes of an `EditableScene` keep
  their vertices once uploaded (`Scene.keepsVertices`), to enter it again.
- **The selection** a command found is selected again when it is reverted.
- **Merging.** A command executed right after another one may merge into it (`merge`), the two being undone as one: the
  inspector names the field a change was typed in, and the changes of the same nodes in the same field merge
  (`TransformEdit::extendedTo`). An undo, a redo or a save ends the merging.
- **Unsaved changes.** The editor keeps the position of its history at the last save (`markSaved`): the scene has
  unsaved changes while the history is elsewhere, and for good once the commands undone past that save are dropped.

| Command | Change | Reverted by |
|---|---|---|
| `TransformCommand` | the transforms of nodes, typed in the inspector or dragged with the gizmo | the transforms before, merging the steps of one field |
| `LightCommand` | the settings of lights (colour, intensity, direction, range, cone, shadows), typed in the inspector | the settings before, merging the steps of one field |
| `MarkerCommand` | the purpose or the tags of markers, chosen in the inspector | the purposes and the tags before |
| `PathCommand` | the curve of paths or whether they are closed, chosen in the inspector | the curves and the closings before |
| `VolumeCommand` | the shapes of volumes, typed in the inspector or dragged by a face with the gizmo, the centre following a face moved on its own; the faces of the collider of a body dragged | the shapes and the transforms before, merging the steps of one field |
| `BodyCommand` | the settings and the shapes of bodies, typed in the inspector, the colliders built once (a model read, the volumes of a compound gathered) | the settings, the shapes and the colliders before, merging the steps of one field |
| `RenameCommand` | the name of a node, refused when a sibling has it | the name before |
| `AddCommand` | a node built from its description, at a place among the children of its parent (a point inserted in a path), selected | detaching the node |
| `RemoveCommand` | nodes and the nodes under them | attaching them again under their parents, at their places |
| `ReparentCommand` | nodes and the nodes under them moved under another parent or among their siblings, dropped in the outline | moving them back to their parents, places, names and transforms |
| `WrapCommand` | nodes put under new bodies at their places, of shapes fitted to them, a volume turned into a trigger, the bodies selected | the nodes moved back to their parents, places and transforms, the bodies detached |
| `DuplicateCommand` | copies of nodes beside them, sharing the geometry of their meshes, selected | detaching the copies |
| `OpenCommand` | the nodes of the scene replaced by those of a scene file | attaching the nodes replaced again |

## Scene files

A scene file (`.scene`) is read by `SceneDescription` (`balder::scene::description`), which also writes it:
`SceneDescription::fromFile (path).build (root)` creates its nodes under a node, the root of a `Scene`, and
`SceneDescription (root).save (path)` writes the nodes under it, the nodes named `__…__` left out. The file opens with
the version of its format, declares the files its models use, then holds a flat block per node:

```
// a table and its light
scene 1;

asset table model "res:/models/table.glb";

node #87b7e0df-348c-4ee2-b5e4-a54c540e02bf light "sun" {
    direction: -0.3 -1 -0.2;
}

node #030e69b7-ba92-4e55-bd67-5381a2351926 empty "props" {
    position: 0 0 -2;
}

node #75e8622f-285e-414a-8e93-d82ecee1a614 cube "crate" {
    parent: #030e69b7-ba92-4e55-bd67-5381a2351926;
    rotation: 0 30 0;
    color: 0.8 0.3 0.2;
    roughness: 0.5;
}

node #0c203f1a-b872-4e76-b3e0-0c7c95e00c74 model "table" {
    parent: #030e69b7-ba92-4e55-bd67-5381a2351926;
    file: @table;
}
```

A node is `node #<id> <kind> "<name>" { … }`, the kind being `empty`, `model`, `cube`, `sphere`, `plane`, `light`,
`marker`, `path`, `path-point`, `volume`, `body` or `character`, the points of a path being the `path-point` nodes
under it, in their order, the parts of a compound body the `volume` nodes under it.
Its id (`Node3D.guid`) is a uuid it keeps from one save to the next, and the nodes under another name it as their
`parent`, so the file stays flat however deep the tree is: moving a node under another parent changes one line, and a
node is named by its id rather than by its path. The blocks may come in any order; among siblings, the order of the file
is the order of the nodes (`Node::getChildrenInOrder`), which the outline shows and changes. Comments are those of the `.gui` files.

| Entry | Nodes | Value |
|---|---|---|
| `parent` | every node | the id of the node it is under, `#<uuid>`, none under the root |
| `position`, `rotation`, `scale` | every node | three numbers, in the space of the parent, the rotation in degrees |
| `file`, `lods` | model | the asset of the model file (`@<key>`, required), whether its levels of detail are built (`true`) |
| `color`, `roughness`, `metallic` | cube, sphere, plane | the base colour and the material |
| `light`, `color`, `intensity`, `direction`, `range`, `inner-angle`, `outer-angle`, `shadows` | light | `direction`, `point` or `spot`, then as `Light` has them |
| `purpose`, `tags` | marker | `generic`, `spawn`, `waypoint` or `socket`; strings (`tags: "enemy" "boss";`) |
| `curve`, `closed` | path | `catmull-rom` or `bezier`; whether the curve goes back to its first point (`false`) |
| `shape`, `size`, `radius`, `height` | volume | `box`, `sphere` or `capsule`; the sides of a box, the radius of a sphere or a capsule, the height of a capsule, its caps included (only the entries of its shape are written) |
| `shape`, `size`, `radius`, `height`, `model` | body | `box`, `sphere`, `capsule`, `cylinder`, `plane`, `hull`, `mesh` or `compound`; the sizes of its shape as a volume has them, the height of a cylinder too; the asset of the model of a hull or a mesh (`@<key>`, required by them, refused by the others) |
| `motion`, `mass`, `friction`, `rolling-friction`, `spinning-friction`, `restitution`, `linear-damping`, `angular-damping`, `can-sleep`, `bullet`, `trigger` | body | `static`, `kinematic` or `dynamic`, then as `BodySettings` has them |
| `layer`, `mask` | body, character | the numbers of the layers, 0 to 31 (`layer: 0 2;`), or `none` |
| `radius`, `height`, `up`, `slope-limit`, `step-offset`, `snap-distance`, `skin`, `coyote-time`, `push-mass`, `max-slides`, `depenetrations` | character | its capsule (0.4 and 1.8 by default), then as `CharacterSettings` has them, the slope limit in degrees |

An asset is `asset <key> model "<path>";`, the path a `res:/…` or an absolute one, named by the `file` of a model and the
`model` of a body. The writer writes the same file for
the same nodes, so a scene diffs well under version control: the assets in the order of their paths, keyed by the name
of their file; the nodes parents first, siblings in their order; the entries of a node in the order of
the table, those holding their default left out (a body writes the entries of its shape only); each number the shortest decimal reading back the same float. A scene
started from a template (`editor/scenes/new.scene`) gives its nodes ids of their own (`SceneDescription.withoutIds`).

The file is the source of a scene, the one edited and versioned; the game will load a binary file cooked from it
(BAL-187).

A cube, a sphere and a plane stand in the unit box of the models, as a model loaded from a file does: x and z in
[-0.5, 0.5], y in [0, 1]. Their scale is their size, and their position the centre of their base. An entry its kind
does not read, an entry given twice, a value of the wrong type, two nodes of one id, a parent or an asset the file does
not declare, or a node under itself is an error telling the file, the line and the column, and why.
