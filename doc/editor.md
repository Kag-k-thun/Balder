# The editor

The editor of Balder lives in `editor/`, beside the library, as the start of a game engine editor. It edits a
project: it opens on the project manager, then the editor window shows the outline of the scene on the left, its
viewport in the middle and the inspector of the node selected on the right, under a menu bar and above a status bar.
The window reads as one: no space between its panels but a seam of a pixel (`$edge`), the space inside the rows and
never around them, bars and rows of 22 to 28 pixels (the menu bar 28, its items 24 with their shortcut right-aligned
and muted, the rows of the outline 22, the headers of the sections of the inspector 24, the status bar 22), square
panels and corners of 3 pixels for the fields and the buttons, 4 for the popups (`editor/ui/theme.style`).

```
gyllir build editor
target/bin/balder-editor                                       # the project manager
target/bin/balder-editor --project path/to/game                # the editor, on a project
target/bin/balder-editor --project path/to/game --scene res:/scenes/level.scene
target/bin/balder-editor --engine-dir path/to/balder           # run from elsewhere than the engine's directory
```

| Directory | Holds |
|---|---|
| `editor/src` | the sources, the library `balder_editor` (the target `balder-editor` of `gyllir.toml`, built as `libBalderEditor.a`), its entry `runEditor` |
| `editor/bin` | the `main` of the editor, the target `editor` (built as `balder-editor`, `exports = true`) |
| `editor/ui` | the `.gui` and the `.style` files of its interface |
| `editor/templates` | the templates a new project starts from (`empty`) |
| `editor/editor.toml`, `editor/manager.toml` | the configurations of the window of the editor and of the project manager |

## Projects

A project is a game made with Balder, a directory as Godot or Unreal have one:

```
my_game/
    project.toml             # its name, its scenes by name, the scene the game starts with
    gyllir.toml              # the library of the game, a shared one, depending on Balder
    gyllir.toml.override     # the link of Balder to the engine of the editor, local, ignored by git
    src/my_game.yr           # the root module of the library: its actor classes
    res/scenes/main.scene    # its files, named res:/… (scenes, models, textures...)
    .gitignore
```

```
# The project of a game made with Balder: its name, its scenes by name and the scene the game starts with
name = "My game"
main-scene = "main"

[scenes]
main = "res:/scenes/main.scene"
```

The scenes are named, the game loading a scene by its name and the export knowing the scenes it ships. A project has
no `main`: its library holds what the game adds to the engine, and the export (BAL-138) is to build the executable
around it, a runtime of Balder loading the library and starting the main scene, as Unreal's launcher module runs the
module of a game.

