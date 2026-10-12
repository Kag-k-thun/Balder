# The editor

The editor of Balder lives in `editor/`, beside the library, as the start of a game engine editor: the outline of the
scene on the left, its viewport in the middle, the inspector of the node selected on the right, under a menu bar and
above a status bar.

```
gyllir build editor
./balder-editor                         # a new scene, editor/scenes/new.toml
./balder-editor --scene path/to/a.toml  # a scene file
```

| Directory | Holds |
|---|---|
| `editor/src` | the sources, the target `editor` of `gyllir.toml` (built as `balder-editor`) |
| `editor/ui` | the `.gui` and the `.style` files of its interface |
| `editor/scenes` | `new.toml`, the scene a new scene starts from |
| `editor/editor.toml` | the configuration of its window |

## Using it

- **Viewport**: a click selects the node under the cursor (Ctrl toggles it), the middle button turns the camera around
  the point it looks at, Shift and the middle button slide it, the wheel brings it closer. Once clicked, the viewport
  takes the keys W, E and R (translate, rotate, scale, the key of the mode in use switching between the world and the
  local axes), Delete, Ctrl+D (duplicate) and F (look at the selection, or at the whole scene).
- **Outline**: the nodes of the scene in the order they were created, a click selecting a node, Ctrl and Shift
  selecting several, Enter or a double click looking at it. It follows the selection of the viewport.
- **Inspector**: the name of the node selected last, then the panel of its kind, refreshed as the gizmo moves it. An
  object (a mesh, a model, a group) shows its position, its rotation (in degrees) and its scale; a light its position,
  its direction, its colour, its intensity, its range, the angles of its cone and whether it casts shadows, the fields
  its type does not use left out (no position for a direction light, no direction for a point light, a cone for a spot
  light only). A name is applied when Enter is pressed; a field changed gives its value to every node selected of the
  kind of the panel, each keeping its other values. One direction light casts shadows at a time.
- **Menus**: *Scene* opens a new scene or a scene file, *Add* adds a cube, a sphere, a plane, a model read from a
  file, a group or a light where the centre of the viewport meets a surface (or at the point the camera looks at), and
  *Edit* duplicates, deletes and frames the selection.

The nodes named `__…__` belong to the editor (its camera, the gizmo): they are neither shown nor removed with the scene.

## Commands

Every change of the scene is a command (`EditCommand`) run by `SceneEditor::execute`, which applies it and emits
`edited`; the outline, the inspector and the status bar follow the changes from there. A drag of the gizmo moves the
nodes while it lasts and is recorded as a `TransformCommand` once released. The commands are the place undo and redo
go: each one knows the change it made.

| Command | Change |
|---|---|
| `TransformCommand` | the transforms of nodes, typed in the inspector or dragged with the gizmo |
| `LightCommand` | the settings of lights (colour, intensity, direction, range, cone, shadows), typed in the inspector |
| `RenameCommand` | the name of a node, refused when a sibling has it |
| `AddCommand` | a node built from its description, selected |
| `RemoveCommand` | nodes and the nodes under them |
| `DuplicateCommand` | copies of nodes beside them, sharing the geometry of their meshes, selected |
| `OpenCommand` | the nodes of the scene replaced by those of a scene file |

## Scene files

A scene file is a toml file read by `SceneDescription` (`balder::scene::description`), its nodes in the array of
tables `node`, the nodes under a node in its own array `children`. `SceneDescription::fromFile (path).build (root)`
creates them under a node, the root of a `Scene`.

```toml
[[node]]
name = "sun"
type = "light"
light = "direction"
direction = [-0.3, -1.0, -0.2]

[[node]]
name = "props"
type = "group"
position = [0, 0, -2]

[[node.children]]
name = "crate"
type = "cube"
rotation = [0, 30, 0]
color = [0.8, 0.3, 0.2]
roughness = 0.5
```

| Entry | Nodes | Value |
|---|---|---|
| `name`, `type` | every node, required | the name (not empty, no `/`), and `group`, `model`, `cube`, `sphere`, `plane` or `light` |
| `position`, `rotation`, `scale` | every node | three numbers, in the space of the parent, the rotation in degrees |
| `children` | every node | the nodes under it, `[[node.children]]` |
| `file`, `lods` | model | the model file (`res:/…` or absolute, required), whether its levels of detail are built (true) |
| `color`, `roughness`, `metallic` | cube, sphere, plane | the base colour and the material |
| `light`, `color`, `intensity`, `direction`, `range`, `inner-angle`, `outer-angle`, `shadows` | light | `direction`, `point` or `spot`, then as `Light` has them |

A cube, a sphere and a plane stand in the unit box of the models, as a model loaded from a file does: x and z in
[-0.5, 0.5], y in [0, 1]. Their scale is their size, and their position the centre of their base. An entry the node
does not read, a value of the wrong type or a missing name or type is an error naming the node and the entry.
