# Creating an actor

An actor is a node of a class the game declares: a door, a lever, an enemy, a pickup. Its class is a class over
`Node3D` tagged `#[actor]`, its fields tagged `#[export]` its properties, its signals tagged `#[emits]` and its methods
tagged `#[slot]` its slots. The class registers itself at the start of the program in the registry of the node
classes (`balder::scene::actors`, `nodeClasses`), beside the built-in ones (a light, a camera…). From there, the
scene files save its nodes, the editor adds them, edits their properties and connects their signals to the slots of
other actors, and the game builds them and makes their connections.

This page walks through a door opened by a lever; `doc/editor.md` tells the editor and the scene files.

## 1. A project

Create the project in the project manager of the editor (*New project…*): `My Game` gives the folder `my_game`, and
the package `my_game`.

```
my_game/
    project.toml             # its name and its scenes
    gyllir.toml              # the library of the game, a shared one
    src/my_game.yr           # the root module of the library: the actor classes go under it
    res/scenes/main.scene
```

The library of the game (`my_game`) holds its actor classes. It is a shared library (`target/lib/libmy_game.so`) that
the editor builds and loads when it opens the project (`gyllir build my_game`, about a minute the first time, Balder
being built with it), the tags of its classes registering them as it is loaded; **Compile** (Ctrl+R) builds it again
and reloads it after a change of the code. Its target in `gyllir.toml` leaves Balder to the editor loading it:

```
[targets.my_game]
type = "shared"
package-root = "my_game"
dependencies = ["Balder"]
host-provided = ["Balder"]
output-dir = "target/lib"
```

A project made with an editor target (the template of BAL-128) opens with the actors of its scenes kept as unknown
ones: give its library the `type` and the `host-provided` above, the `[compiler]` of the template, and remove its
`[targets.editor]` and its `editor/main.yr`.

## 2. The class

An actor class goes in a module of the library, declared by the root module:

```
// src/my_game.yr
in my_game;

pub mod ::door;
pub mod ::lever;
```

```
// src/my_game/door.yr
in door;

use balder::core::application::signal;
use balder::scene::actors::tags;
use balder::scene::node;
use balder::scene::node::node3D;

/**
 * A door, opened by the signals connected to its slot `open`
 * */
#[actor ("door", category-> "Gameplay")]
pub class Door over Node3D {

    #[export (label-> "Opening speed", min-> 0.0f, max-> 10.0f, step-> 0.5f, decimals-> 1u32)]
    let mut _speed: f32 = 2.0f;

    #[export]
    pub let mut locked: bool = false;

    #[emits]
    pub let dmut opened: &Signal!{()} = copy Signal!{()} ();

    pub self (name: [c8], dmut parent: &Node)
        with super(name, alias parent)
    {}

    pub over onEnter(mut self, dmut _: &Scene) {}
    pub over onExit(mut self, dmut _: &Scene) {}

    #[slot]
    pub fn open(mut self) {
        if self.locked { return; }
        // … move the panel, at self._speed
        self.opened:.emit();
    }
}
```

```
// src/my_game/lever.yr
in lever;

use balder::core::application::signal;
use balder::scene::actors::tags;
use balder::scene::node;
use balder::scene::node::node3D;

#[actor ("lever", category-> "Gameplay")]
pub class Lever over Node3D {

    #[emits]
    pub let dmut pressed: &Signal!{()} = copy Signal!{()} ();

    pub self (name: [c8], dmut parent: &Node)
        with super(name, alias parent)
    {}

    pub over onEnter(mut self, dmut _: &Scene) {}
    pub over onExit(mut self, dmut _: &Scene) {}

    pub fn press(mut self) {
        self.pressed:.emit();
    }
}
```

What a class needs:

- **Over `Node3D`**, or over another actor class (see *Inheritance*). `Node3D` leaves `onEnter` and `onExit` to its
  classes: an actor overrides them, empty when it has nothing to do as it enters or leaves its scene.
- **The constructor `self (name: [c8], dmut parent: &Node)`**, which builds the nodes of the scene files and of the
  editor; their properties are then given the values of the file, so the constructor sets nothing a property holds.
- **The tags** of `balder::scene::actors::tags` in scope (`use balder::scene::actors::tags;`).
- **A type** (`"door"`) of lowercase letters, digits and `-`, starting with a letter, that no other class has (a
  built-in kind, `mesh`, `light`…, or another actor class): a class refused is logged at the start (`Actor class
  'door' refused: …`) and left out.

## 3. The tags

### `#[actor (name, label, category)]`, on the class

| Parameter | Default | Meaning |
|---|---|---|
| `name` | required | the type of its nodes in the scene files, `door` |
| `label` | the name made a sentence (`Door`) | its name in the editor, in the Add menu |
| `category` | `Actors` | the submenu of the Add menu listing it |

### `#[export (…)]`, on a field: a property

The field is mutable, private ones included, of one of the types of the properties:

| Type | Row of the inspector | In the scene file |
|---|---|---|
| `f32` | a number | `speed: 2.5;` |
| `vec3` | three numbers (a colour with `color-> true`) | `tint: 1 0.5 0;` |
| `bool` | a box | `locked: true;` |
| `u32` | a whole number (the 32 layers with `layers-> true`) | `keys: 2;` |
| `[c8]` | a text (a file of the project with `asset-> true`, told, not edited) | `label: "north";` |
| `[[c8]]` | texts, separated by spaces | `tags: "red" "big";` |
| `Uuid` | told, not edited | `partner: #<id>;` |
| an enum | a dropdown of its members | `opening: slide-up;` |

