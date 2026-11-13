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
- **Outline**: the nodes of the scene in the order they were created, a click selecting a node, Ctrl and Shift
  selecting several, Enter or a double click looking at it. It follows the selection of the viewport.
- **Inspector**: the name of the node selected last, then the panel of its kind, refreshed as the gizmo moves it. An
  object (a mesh, a model, a group) shows its position, its rotation (in degrees) and its scale; a light its position,
  its direction, its colour, its intensity, its range, the angles of its cone and whether it casts shadows, the fields
  its type does not use left out (no position for a direction light, no direction for a point light, a cone for a spot
  light only). A name is applied when Enter is pressed; a field changed gives its value to every node selected of the
  kind of the panel, each keeping its other values. One direction light casts shadows at a time.
- **Menus**: *Scene* opens a new scene or a scene file and saves the scene (Ctrl+S) or saves it in another file
  (Ctrl+Shift+S), *Add* adds a cube, a sphere, a plane, a model read from a
  file, a group or a light where the centre of the viewport meets a surface (or at the point the camera looks at), and
  *Edit* duplicates, deletes and frames the selection.

- **Saving**: a change marks the scene as unsaved, by a `*` in the title of the window and on the right of the status
  bar, which tells the file of the scene, until it is saved. A new scene has no file yet: its first save asks for one,
  given the extension `.scene` when it has none. New, Open and Quit (from the menu or by closing the window) ask
  whether to save the changes first, to discard them, or to do nothing.

The nodes named `__…__` belong to the editor (its camera, the gizmo): they are neither shown, nor removed with the
scene, nor saved.

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

node #030e69b7-ba92-4e55-bd67-5381a2351926 group "props" {
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

A node is `node #<id> <kind> "<name>" { … }`, the kind being `group`, `model`, `cube`, `sphere`, `plane` or `light`.
Its id (`Node3D.guid`) is a uuid it keeps from one save to the next, and the nodes under another name it as their
`parent`, so the file stays flat however deep the tree is: moving a node under another parent changes one line, and a
node is named by its id rather than by its path. The blocks may come in any order; among siblings, the order of the file
is the order of the nodes. Comments are those of the `.gui` files.

| Entry | Nodes | Value |
|---|---|---|
| `parent` | every node | the id of the node it is under, `#<uuid>`, none under the root |
| `position`, `rotation`, `scale` | every node | three numbers, in the space of the parent, the rotation in degrees |
| `file`, `lods` | model | the asset of the model file (`@<key>`, required), whether its levels of detail are built (`true`) |
| `color`, `roughness`, `metallic` | cube, sphere, plane | the base colour and the material |
| `light`, `color`, `intensity`, `direction`, `range`, `inner-angle`, `outer-angle`, `shadows` | light | `direction`, `point` or `spot`, then as `Light` has them |

An asset is `asset <key> model "<path>";`, the path a `res:/…` or an absolute one. The writer writes the same file for
the same nodes, so a scene diffs well under version control: the assets in the order of their paths, keyed by the name
of their file; the nodes parents first, siblings in the order they were created; the entries of a node in the order of
the table, those holding their default left out; each number the shortest decimal reading back the same float. A scene
started from a template (`editor/scenes/new.scene`) gives its nodes ids of their own (`SceneDescription.withoutIds`).

The file is the source of a scene, the one edited and versioned; the game will load a binary file cooked from it
(BAL-187).

A cube, a sphere and a plane stand in the unit box of the models, as a model loaded from a file does: x and z in
[-0.5, 0.5], y in [0, 1]. Their scale is their size, and their position the centre of their base. An entry its kind
does not read, an entry given twice, a value of the wrong type, two nodes of one id, a parent or an asset the file does
not declare, or a node under itself is an error telling the file, the line and the column, and why.