- **The library of the game.** The `gyllir.toml` of a project declares the library of the game as a shared target
  (`type = "shared"`, `libmy_game.so` in `target/lib`), its actor classes (see `doc/actors.md`), compiled against
  Balder without linking it (`host-provided = ["Balder"]`) and by the compiler Balder pins (`[compiler]`, filled from
  the engine's `gyllir.toml` at the creation of the project): the editor holds Balder and the std, linked with its
  symbols exported (`exports = true`), so that the library runs on the runtime of the editor. The editor loads it
  (`GameLibrary`, `etc::dl`'s `SharedLibrary`), the `#[actor]` tags of its classes registering them as it opens; one
  library is loaded at a time, so that two projects never share the registry of the node classes. A library that
  cannot be loaded (a missing symbol, a library built against another Balder) is told in the status bar, the actors of
  the scenes kept as unknown ones. A project made with the template of BAL-128 (an `editor` target linking the library
  of the game) opens, its `editor` target ignored, the status bar telling how to make its library a shared one.
- **Paths.** `res:/` names the files of the project (`setProjectPath`), `engine:/` and `shaders:/` the files of the
  engine (`setEnginePath`): its shaders, the files of its dialogs, its fonts, its images and its tables of colours. The
  two are the same directory unless one moves, the examples and the tests running from the engine's directory; the
  fonts of the project are registered before the engine's (`FontRegistry::ENGINE_FONT_DIR`). The editor moves the
  project path to the project it opens, its own files staying under the engine's directory (`--engine-dir`). A scene or
  a model chosen under the `res/` of the project is written `res:/…` (`qualifiedPath`), so that the project moves with
  its files.
- **The project manager** (`ProjectManagerActivity`) is the first window: the projects opened last, their names, their
  folders and when they were opened, the one opened last first (a project whose `project.toml` is gone listed as
  missing). A double click, Enter or *Open* opens one in the editor window, the manager closing. *New project…* asks
  for a name and a location, and creates the project in a new folder of the location named after it (`My Game` in
  `my_game`) from the template `editor/templates/empty` (`ProjectTemplate`: `{{name}}`, `{{package}}` and
  `{{compiler}}` filled in the names and the contents of its files, a name starting with `_` starting with a dot, the
  scenes given ids of their own); *Import…* opens the folder of a project; *Remove from the list* forgets one, its
  files staying. The list is kept in `$XDG_CONFIG_HOME/balder/projects.toml` (`~/.config/balder/projects.toml`,
  `RecentProjects`), with the scene of each project edited last and the location of the last project created.
- **The editor** opens on the scene of the project edited last, or on its main scene, or on a new scene. A library of
  the game newer than every source it is built from (the `.yr` files and the `gyllir.toml` of the project and of its
  dependencies, Balder included) is loaded first; otherwise the editor builds it in the background (`GameBuild`,
  `gyllir build <target> -v` in the folder of the project, its output in `.target/game-build.log`), the status bar
  telling how far (`BuildProgress`: the step, the target compiled and its modules, the steps of the last build, in
  `.target/game-build.steps`, telling how many to expect), then loads it, the scene built again with its classes.
  **Compile**, the button on the right of the menu bar (or Ctrl+R), builds it again and reloads it, a change of the
  code of an actor taken without leaving the editor: the scene is described as its file would save it, its nodes
  dropped with the history naming them, the library closed (its classes unregistered, `unregisterActorClass`, the
  members and the schemas read from the classes dropped) and opened again, then the scene is built again from its
  description, read leniently (`SceneDescription (content, lenient-> true)`: an entry, a signal or a connection its
  class no longer declares dropped and logged, an actor of a class gone kept as an unknown one); the history starts
  again, the unsaved changes staying unsaved. A build that fails tells its first error in the status bar and in a
  dialog showing it as the compiler wrote it, its place and its code (`BuildErrorDialog`), with buttons opening, in the
  application of the desktop (`xdg-open`), the file of all the errors of the build, plain
  (`.target/game-build-errors.txt`), and its whole output; the library loaded stays. A scene saved
  under `res/` joins the scenes of the project, named after its file (`level_2` when `level` is taken), the first one
  becoming its main scene; a scene saved elsewhere is not one of its scenes. The title tells the scene and the project.
  *Scene → Back to the project manager* closes the editor for the manager, asking first about the unsaved changes, and
  closes the library of the game (not while it is being built).

## Using it

- **Grid**: a grid in metres lies on the ground (y = 0), a unit of the world being a metre: a line every step, every
  tenth line stronger, the X axis red and the Z axis blue. The step follows the height of the eye, a power of ten
  (10 cm, 1 m, 10 m...), told on the right of the status bar (`Grid: 1 m`); the grid is centred under the eye, fades
  away from it, and is hidden by the nodes standing over it (`GroundGrid`, drawn in the debug lines of the scene).
  *View → Hide the grid* hides it. Where nothing is drawn, a scene without an environment shows a grey.
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
- **Cameras**: a scene holds any number of cameras (`PerspectiveCamera`, `OrthoCamera`), one of them active, the one
  the game draws the scene through (`Scene::getActiveCamera`, `setActiveCamera`): the first camera entering the scene,
  and when the active one leaves, the first of the others. The editor draws the viewport through its own camera
  (`Scene::setViewCamera`), never saved, the active camera of the scene only ringed in green among the icons. A camera
  looks along the -Z of its node, its top along Y, and follows its parents: a camera under a rig moves with it.
  *View → Look through the camera selected* draws the viewport through a camera of the scene instead: the middle
  button, the wheel, the flight and F then move that camera, each move recorded as a change of its transform, undone as
  any other, until *View → Look through the editor camera*, or until the camera leaves the scene (removed, or replaced
  by a camera of the other projection), the editor camera taking back the eye it had.
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
  goes neither under itself nor under a node under it (the meshes drawing the parts of a mesh node are its own, and
  hidden: a node dropped on a mesh node goes under it as under any other), and a
  node named as a child of its new parent takes a free name (`cube_2`).
- **Inspector**: the name of the node selected last, then a section for each group of the properties its class
  declares (see the property schemas below), refreshed as the gizmo moves it: *Transform* for every node (its position,
  its rotation in degrees, its scale), then *Mesh* (the mesh drawn and the material of each part, told by their names,
  `own` for a part drawn with the material of its mesh, whether the levels of detail of a model file are built, whether
  it casts shadows), *Light* (its type, its colour, its intensity,
  its direction, its range for a point or a spot light, the angles of its cone for a spot light, its shadows),
  *Marker* (its purpose, its tags separated by spaces, applied when Enter is pressed), *Path* (its curve, whether it is
  closed), *Volume* (its shape and the sizes it uses: the sides of a box, the radius of a sphere, the radius and the
  height of a capsule, its caps included), *Physics body* (its shape and the sizes it uses, the model of a hull or a
  mesh told, its motion, whether it is a trigger; the radius and the height of a character), *Physics material* (its
  friction and its restitution), *Dynamics* (the mass, the damping, the rolling and spinning frictions, the sleep and
  the bullet of a dynamic body), *Character* (how a character moves, its slope limit in degrees), *Collision layers*
  (the layers it is in and the layers it touches, 32 boxes each, folded at first) and *Camera* (its projection, its
  field of view in degrees or the height of its view, its planes, and whether it is the active camera of the scene, a
  box checked to make it active; the scene keeps one active camera while it has one, unchecking it does nothing). A
  row is shown when every node selected has its property and the property applies to the node selected last, so that
  several nodes of different classes show the properties they share; a field changed gives its value to every node
  selected, a component of a vector or a layer changing that component or that layer of each, its others kept. The
  properties a node takes at its creation only are told, not changed, but the projection of a camera (replacing it),
  and the shape of a body and the capsule of a character (their colliders built). A name is applied when Enter is
  pressed. One direction light casts shadows at a time. Each section is a `Collapsible` the user folds by its header,
  and the inspector scrolls over the sections taller than the window instead of growing the editor.
- **Convex hulls**: a mesh node of a model file has a panel of the convex decomposition saved next to its file (`teapot.obj` giving
  `teapot.hulls`, see the convex decomposition of `doc/physics.md`), the shape of a body of the hulls of the model: the
  hulls and their vertices, the settings they were made with, drawn over the model, each in its colour, in the `hulls`
  layer of the debug lines of the scene (*Show the hulls* hides them). The editor does not decompose the models: the
  export of a project will (BAL-138), the `decompose` tool meanwhile; a model without hulls saved gives a body the hull
  of each of its parts (`MeshAsset.hulls`) (`HullsPanel`).
- **Connections**: an actor has a panel of the connections of its signals to the slots of the actors of the scene
  (`ConnectionsPanel`, `Node3D.connections`), which the game makes as it builds the scene (`connectActors`), the editor
  only keeping them: a table of the connections (the signal, the actor receiving it, by its path, and its slot, an actor
  no longer in the scene told missing), *Remove the connection* removing the one picked in the table, and *Connect*
  making the one chosen below it: a signal of the actor (its payload told), an actor of the scene having a slot taking
  that payload (the actor itself among them), and one of those slots. A connection made twice is refused.
- **Menus**: *Scene* opens a new scene or a scene file, saves the scene (Ctrl+S) or saves it in another file
  (Ctrl+Shift+S), and goes back to the project manager, *Add* adds a cube, a sphere, a plane (mesh nodes of the
  built-in meshes, drawn with the default material), a model read from a file (a mesh node of its mesh), an empty, a marker (a spawn point, a waypoint, a socket), a path of three points, a volume, a body (a static unit
  box), a character or a light where the centre of the viewport meets a surface (or at the point the camera looks at),
  a camera where the eye of the viewport stands, looking where it looks, a point to the path selected, or a body around
  each node selected, its kinds grouped in submenus opening as they are hovered (*Mesh*, *Light*, *Marker*, *Path*,
  *Volume*, *Physics*, *Camera*), and Ctrl+E opening it under the cursor,
  then a submenu per category of the actor classes of the game (`#[actor (category-> "Gameplay")]`, *Actors* by
  default), listing its classes by their labels, each adding an actor of its properties' defaults where a cube goes
  (none in Balder's own editor),
  *Edit* undoes and redoes the changes, its items naming them (`Undo: Deleted cube`), then duplicates, deletes and
  frames the selection, and *View* hides or shows the icons and the grid, and looks through the camera selected; an
  item writes its shortcut on its right (`shortcut:` of a `PushButton`).
- **Undo**: Ctrl+Z undoes the last change, Ctrl+Shift+Z or Ctrl+Y redoes it, wherever the focus is. Every change of the
  scene is undone, the nodes selected before it being selected again; the steps of one field of the inspector (its
  arrows clicked, its keys held, its wheel turned) are undone as one change. Opening a scene starts the history again.

- **Saving**: a change marks the scene as unsaved, by a `*` in the title of the window and on the right of the status
  bar, which tells the file of the scene, until it is saved; undoing the changes made since the last save marks it
  saved again. A new scene starts blank, and has no file yet: its first save asks for one, in the `res/scenes` of the
  project, given the extension `.scene` when it has none. New, Open, Back to the project manager and Quit (from the menu or by
  closing the window) ask whether to save the changes first, to discard them, or to do nothing. The file dialogs create
  a folder (*New folder*) in the folder they show.

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
  (`PropertyEdit::extendedTo`). An undo, a redo or a save ends the merging.
- **Unsaved changes.** The editor keeps the position of its history at the last save (`markSaved`): the scene has
  unsaved changes while the history is elsewhere, and for good once the commands undone past that save are dropped.

| Command | Change | Reverted by |
|---|---|---|
| `PropertyCommand` | a property of nodes (see the property schemas below), typed in the inspector, every node checked first, a value one of them refuses changing none (a light along a null direction, a far plane before the near one) | the values before, merging the steps of one field |
| `TransformCommand` | the transforms of nodes dragged with the gizmo, or moved by the eye looking through a camera | the transforms before |
| `VolumeCommand` | the shapes of volumes dragged by a face with the gizmo, the centre following a face moved on its own; the faces of the collider of a body dragged | the shapes and the transforms before |
| `BodyCommand` | the shapes of bodies and the capsules of characters, typed in the inspector, the colliders built once (a model read, the volumes of a compound gathered) | the shapes and the colliders before, merging the steps of one field |
| `ProjectionCommand` | a camera replaced by a camera of the other projection, of its id, its name, its place, its transform, its planes and the nodes under it, seeing at the point it looks at what it saw there, active when it was, selected | the camera put back in place of its replacement |
| `ActiveCameraCommand` | the active camera of the scene, checked in the inspector | the camera active before made active again |
| `RenameCommand` | the name of a node, refused when a sibling has it | the name before |
| `AddCommand` | a node built from its description, at a place among the children of its parent (a point inserted in a path), selected | detaching the node |
| `RemoveCommand` | nodes and the nodes under them | attaching them again under their parents, at their places |
| `ReparentCommand` | nodes and the nodes under them moved under another parent or among their siblings, dropped in the outline | moving them back to their parents, places, names and transforms |
| `WrapCommand` | nodes put under new bodies at their places, of shapes fitted to them, a volume turned into a trigger, the bodies selected | the nodes moved back to their parents, places and transforms, the bodies detached |
| `DuplicateCommand` | copies of nodes beside them, sharing the geometry of their meshes, selected | detaching the copies |
| `ConnectionsCommand` | the connections of the signals of an actor, one made or removed in the inspector | the connections before |
| `OpenCommand` | the nodes of the scene replaced by those of a scene file | attaching the nodes replaced again |

## Property schemas

Each node class declares its properties once, beside the class, in a `NodeSchema` (`balder::scene::property`), as
the widgets declare their attributes in a `WidgetSchema`: `Light::schema()`, `Camera::schema()`... A property has the
name of its entry in the scene files, a kind (a number, a vector, a colour, a boolean, a choice, a text, texts, an
asset, a node, a count, the bits of the layers), a default, a getter and a setter (none for a property a node takes at
its creation only: the file of a model, the projection of a camera, the shape of a body), a check telling why a node
refuses a value, the label and the group of its row in the inspector, the range of its fields, and the condition under
which it applies (the cone of a spot light, the sizes the shape of a volume uses). Every schema starts with the
transform; `Property!{N, T}` declares a property of a class `N` holding a `T`, `ChoiceProperty!{N, E}` one holding a
member of an enum, each named and labelled:

```
copy Property!{&Light, f32}("inner-angle", 20.0f, |dmut l| => l.innerAngle,
                            set-> (|dmut l, a| => { l.innerAngle = a; })?,
                            label-> "Inner angle (degrees)", group-> "Light",
                            when-> (Condition(property-> "light", choices-> copy ["spot"]))?,
                            range-> NumberRange(min-> 0.0f, max-> 90.0f, step-> 0.5f, decimals-> 1u32))
```

From the schemas, the scene files read and write the entries of a node (`NodeDescription` holds a value of each
property of its kind, the default until it is given another one, `d.value("intensity")`, `d:.set("intensity",
PropertyValue::number(2.0f))`), the inspector builds its rows, and `PropertyCommand` changes any property through a
`PropertyEdit` (`balder::scene::edit`, the value before and after). A new node class declares its schema, and the
scene files and the inspector take it with no other change but its kind (`description/kind.yr`). Two classes
declaring a property of the same group and name share it (the radius of a body and of a character), the inspector
showing it for nodes of both.

## Scene files

A scene file (`.scene`) is read by `SceneDescription` (`balder::scene::description`), which also writes it:
`SceneDescription::fromFile (path).build (root)` creates its nodes under a node, the root of a `Scene`, and
`SceneDescription (root).save (path)` writes the nodes under it, the nodes named `__…__` left out. The file opens with
the version of its format (`scene 2;`, a file of another version refused), declares the assets its nodes use (see
`doc/assets.md`), holds a block per material local to the file, then a flat block per node:

```
// a table and its light
scene 2;

asset cube mesh "engine:/meshes/cube";
asset table mesh "res:/models/table.glb";

material #5d1e0c2a-7b3f-4a9e-8c21-0f6e5d4c3b2a "red paint" {
    base-color: 0.8 0.3 0.2;
    roughness: 0.5;
}

node #87b7e0df-348c-4ee2-b5e4-a54c540e02bf light "sun" {
    direction: -0.3 -1 -0.2;
}

node #030e69b7-ba92-4e55-bd67-5381a2351926 empty "props" {
    position: 0 0 -2;
}

node #75e8622f-285e-414a-8e93-d82ecee1a614 mesh "crate" {
    parent: #030e69b7-ba92-4e55-bd67-5381a2351926;
    rotation: 0 30 0;
    mesh: @cube;
    materials: #5d1e0c2a-7b3f-4a9e-8c21-0f6e5d4c3b2a;
}

node #0c203f1a-b872-4e76-b3e0-0c7c95e00c74 mesh "table" {
    parent: #030e69b7-ba92-4e55-bd67-5381a2351926;
    mesh: @table;
}
```

A node is `node #<id> <kind> "<name>" { … }`, the kind being `empty`, `mesh`, `light`,
`marker`, `path`, `path-point`, `volume`, `body`, `character` or `camera`, the points of a path being the `path-point` nodes
under it, in their order, the parts of a compound body the `volume` nodes under it, or the type of an actor class
(see `doc/actors.md`): its entries are its transform, its properties (`#[export]`) and the connections of its signals,
`on-<signal>: #<id of the actor receiving it> <slot>;`, one line per connection:

```
node #22222222-2222-4222-8222-222222222222 lever "lever" {
    position: 4 0 0;
    on-pressed: #11111111-1111-4111-8111-111111111111 open;
}
```

A node of a class the program does not know (a scene of a game opened in Balder's own editor) is kept as an
`UnknownActor`, an empty of its transform, its other entries and its connections written back as they were read.
Its id (`Node3D.guid`) is a uuid it keeps from one save to the next, and the nodes under another name it as their
`parent`, so the file stays flat however deep the tree is: moving a node under another parent changes one line, and a
node is named by its id rather than by its path. The blocks may come in any order; among siblings, the order of the file
is the order of the nodes (`Node::getChildrenInOrder`), which the outline shows and changes. Comments are those of the `.gui` files.

| Entry | Nodes | Value |
|---|---|---|
| `parent` | every node | the id of the node it is under, `#<uuid>`, none under the root |
| `position`, `rotation`, `scale` | every node | three numbers, in the space of the parent, the rotation in degrees |
| `mesh`, `materials`, `lods`, `shadows` | mesh | the mesh asset drawn (`@<key>`, required); the material of each part, an asset of the file (`@<key>`), a material local to it (`#<uuid>`) or `none` for the part's own (`materials: none @brick;`); whether the levels of detail of a model file are built (`true`); whether it casts shadows (`true`) |
| `light`, `color`, `intensity`, `direction`, `range`, `inner-angle`, `outer-angle`, `shadows` | light | `direction`, `point` or `spot`, then as `Light` has them |
| `purpose`, `tags` | marker | `generic`, `spawn`, `waypoint` or `socket`; strings (`tags: "enemy" "boss";`) |
| `curve`, `closed` | path | `catmull-rom` or `bezier`; whether the curve goes back to its first point (`false`) |
| `shape`, `size`, `radius`, `height` | volume | `box`, `sphere` or `capsule`; the sides of a box, the radius of a sphere or a capsule, the height of a capsule, its caps included (only the entries of its shape are written) |
| `shape`, `size`, `radius`, `height`, `model` | body | `box`, `sphere`, `capsule`, `cylinder`, `plane`, `hull`, `mesh` or `compound`; the sizes of its shape as a volume has them, the height of a cylinder too; the asset of the model of a hull or a mesh (`@<key>`, required by them, refused by the others) |
| `motion`, `mass`, `friction`, `rolling-friction`, `spinning-friction`, `restitution`, `linear-damping`, `angular-damping`, `can-sleep`, `bullet`, `trigger` | body | `static`, `kinematic` or `dynamic`, then as `BodySettings` has them |
| `layer`, `mask` | body, character | the numbers of the layers, 0 to 31 (`layer: 0 2;`), or `none` |
| `projection`, `fov`, `size`, `near`, `far`, `active` | camera | `perspective` or `orthographic`; the vertical field of view of a perspective camera in degrees, the height of the view of an orthographic one; its planes; whether it is the active camera of the scene (`true`, one camera of the file at most) |
| `radius`, `height`, `up`, `slope-limit`, `step-offset`, `snap-distance`, `skin`, `coyote-time`, `push-mass`, `max-slides`, `depenetrations` | character | its capsule (0.4 and 1.8 by default), then as `CharacterSettings` has them, the slope limit in degrees |

An asset is `asset <key> mesh "<path>";` or `asset <key> material "<path>";`, the path a `res:/…`, an absolute one, a
built-in mesh (`engine:/meshes/cube`) or a material embedded in a model file (`res:/models/table.glb#0`), named by the
`mesh` and the `materials` of a mesh node and the `model` of a body, each reading assets of its kind. A material block,
`material #<uuid> "<name>" { … }`, is a material local to the file, of the entries of a `.material` file (see
`doc/assets.md`), named by its id in the slots of the meshes; building the scene puts it in the cache of the assets. The
kinds of the files of version 1, `model`, `cube`, `sphere` and `plane`, are refused, the error telling the mesh node
replacing them. The writer writes the same file for
the same nodes, so a scene diffs well under version control: the assets in the order of their paths, keyed by the name
of their file (`table_0` for the first material of `table.glb`); the materials local to the file in the order of their
names, their entries holding their defaults left out; the nodes parents first, siblings in their order; the entries of a node in the order of
the schema of its kind, those that do not apply (the cone of a point light, the sizes another shape uses, the dynamics
of a body that is not dynamic) and those holding their default left out; each number the shortest decimal reading back
the same float. A scene
started from a template (the main scene of a new project, see `ProjectTemplate`) gives its nodes and its local materials
ids of their own (`SceneDescription.withoutIds`).

The file is the source of a scene, the one edited and versioned; the game will load a binary file cooked from it
(BAL-187).

The built-in cube, sphere and plane stand in the unit box of the models, as a model loaded from a file does: x and z in
[-0.5, 0.5], y in [0, 1]. The scale of a mesh node drawing one is its size, and its position the centre of its base. An
entry its kind does not read, an entry given twice, a value of the wrong type, two nodes of one id, a parent, an asset
or a local material the file does not declare, an asset of another kind than its entry reads, or a node under itself is
an error telling the file, the line and the column, and why.