| Parameter | Default | Meaning |
|---|---|---|
| `name` | the field in kebab case (`_openSpeed` gives `open-speed`) | the name of its entry in the scene files |
| `label` | the name made a sentence (`Open speed`) | the label of its row in the inspector |
| `group` | the label of the class | the section of the inspector holding it |
| `min`, `max`, `step`, `decimals` | -10000, 10000, 0.01, 2 | the range of a number or a vector, and how it steps |
| `color` | `false` | a `vec3` holding a colour |
| `asset` | `false` | a `[c8]` holding the path of a file of the project (`res:/…`) |
| `layers` | `false` | a `u32` holding the bits of the collision layers |
| `degrees` | `false` | an angle in radians, given in degrees by the scene files and the inspector |
| `set` | none | a method `(mut self, T)` giving the value instead of the field being written |

The default of a property is the value of the field in a node just built. The members of an enum are named in kebab
case (`SLIDE_UP` is `slide-up`, labelled `Slide up`). A field of another type is refused at compilation (`a field
tagged #[export] is a f32, a vec3, …`).

### `#[emits (name)]`, on a field or a method: a signal

A field holding a `&Signal!{…}`, or a method `(mut self)` returning one, as Balder gives its own signals:

```
#[emits]
pub let dmut opened: &Signal!{()} = copy Signal!{()} ();

#[emits (name-> "hit")]
pub fn hitSignal(mut self)-> dmut &Signal!{f32} { alias self._hit }
```

Its name in the scene files is the field or the method in kebab case, unless `name` gives one. What it gives (its
payload) is the type of the signal: nothing for `Signal!{()}`, a number for `Signal!{f32}`.

### `#[slot (name)]`, on a method: a slot

A method taking the payload of the signals connected to it: `open (mut self)` takes the signals of no payload,
`push (mut self, force: f32)` the signals of a number. A signal is connected to a slot only when the types match
exactly.

## 4. In the editor

Open the project from the project manager: the editor opens on it, builds the library of the game in the background,
the status bar telling how far, then loads it, the scene built again with its classes; a library newer than its
sources is loaded right away. A build that fails tells its first error in the status bar and in a dialog showing it as
the compiler wrote it, with buttons opening the file of all its errors (`.target/game-build-errors.txt`) and its whole
output (`.target/game-build.log`).

- **Compile**, on the right of the menu bar (Ctrl+R), builds the library again and reloads it: a change of the code of
  the door is taken without leaving the editor, the actors of the scene and their connections kept. What a class no
  longer declares (a property renamed, a signal or a slot removed) is dropped from the scene and logged, the scene
  left unsaved; an actor whose class is gone is kept as an unknown one.
- **Add** lists the classes by category, after the built-in kinds: *Add → Gameplay → Door* adds a door where a cube
  goes, its properties holding their defaults.
- **The inspector** shows the properties of an actor in the section of its class (or of their groups), edited and
  undone as any other.
- **Connections**: selected, an actor has a panel of the connections of its signals. Choose a signal of the actor, an
  actor of the scene having a slot taking it, then the slot, and click *Connect*; pick a connection in the table and
  click *Remove the connection* to remove it. Select the lever, choose `pressed`, the door, `open`: once the game
  builds the scene, pressing the lever opens the door. Each change is undone as the others (Ctrl+Z).

The editor does not run the actors: it keeps their properties and their connections, the game makes them.

## 5. In the scene file

The nodes of an actor are written under the type of their class, their properties and their connections among their
entries, a connection being `on-<signal>: #<id of the actor receiving it> <slot>;`:

```
node #11111111-1111-4111-8111-111111111111 door "door" {
    position: 3 0 0;
    speed: 4;
}

node #22222222-2222-4222-8222-222222222222 lever "lever" {
    position: 4 0 0;
    on-pressed: #11111111-1111-4111-8111-111111111111 open;
}
```

A property holding its default is left out. A node of a class the program does not know (a class renamed, the scene
opened while the library of the game is not loaded) is kept as an `UnknownActor`: an empty of its transform, its other
entries and its connections written back as they were read, so that nothing is lost.

## 6. In the game

The game builds a scene file as any other; the build connects the signals of its actors to the slots their
connections name, emitted in the thread of the scene:

```
SceneDescription::fromFile(path).build(alias scene:.getRootNode());
```

A connection that cannot be made is logged (`Scene` warning) and left out: the node it names is not in the scene,
has no such slot, or its slot does not take the payload of the signal; the actors of an unknown class keep their
connections without them being made. The actors built in code connect their signals themselves:
`lever.pressed:.connect(alias box, &door:.open)`, or give a node its connections (`node.connections = …`) before
building, as the scene files do.

## Inheritance

An actor class over another actor class has the properties, the signals and the slots of the other one, then its own:

```
#[actor ("locked-door", label-> "Locked door", category-> "Gameplay")]
pub class LockedDoor over Door {

    #[export]
    pub let mut key: [c8] = "";

    pub self (name: [c8], dmut parent: &Node)
        with super(name, alias parent)
    {}

    #[slot]
    pub fn unlock(mut self) { self.locked = false; }
}
```

A node is of the class the furthest from `Node3D` among those it is of (`actorClassOf`): a locked door is written
`locked-door`. Actors are built by inheritance only, Balder having no components.
