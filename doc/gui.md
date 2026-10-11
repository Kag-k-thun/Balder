# The .gui and .style language

A `.gui` file says which widgets exist, what they say and how they behave. A `.style` file says how they look and
where they go. Both share one lexer and one grammar of values. This page describes the language as Balder reads it
today; [gui-v2.md](gui-v2.md) is the design it comes from.

The second half of the page, from [Widget types](#widget-types) on, is generated from the widget registry and the
property table by `gyllir run reference` in `tools/`, and a test fails when it no longer matches the code.

## Loading the files

```
self.gui:.loadStyleFile ("res:/dialog/default.style")?;
self.gui:.loadGUIFile ("res:/dialog/message.gui")?;
```

- `loadStyleFile` reads a sheet after the sheets it imports, decodes every rule against the widget types, registers
  the fonts of its `@font-face` blocks and computes the styles of the widgets already loaded again. A sheet refused
  adds no rule.
- `loadGUIFile` reads a `.gui` file and the files it imports, unfolds its [components](#components), checks every
  node against the widget types and every `on-…` attribute against the [slots](#signals) of the activity, then
  creates the widgets, connects their signals and makes the root the content of the manager. The sheets the
  components name with `@style` are loaded the first time a file names them.
- `loadComponents` reads only the components of a file and of those it imports, a file holding only components being
  a library of widgets, and `instantiate` creates an instance of a component from code (see
  [Instances written by code](#instances-written-by-code)).
- A path is qualified (`res:/`, `shaders:/`, …, relative to the project) or relative to the working directory.
- An error names the file, the line and the column, and says what was expected:
  `example/form/form.gui:5:32: unknown attribute 'len' of 'InputText' under 'LinearLayout'`.

## Lexical rules

- Spaces and line breaks separate the tokens. Comments are `// to the end of the line` and `/* … */`.
- Identifiers are made of letters, digits, `_` and `-`: `min-content`, `on-click`, `FILE_MENU`.
- Strings use double quotes only, with the escapes `\"`, `\\`, `\n` and `\t`.
- Numbers need a leading digit (`0.5`, not `.5`) and may carry a unit, glued: `12`, `12px`, `40%`, `1fr`.

## The structure file

```
LinearLayout #FL .root {
    Label #QUESTION .question "HELLO?";
    LinearLayout #F2 .inner {
        PushButton #YES .yes "Yes" { on-click: yes; }
        PushButton #NO .no "No" { on-click: no; }
    }
}
```

```
document  = { directive | component } [ node ] ;
directive = "@import" string ";" | "@style" string ";" ;
component = "@component" Type "(" [ param { "," param } ] ")" "{" node "}" ;
param     = "$" ident [ ":" values ] ;
node      = Type { "#" ident | "." ident } [ values ] ( ";" | "{" { member } "}" ) ;
member    = attribute | node | slot ;
attribute = ident ":" values ";" ;
slot      = "@slot" [ ident ] ";" ;                (* only inside a component *)
```

- **A node** is its type, then an optional id after `#`, then its classes after `.`, then an optional default value,
  then `;` or a block. Inside the block, `name: value;` is an attribute and anything starting with a type is a child.
- **The default value** sets the default attribute of the type: the text of a `Label`, a `PushButton`, a `MenuButton`
  or an `InputText`. Setting the same attribute in the block too is an error.
- **Ids are optional.** Only the widgets the code looks up need one. An anonymous widget adds no segment to a find
  path: `find ("BODY/NAME")` reaches `Label #NAME` through an unnamed `LinearLayout`. Two named widgets reachable by the
  same path are an error at load.
- **Attributes of the children** belong to the parent's type: `tab: "Form";` under a `TabLayout`,
  `cell: 1 0;` under a `GridLayout`, `capture-events: false;` under a `FloatingLayout`. A grid child without a `cell`
  takes the next free cell, row by row.
- **Every length is in the style.** Sizes, margins, directions, tracks and positions are style properties; the only
  size in a `.gui` file is the `resolution` a `Scene3D` renders at before being scaled to the widget.
- **The post-process chain of a `Scene3D`** is described by `post: taa, bloom, lut("res:/lut/film.png"), fxaa, invert(off);`:
  each effect is a kind registered in the post registry of the manager (`WidgetManager::getPostRegistry`, `taa`,
  `vignette`, `bloom`, `invert`, `lut` and `fxaa` in Balder, an application registering its own before loading the
  file), followed by its parameters, numbers and texts (the path of a LUT), `off` adding it disabled. The effects are
  added to the chain of the scene when the widget is attached (see `doc/render-graph.md`), the temporal anti-aliasing
  running first among the effects in HDR space wherever it is in the list.

### Components

A component is a group of widgets declared once and used like a widget type. An instance is written as any node,
with an id, classes, a default value, attributes and children.

```
@component FieldRow ($label, $max-length: 64, $only-numbers: false) {
    LinearLayout .field-row {
        Label .field $label;
        InputText #INPUT .input {
            max-length: $max-length;
            only-numbers: $only-numbers;
        }
    }
}

LinearLayout #FORM {
    FieldRow #NAME "Name";
    FieldRow #AGE "Age" { max-length: 3; only-numbers: true; }
}
```

- **Parameters** are `$name`, with an optional default after `:`. The default value of an instance sets the first
  parameter, and an attribute of the instance named like a parameter sets it. A parameter without a default is
  required. The value is substituted whole where the parameter is written, a tuple being spliced as a constant of a
  sheet, and checked against the kind of the attribute it lands in: a value of the wrong kind is an error where the
  value was given, in the instance or in the default of the parameter.
- **The instance is the root** of the component: the root takes the id of the instance (it keeps its own when the
  instance has none), and the classes of the instance after its own. The other attributes of the instance are those
  its parent gives its children, so `tab: "Form";` works on an instance under a `TabLayout`; an attribute of the root
  itself is not reachable from the instance.
- **The ids are scoped to the instance**: `find ("FORM/AGE/INPUT")` reaches the input of the second row, and two
  instances may use the same inner ids. An anonymous instance adds no segment, as an anonymous widget.
- **The style selects the root** by its type and by the name of the component: `FieldRow`, `LinearLayout.field-row`
  and `#AGE` all match it. A selector naming a component is checked against the type of its root, so the sheet has to
  be loaded after the `.gui` file declaring the component; the `@style` sheets of the components always are.
- **A cycle** between components is an error naming the chain: `component 'A' used in its own expansion: A -> B -> A`.
- **A code-backed component** takes as its root the widget type registered under its own name: in
  `@component Collapsible (…) { Collapsible .collapsible { … } }`, the root is the registered `Collapsible`, given its
  inner structure by the component.

#### Slots

`@slot;` marks where the children of an instance go, and `@slot tools;` receives the children that say `slot: tools;`,
the unnamed slot receiving the others.

```
@component Panel ($title) {
    LinearLayout .panel {
        LinearLayout #BAR .panel-bar { Label .panel-title $title; @slot tools; }
        LinearLayout #BODY .panel-body { @slot; }
    }
}

Panel #INSPECTOR "Inspector" {
    PushButton #PIN .tool "Pin" { slot: tools; }
    Label #SELECTION .info "Nothing selected yet.";
}
```

- **The widgets put in a slot are found under the instance**, not under the container of the slot:
  `find ("INSPECTOR/SELECTION")`, so the component can move its slots without breaking the paths of the code.
- A child naming a slot the component does not have, or given to a component without slots, is an error. The container
  of the slot still checks the children it receives.
- `@slot;` written in the block of an instance inside a component passes the children of that slot on, to the unnamed
  slot of the instance: they stay found under the outer instance.

#### Libraries

```
// res:/widgets/field-row.gui, a library of widgets
@style "field-row.style";

@component FieldRow ($label, $max-length: 64) { … }
```

```
// the application
@import "res:/widgets/field-row.gui";

LinearLayout #FORM {
    FieldRow #NAME "Name";
}
```

- `@import "file.gui";` brings in the components of another file, and those it imports itself. The path is relative to
  the importing file unless it is qualified or absolute. A file imported twice is read once; a file importing itself is
  an error naming the chain, and two components of the same name reaching a file from two files are an error.
- `@style "file.style";` gives the components of a file their default look. The sheet is loaded the first time a file
  names it, at the origin of the components: every sheet of the application wins over it, whatever the specificity of
  its selectors.

#### Instances written by code

```
self.gui:.loadComponents ("res:/widgets/field-row.gui")?;
self.gui:.instantiate ("FieldRow", "Phone", parent-> "BODY/FORM", id-> "PHONE", attributes-> "max-length: 20;")?;
```

`instantiate` creates an instance of a component of the files loaded after the children of the widget at `parent`,
the root of the interface when it is `""`, as if it were written there. The value is the text of the default value,
and `attributes` the block of the instance in the syntax of the `.gui` files. A path already taken, a parent that takes
no more children and an instance refused are errors.

### Signals

The code registers its handlers under names, the slots, and an `on-…` attribute says which slot a signal of the widget
calls. The loader checks and connects them, so no handler is connected by looking a widget up first.

```
over onStart (mut self) {
    self:.slot ("quit", &self:.onQuitClicked);                     // fn onQuitClicked (mut self, button: u8)
    self:.slot ("describe", &self:.onDescribe);                    // fn onDescribe (mut self, text: [c8], button: u8)
    self:.behavior ("form", copy FormBehavior (alias self.gui));   // its slots are form::submit, form::reset, …
    self.gui:.loadGUIFile ("res:/gui/gallery.gui")?;
}
```

```
PushButton #QUIT "Quit" { on-click: quit; }
PushButton "Label" { on-click: describe ("Label: a text in UTF-8"); }
PushButton "Submit" { on-click: form::submit; }
FieldRow #NAME "Name" { on-validate: form::name-set; }
```

- **The signals are registered by the widget types**, each with the type of its payload: every widget emits
  `on-click` with the mouse button (`u8`, the left one for a button pressed with the [keyboard](#keyboard)), `on-focus`
  and `on-blur` when it gains and loses the focus; the others are listed under [Widget types](#widget-types).
- **The slots are registered by the activity**: `Activity.slot (name, delegate)` records the types of the parameters
  of the delegate, which runs in the thread of the activity. The loader looks no slot up anywhere else.
- **A behavior groups slots under a name.** A class over `Behavior` registers its slots in its constructor
  (`self:.slot ("submit", &self:.onSubmit);`) and the activity mounts it with `Activity.behavior (name, behavior)`. A
  slot name is then a path, `form::submit`, which is looked up only where it leads: `submit` does not find it.
  `Activity.slot ("view::reset", …)` registers a slot by its path, the behaviors missing on the way being created.
- **A slot takes the bound arguments, then the payload.** `describe ("Label: …")` binds constants of the
  [value grammar](#values) (strings, numbers, `true` and `false`) to the first parameters of the slot, and the signal
  gives the last one. A slot binding every parameter suits a signal without payload. A parameter of a type no value
  decodes to (a `vec2`) can only be given by a payload.
- **The connection is checked at load**, before any widget is created. A slot that does not exist, a slot whose
  parameters are not the bound arguments then the payload, and a bound argument of the wrong kind are errors naming
  the file, the line, the signal and the slot:
  `gallery.gui:12:30: the slot 'quit' takes (u8), the attribute 'on-validate' of 'InputText' gives ([c8])`.
- **`none` leaves a signal unconnected.** A component forwards a signal of an inner widget through a parameter
  defaulting to `none`: `@component FieldRow ($label, $on-validate: none)`, with `on-validate: $on-validate;` on its
  input, lets `FieldRow #AGE "Age" { on-validate: age-set; }` reach it. An error about the slot is reported at the
  instance.
- **The connections belong to the widgets**, dropped with them. `connect` stays available for the widgets created by
  code, and `instantiate` connects the `on-…` attributes of the instances it creates.

### Controls

```
CheckBox #SHADOWS "Shadows" { checked: true; on-toggle: toggled; }        // fn toggled (mut self, checked: bool)
RadioButton "Low" { group: "quality"; }
RadioButton "High" { group: "quality"; checked: true; }
Slider #VOLUME 40 { max: 100; step: 1; on-change: volume; }             // fn volume (mut self, value: f32)
SpinBox #COUNT 3 { min: 1; max: 12; decimals: 0; on-change: count; }
ProgressBar #LEVEL 0.25 { max: 1; }
Dropdown #THEME "Dark", "Light" { selected: 0; on-change: theme; }      // fn theme (mut self, index: usize)
ListView #FILES { multiple: true; on-select: picked; on-activate: open; }  // fn picked (mut self, rows: [usize])
TreeView #FOLDERS { on-select: browsed; on-activate: reached; }         // fn browsed (mut self, nodes: [[usize]])
TableView #SONGS { multiple: true; on-select: listed; on-activate: play; }  // fn play (mut self, row: usize)
Separator;
Image "res:/images/logo.png";
```

- **A toggle is checked by a click.** `CheckBox` and `RadioButton` draw a `::box` on the left of their `::label`,
  16 pixels when its style sets no size, and a `::mark` in the content box of the box, filling it unless sized. They
  are in the state `:checked` while checked, so `CheckBox:checked::mark` colours the mark. `on-toggle` gives the new
  state when the user changes it, not when `checked:` or the code sets it.
- **A radio button is only unchecked by another one.** A click checks it, and unchecks the radio buttons of the same
  `group` in the interface, which emit `on-toggle` with `false`. A radio button without a group is never unchecked by
  another one. The last radio button of a group attached checked stays checked.
- **A slider, a spin box and a progress bar show a value between `min` and `max`** (0 and 100 by default), a whole
  number of `step` from `min` (any value without one, 1 for a spin box), the value given by any attribute order. A
  slider drags its `::thumb` along its `::track`, the part under the value being its `::fill`; its style property
  `direction` lays it along a row (the lowest value on the left) or a column (the lowest value at the bottom). The wheel
  moves a slider or a spin box by a step, a hundredth of the range without one. A spin box reads the text typed when it
  loses the focus, and writes the value again with its `decimals`; its arrows are `::up` and `::down`, in the states
  `:hover` and `:pressed`. `on-change` gives the value the user chose.
- **A dropdown opens its list in its menu layout**, as a menu button its popup, so it works only inside a `MenuLayout`.
  The list is its `::popup`, at least as wide as the dropdown, its items its `::item` in the states `:hover` and
  `:selected`. It opens under the dropdown, or above it when its items do not fit under it and there is more room above,
  at most as high as the room on that side and as the `max-height` of `::popup`. Higher items are scrolled with the
  wheel or the `::scrollbar` (8 pixels wide unless its style sets a width), shown only then, in the states `:hover`
  under the cursor and `:pressed` while dragged. The selected item is scrolled to when the list opens. `on-change` gives
  the index of the item the user selected.
- **A list view shows the items of a model given by the code**, a .gui having no loops: `setModel` takes a class over
  `ListModel`, whose `len` and `text (index)` the list reads on demand (`TextListModel` holds a list of texts), and a
  model whose items change calls `changed`, the lists showing it reading it again. Only the rows shown exist, recycled
  as the list scrolls, so a million items cost no more than a dozen. The rows are its `::row`, all of the height of a
  single line of their style, in the states `:hover` under the cursor, `:selected`, and `:current` for the row the keys
  move from (`ListView:focus::row:current` rings it while the list has the focus). Rows higher than the list are
  scrolled with the wheel, three rows a notch, or the `::scrollbar` (10 pixels wide unless its style sets a width, twice
  as long as wide at least), shown only then, in the states `:hover` and `:pressed`. It is drawn in the right padding,
  as the scrollbar of a linear layout, the rows narrowing by what the padding does not leave it. A click selects a row
  alone. With `multiple: true`, Ctrl (or Command) toggles the row clicked, Shift selects the rows from the one clicked
  last without Shift, and Ctrl-Shift adds them. `on-select` gives the selected rows in increasing order when the user
  changes them; `setSelected`, `clearSelection` and a model that changes do not emit it. `on-activate` gives the current
  row when Enter is pressed on it, or the row double clicked (`fn open (mut self, row: usize)`). A list fits in any
  height, its min-content being 0, as a linear layout that scrolls: a list in a layout that shrinks its children needs a
  `min-height`.
- **A tree view shows the nodes of a model as rows**, a node expanded showing its children under it. A node is named by
  its path, the index of each of its ancestors among the children of the one before then its own, `[]` being the root,
  never shown, whose children are the first level. `setModel` takes a class over `TreeModel`, whose `len (node)` (the
  number of children) and `text (node)` the tree reads on demand, for the root and the nodes expanded and for the rows
  shown only (`TextTreeModel` holds `TreeItem`s, a text and its children). Every node starts collapsed; `expandNode`
  expands a node and its ancestors, `collapseNode` collapses it, forgetting the nodes expanded under it. The rows,
  recycled as in a list view, are its `::row` in the same states, a node having children being preceded by its
  `::marker`, ▸ collapsed and ▾ in the state `:expanded`, in the states of its row as well. A level indents the rows by
  the width of the margin box of the marker, set by its style, so that the leaves line up with the text of their
  siblings having children. A click on the marker, or a double click on the row, expands or collapses the node; the
  rows are selected as in a list view, the rows under a node collapsed being unselected. `on-select` gives the paths of
  the selected nodes in the order of the rows, `on-activate` the path of the current node when Enter is pressed on it,
  or of a leaf double clicked (`fn reached (mut self, node: [usize])`).
- **A table view shows the rows of a model in columns**, under their headers. `setModel` takes a class over
  `TableModel`, whose `len`, `columns`, `header (column)` and `text (row, column)` the table reads on demand, for the
  rows shown only (`TextTableModel` holds the headers and the texts of the cells). The headers are its `::header`, in
  the states `:hover` and `:ascending` or `:descending` for the column the rows are sorted by, whose header is followed
  by ▲ or ▼. The rows are its `::row`, in the states of a list view, and their cells its `::cell`, in the states of
  their row. A click on a header sorts the rows by its column, in increasing order then, on a second click, in
  decreasing order, the selection moving with its rows; `sortBy` and `clearSort` do it by code. The rows equal keep
  their order, and the cells are compared by `compare (a, b, column)`, their texts as people read them unless the model
  knows better: case left aside and the numbers by their value, "Row 9" before "Row 10". The columns share the width of
  the table until a column is resized by dragging the right edge of its header (the cursor showing it) or
  `setColumnWidths` sets them, their widths being kept from then on. Rows wider than the table scroll horizontally with
  Shift and the wheel, or a second `::scrollbar` in the bottom padding, as thick as its `height`. `on-select` gives the
  selected rows of the model in increasing order, whatever their order in the table, and `on-activate` the row of the
  model Enter is pressed on, or the row double clicked.
- **A separator is a rule** a pixel thick across its `direction`, a row (horizontal) by default, drawn with its
  background colour. An auto size stretches it along the layout it is in.
- **An image shows a picture** as the background image of its inline style, so that `image-fill`, `image-keep-ratio`
  and `image-color` apply to it. Sized to its content it is as wide as the picture and as high as the picture scaled
  to its width; its min-content width is 0.

### Keyboard

```
LinearLayout #FORM {
    InputText #NAME;                                    // the order of the tree
    InputText #CODE { tab-index: 1; }                   // focused before the widgets of the index 0
    PushButton #HELP "?" { tab-index: -1; }             // never focused by Tab, clicked all the same
    PushButton #SUBMIT "Submit" { on-click: submit; }   // Enter and Space emit on-click with the left button
}
```

- **Tab moves the focus** to the next widget taking it from the keyboard, Shift-Tab to the previous one, wrapping
  around: the input texts and the spin boxes, the push buttons, menu buttons, check boxes, radio buttons and dropdowns,
  the sliders, the list, tree and table views, and the tab layouts, whose headers come before the content of their
  selected tab. The widgets not drawn (`display: none`, the content of a tab not selected) are left out. Without a focused widget, Tab moves on from the
  widget clicked or focused last.
- **`tab-index` changes the order**, an attribute of every widget: the widgets of a positive index come first, by
  increasing index, then those of the index 0, the default one, in the order of the tree. Tab never focuses a widget of
  a negative index, which a click still focuses. It does not make a widget that takes no focus focusable.
- **The focused widget uses a key first**, the manager using Tab, Shift-Tab, Escape, Up and Down only when it did not:

  | Widget | Keys |
  |---|---|
  | `PushButton` | Enter and Space emit `on-click` with the left button |
  | `CheckBox`, `RadioButton` | Enter and Space check as a click does; the arrows check the radio button of the group before (Up, Left) or after (Down, Right) the focused one, wrapping around, the focus following |
  | `MenuButton` | Enter and Space open its menu, the focus moving to the first widget of the menu |
  | `Dropdown` | Up and Down select the item before or after the selected one, emitting `on-change`; Enter and Space open the list, which takes the focus: Up, Down, Home and End move the item under the keyboard, Enter and Space select it |
  | `ListView` | Up and Down move the current row by a row, Page Up and Page Down by the rows shown, Home and End to the first and the last row, selecting it alone; in a multiple list Shift selects the rows from the one clicked last instead, and Ctrl moves without selecting; Space selects the current row, Ctrl-Space toggles it, Ctrl-A selects every row of a multiple list. The current row is scrolled to, and `on-select` is emitted when the selection changes; Enter emits `on-activate` with the current row |
  | `TreeView` | the keys of a list view; Right expands the current node, or moves to its first child when it is expanded, and Left collapses it, or moves to its parent when it is collapsed |
  | `TableView` | the keys of a list view, over the rows in the order they are shown |
  | `Slider` | the arrows move the value by a step, up for Up and Right; Page Up and Page Down by ten steps; Home and End to `min` and `max` |
  | `SpinBox` | Up and Down move the value by a step, Page Up and Page Down by ten steps, from the number typed; Left and Right move the caret |
  | `TabLayout` | Left and Right select the tab before or after the selected one, wrapping around; Home and End the first and the last one |
  | `InputText` | the keys of the text; Enter and Escape validate it, the focus leaving the input |

- **A group of radio buttons is a single stop**: Tab focuses its checked radio button only, every one of them when none
  is checked.
- **An open menu keeps the focus**: Tab, Shift-Tab, Up and Down move it among the widgets of the menu opened last (the
  list of a dropdown is one), and Escape closes that menu, the focus going back to the widget that opened it. A dialog
  is a window of its own, the window behind it taking no input while it is open.
- **The focused widget is in the state `:focus`**, which the sheets style as a focus ring, a shadow moving nothing:
  `PushButton.submit:focus { shadow: 0 0 0 2 #388bfd; }`, `CheckBox:focus::box { border-color: #388bfd; }`. A linear
  layout that scrolls shows the widget given the focus.
- **A widget type of the application** takes the focus from the keyboard by overriding `isFocusableByKeyboard`, and
  uses keys by overriding `onKeyPressed (key, mods)`, returning true when it used the key. A layout keeping the focus in
  a child overrides `getFocusTrap` and `dismissFocusTrap`, and a layout that scrolls `reveal`.

## The style file

```
$surface: #202328;
$font: "Noto Sans", sans-serif;

LinearLayout.root, LinearLayout.inner {
    background-color: $surface;
}

PushButton.yes::label       { font-family: $font; text-color: #4c98fd; }
PushButton.yes:hover        { background-color: #cccccc; }
PushButton.yes:hover::label { text-color: #2fc49f; }
```

```
sheet       = { import } { constant | font-face | rule | when } ;
import      = "@import" string ";" ;
constant    = "$" ident ":" values ";" ;
font-face   = "@font-face" "{" { declaration } "}" ;
rule        = selector { "," selector } "{" { declaration | rule-when } "}" ;
rule-when   = "@when" "(" condition ")" "{" { declaration } "}" ;
when        = "@when" "(" condition ")" "{" { rule } "}" ;
declaration = ident ":" values ";" ;
selector    = compound { [ ">" ] compound } ;
compound    = [ Type | "*" ] { "#" ident | "." ident | ":" state } [ "::" part { ":" state } ] ;
```

### Selectors

- **A compound is glued**: `PushButton.yes:hover::label`. A space between two compounds means a descendant
  (`.sidebar PushButton`), `>` a direct child, and `,` separates selectors sharing one block.
- **A type**, `#id`, `.class` and `:state` all have to hold. `*` or no type selects every type. The name of a
  component selects the roots of its instances, as their type does.
- **States** are registered by the widget types: `:hover`, `:focus` and `:pressed` (held by a mouse button) for every
  widget, and `:checked` for the check boxes and the radio buttons.
- **Parts** style a piece of a widget, `PushButton::label`, and end their selector. A part with states of its own takes
  them after it: `TabLayout::tab:selected` is the selected tab, `TabLayout:hover::tab` every tab of a hovered layout.
- **Checked at load**: a type, a state, a part or a state of a part that none of the types a compound can select
  registers is an error, as is a property affecting the layout in a rule testing a state (hovering must not move
  anything).

### Cascade

- The rules matching a widget apply by origin (the `@style` sheets of the components, then the sheets of the
  application), then by specificity (ids, then classes, states and parts, then types, summed over the compounds), then
  in the order they were loaded, the later one winning a tie. A rule matching through several of its selectors takes
  the specificity of the most specific one.
- The inherited properties (`text-color`, the `font-*` properties, `text-xalign`, `text-yalign`, `text-wrap`, and those
  a widget type registers as inherited) pass from a widget to its children and to its parts. Set the font once on a
  container.
- The inline style a widget is given by code (`Widget.setInlineStyle`) comes after every rule.

### Constants and imports

- `$name: values;` defines a constant at the top level, used as `$name` in any later value. A constant may use the
  ones defined before it; a tuple or a list it holds is spliced where it is used: with `$pad: 6 14;`, `margin: 0 $pad;`
  is `margin: 0 6 14;`.
- `@import "base.style";` heads a sheet. The imported sheet is read first, in the same scope of constants, and its
  rules come before those of the importing sheet. The path is relative to the importing sheet unless it is qualified
  or absolute. A sheet imported twice is read once; a sheet importing itself is an error naming the chain.

### Fonts

```
@font-face {
    font-family: "Title";
    src: "res:/fonts/noto/NotoSans-Bold.ttf";
    font-weight: 700;     // optional, read from the file when omitted
    font-style: normal;   // optional, read from the file when omitted
}
```

### Conditions

A `@when (condition) { … }` block applies while its condition holds. Inside a rule it holds declarations, which keep the
specificity of the rule and come after its own declarations. At the top level it holds rules, which apply while the
condition holds. Any property can be set, sizes included.

```
$narrow: 560;

LinearLayout.row {
    direction: row;
    @when (width < $narrow) { direction: column; }
}

@when (window.width < 900) {
    LinearLayout.inspector { display: none; }
}

@when (app.mode == edit and not app.read-only) {
    LinearLayout.toolbar { display: normal; }
}
```

| Variable | Value |
|---|---|
| `width`, `height` | the space available to the widget: the content box of its nearest ancestor whose size on that axis is fixed, the window for the root |
| `window.width`, `window.height` | the size of the window, in layout pixels |
| `window.scale` | the display scale, 1.5 on an output scaled to 150% |
| `window.density` | the physical pixels in a layout pixel |
| `window.dpi` | the dots per inch of the display |
| `app.name` | a string, a number or a boolean published by the application: `manager:.setVariable ("mode", "edit")` |

- A test compares a variable to a value with `<` `<=` `>` `>=` `==` `!=`, and tests combine with `and`, `or` (`and`
  binding tighter), `not` and parentheses. A variable alone tests a boolean: true, a number other than 0, a string
  other than `""`.
- Numbers compare to numbers, without a unit or in `px`. Strings and booleans compare to keywords and strings with `==`
  and `!=` (`app.mode == edit`, `app.compact == true`). A variable that is not set, or a value of another kind than the
  variable, makes its test false.
- A variable other than these, a percentage, a value that is neither a number, a keyword nor a string, an order
  between strings, or a keyword compared to `width`, `height` or a variable of the window, is an error at load.
- An ancestor's size is fixed on an axis when it does not depend on its content: the root, a size in `px`, a percentage
  or an `auto` size stretched in an ancestor of a fixed size (across a linear layout, both sides set in a floating
  layout), the content of a tab or of a menu layout, a pane of a splitter across its axis, or along it when its
  `min-width` (`min-height`) is a length. A condition never measures what it can change.
- A resize, a change of scale or a `setVariable` styles again the widgets matched by rules reading that variable, then
  lays them out again.

`display: none` takes a widget out of the layout (it takes no space, its margins included) and out of the drawing, with
its descendants; `display: normal`, the default, puts it back. A widget hidden by code (`Widget.hide`) stays hidden
whatever its style says.

## Values

Both files read the right-hand side of `name: …;` with the same grammar. The attribute or the property decides which
kind of value it expects.

| Kind | Syntax | Examples |
|---|---|---|
| number | integer or decimal, leading digit required | `0.5` `700` |
| length | a number, in `px` when it has no unit, or a percentage of the parent's content box | `12` `12px` `40%` |
| size | a length, `auto`, `min-content` or `max-content` | `width: max-content` |
| track | a length, a share of the free space in `fr`, or a size keyword | `columns: 1fr 2fr 120` |
| colour | see below | `#388bfd` `steelblue / 40%` |
| string | double quotes | `"Noto Sans"` |
| keyword | an identifier from the property's own set | `row` `bold` `center` |
| tuple | values separated by spaces | `padding: 6 14` `border: 2 $edge` `cell: 1 0` |
| list | values separated by commas | `"DejaVu Sans Mono", monospace` |
| constant | `$name` | `$accent` |
| slot | a slot name, a path of names, optionally with bound arguments, or `none` | `quit` `form::submit` `describe ("…")` |

Shorthands follow the order of CSS: one value for every side, two for vertical then horizontal, three for top,
horizontal then bottom, four clockwise from the top. A longhand after a shorthand overrides its side:
`padding: 6; padding-left: 20;`.

### Sizes

Sizes mean what they mean in CSS, so that the number written is the size seen:

- **`width` and `height` are the border box**: the content, the paddings and the borders. The margins sit outside it:
  `width: 120; margin: 4;` draws a box 120 wide that takes 128 in its parent.
- **A percentage is a part of the parent's content box** on the same axis, for the sizes, their bounds, the margins,
  the paddings and the positions alike. While a parent sized by its content measures it, a percentage size stands for
  `auto` and a percentage margin or padding for 0.
- **Unset is `auto`**, resolved by the parent:

  | Parent | Along its axis | Across it |
  |---|---|---|
  | `LinearLayout`, `Splitter` | the size of the content, its max-content, shrinking down to its min-content | stretched to the layout |
  | `GridLayout` | stretched to the cell | stretched to the cell |
  | `FloatingLayout` | the size of the content, fitted in the layout; `left` and `right` both set give the width, `top` and `bottom` the height | |
  | window, tab page, `MenuLayout` | stretched | stretched |

  A size that is not auto is placed at the start of the space its parent gives it.
- **The bounds are properties of their own**: `min-width`, `max-width`, `min-height` and `max-height` take a length,
  `min-content` or `max-content`, and each cascades on its own. An unset lower bound is `auto`: the min-content along
  the axis of a linear layout or a splitter, so that a text is never cut mid-word, and 0 elsewhere. An unset upper
  bound is `none`.
- **A size along the axis of a linear layout is a preferred size**: `width: 120` is a flex basis of 120 that shrinks
  down to its `min-width` when the line overflows. `flex: none` keeps it rigid, and `flex: 1` (grow 1, shrink 1,
  basis 0) shares the free space.
- **A floating child** is placed by `left`, `top`, `right` and `bottom` from the sides of the layout's content box, at
  its top left corner when it sets none, against the right (or the bottom) side when it sets only that one.

### Colours

Colours are written as in CSS:

- `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`;
- the 148 named colours of CSS (`black`, `white`, `steelblue`, `rebeccapurple`, …) and `transparent`;
- `rgb()` and `hsl()`, with their arguments separated by spaces and the opacity after a `/`, `rgb(56 139 253 / 40%)`,
  `hsl(214 98% 61%)`, or by commas with the opacity last, `rgba(56, 139, 253, 0.4)`. A channel of `rgb()` is a number
  from 0 to 255 or a percentage; the hue of `hsl()` is in degrees, its saturation and lightness percentages. `rgba()`
  and `hsla()` are the same functions.

Any colour may be followed by `/` and an opacity, a number from 0 to 1 or a percentage, which replaces its own:
`$accent / 40%`, `black / 0.6`. This is the one extension to CSS, to fade a constant.

<!-- Generated by `gyllir run reference` from the widget registry and the property table: do not edit below. -->

## Widget types

The attributes of a type are set in the block of a node, `max-length: 64;`, its default attribute by the value after the selector, `Label "Name";`. The attributes of the children are set on a child by its parent's type, `tab: "Form";`. The signals are connected to the slots the code registers, `on-click: submit;`, the slot taking the arguments bound to it then the payload of the signal. The properties are style properties the type reads beyond the common ones.

### `Box`

- **Attributes:** `tab-index`: an integer
- **Default attribute:** none
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** none
- **Properties:** none

### `CheckBox`

- **Attributes:** `tab-index`: an integer; `text`: a string; `checked`: true or false
- **Default attribute:** `text`
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`, `on-toggle` (bool)
- **States:** `hover`, `focus`, `pressed`, `checked`
- **Parts:** `label`, `box`, `mark`
- **Properties:** none

### `Dropdown`

- **Attributes:** `tab-index`: an integer; `items`: strings separated by commas; `selected`: an integer of 0 or more
- **Default attribute:** `items`
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`, `on-change` (usize)
- **States:** `hover`, `focus`, `pressed`
- **Parts:** `label`, `popup`, `item` (states `hover`, `selected`), `scrollbar` (states `hover`, `pressed`)
- **Properties:** none

### `FloatingLayout`

- **Attributes:** `tab-index`: an integer
- **Default attribute:** none
- **Children:** any number
- **Attributes of the children:** `capture-events`: true or false
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** none
- **Properties:** none

### `FrameGraph`

- **Attributes:** `tab-index`: an integer; `frames`: an integer of 0 or more
- **Default attribute:** none
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** `cpu`, `gpu`, `memory`
- **Properties:** none

### `GridLayout`

- **Attributes:** `tab-index`: an integer
- **Default attribute:** none
- **Children:** any number
- **Attributes of the children:** `cell`: two integers of 0 or more
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** none
- **Properties:** `columns`: one or more tracks: lengths in px or %, shares in fr, auto, min-content or max-content; `rows`: one or more tracks: lengths in px or %, shares in fr, auto, min-content or max-content

### `Image`

- **Attributes:** `tab-index`: an integer; `src`: a string
- **Default attribute:** `src`
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** none
- **Properties:** none

### `InputText`

- **Attributes:** `tab-index`: an integer; `text`: a string; `max-length`: an integer of 0 or more; `only-numbers`: true or false
- **Default attribute:** `text`
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`, `on-validate` ([c8])
- **States:** `hover`, `focus`, `pressed`
- **Parts:** `label`, `selection`, `cursor`
- **Properties:** none

### `Label`

- **Attributes:** `tab-index`: an integer; `text`: a string
- **Default attribute:** `text`
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** none
- **Properties:** none

### `LinearLayout`

- **Attributes:** `tab-index`: an integer
- **Default attribute:** none
- **Children:** any number
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** `scrollbar` (states `hover`, `pressed`)
- **Properties:** `direction`: row or column; `overflow`: hidden or scroll; `scroll-speed`: a number of 0 or more

### `ListView`

- **Attributes:** `tab-index`: an integer; `multiple`: true or false
- **Default attribute:** none
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`, `on-select` ([usize]), `on-activate` (usize)
- **States:** `hover`, `focus`, `pressed`
- **Parts:** `row` (states `hover`, `selected`, `current`), `scrollbar` (states `hover`, `pressed`)
- **Properties:** none

### `MenuButton`

- **Attributes:** `tab-index`: an integer; `text`: a string; `open-on-hover`: true or false
- **Default attribute:** `text`
- **Children:** its popup, optional
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** `label`
- **Properties:** `popup-align`: left, center or right, then top, center or bottom

### `MenuLayout`

- **Attributes:** `tab-index`: an integer
- **Default attribute:** none
- **Children:** its bar then its content
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`, `on-menu-open`, `on-menu-close`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** none
- **Properties:** none

### `ProgressBar`

- **Attributes:** `tab-index`: an integer; `value`: a number; `min`: a number; `max`: a number
- **Default attribute:** `value`
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** `fill`
- **Properties:** `direction`: row or column

### `PushButton`

- **Attributes:** `tab-index`: an integer; `text`: a string
- **Default attribute:** `text`
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`, `on-double-click`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** `label`
- **Properties:** none

### `RadioButton`

- **Attributes:** `tab-index`: an integer; `text`: a string; `checked`: true or false; `group`: a string
- **Default attribute:** `text`
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`, `on-toggle` (bool)
- **States:** `hover`, `focus`, `pressed`, `checked`
- **Parts:** `label`, `box`, `mark`
- **Properties:** none

### `Scene3D`

- **Attributes:** `tab-index`: an integer; `resolution`: two integers of 0 or more; `post`: effects separated by commas, each a kind followed by its parameters, numbers and texts, `off` adding it disabled: `vignette(0.5), lut("res:/lut/neutral.png"), invert(off)`
- **Default attribute:** none
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** none
- **Properties:** none

### `Separator`

- **Attributes:** `tab-index`: an integer
- **Default attribute:** none
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** none
- **Properties:** `direction`: row or column

### `Slider`

- **Attributes:** `tab-index`: an integer; `value`: a number; `min`: a number; `max`: a number; `step`: a number
- **Default attribute:** `value`
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`, `on-change` (f32)
- **States:** `hover`, `focus`, `pressed`
- **Parts:** `track`, `fill`, `thumb`
- **Properties:** `direction`: row or column

### `SpinBox`

- **Attributes:** `tab-index`: an integer; `value`: a number; `min`: a number; `max`: a number; `step`: a number; `decimals`: an integer of 0 or more
- **Default attribute:** `value`
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`, `on-change` (f32)
- **States:** `hover`, `focus`, `pressed`
- **Parts:** `label`, `selection`, `cursor`, `up` (states `hover`, `pressed`), `down` (states `hover`, `pressed`)
- **Properties:** none

### `Splitter`

- **Attributes:** `tab-index`: an integer
- **Default attribute:** none
- **Children:** any number
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** `grip` (states `hover`), `bbox`
- **Properties:** `direction`: row or column

### `TabLayout`

- **Attributes:** `tab-index`: an integer
- **Default attribute:** none
- **Children:** at least 1
- **Attributes of the children:** `tab`: a string, required
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`
- **States:** `hover`, `focus`, `pressed`
- **Parts:** `tab` (states `hover`, `selected`)
- **Properties:** none

### `TableView`

- **Attributes:** `tab-index`: an integer; `multiple`: true or false
- **Default attribute:** none
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`, `on-select` ([usize]), `on-activate` (usize)
- **States:** `hover`, `focus`, `pressed`
- **Parts:** `header` (states `hover`, `ascending`, `descending`), `row` (states `hover`, `selected`, `current`), `cell` (states `hover`, `selected`, `current`), `scrollbar` (states `hover`, `pressed`)
- **Properties:** none

### `TreeView`

- **Attributes:** `tab-index`: an integer; `multiple`: true or false
- **Default attribute:** none
- **Children:** none
- **Attributes of the children:** none
- **Signals:** `on-click` (u8), `on-focus`, `on-blur`, `on-select` ([[usize]]), `on-activate` ([usize])
- **States:** `hover`, `focus`, `pressed`
- **Parts:** `row` (states `hover`, `selected`, `current`), `marker` (states `hover`, `selected`, `current`, `expanded`), `scrollbar` (states `hover`, `pressed`)
- **Properties:** none

## Style properties

Every widget reads these properties. An inherited property passes from a widget to its children and its parts. A property affecting the layout lays the interface out again when it changes, and a rule testing a state cannot set it. A shorthand sets its longhands, which cascade separately.

| Property | Value | Inherited | Layout |
|---|---|---|---|
| `color` | a colour |  |  |
| `background-color` | a colour |  |  |
| `selection-color` | a colour |  |  |
| `text-color` | a colour | yes |  |
| `font-family` | font families separated by commas | yes | yes |
| `font-size` | a length in px | yes | yes |
| `font-weight` | normal, bold, or a weight from 1 to 1000 | yes | yes |
| `font-style` | normal, italic or oblique | yes | yes |
| `text-xalign` | left, center or right | yes |  |
| `text-yalign` | top, center or bottom | yes |  |
| `text-wrap` | wrap or nowrap | yes | yes |
| `image` | a string |  |  |
| `image-color` | a colour |  |  |
| `image-fill` | true or false |  |  |
| `image-keep-ratio` | true or false |  |  |
| `border-top-width` | a length in px |  | yes |
| `border-right-width` | a length in px |  | yes |
| `border-bottom-width` | a length in px |  | yes |
| `border-left-width` | a length in px |  | yes |
| `border-width` | 1 to 4 lengths in px, in the order of CSS, setting `border-top-width`, `border-right-width`, `border-bottom-width`, `border-left-width` |  | yes |
| `border-color` | a colour |  |  |
| `radius-top-left` | a length in px |  |  |
| `radius-top-right` | a length in px |  |  |
| `radius-bottom-right` | a length in px |  |  |
| `radius-bottom-left` | a length in px |  |  |
| `radius` | 1 to 4 lengths in px, clockwise from the top left corner, in the order of CSS, setting `radius-top-left`, `radius-top-right`, `radius-bottom-right`, `radius-bottom-left` |  |  |
| `border` | a width in px and a colour, in any order, either one optional, setting `border-width`, `border-color` |  | yes |
| `shadow` | none, or an offset to the right and to the bottom, an optional blur and spread in px, and a colour |  |  |
| `margin-top` | a length, in px or % |  | yes |
| `margin-right` | a length, in px or % |  | yes |
| `margin-bottom` | a length, in px or % |  | yes |
| `margin-left` | a length, in px or % |  | yes |
| `margin` | 1 to 4 lengths, in px or %, in the order of CSS, setting `margin-top`, `margin-right`, `margin-bottom`, `margin-left` |  | yes |
| `padding-top` | a length, in px or % |  | yes |
| `padding-right` | a length, in px or % |  | yes |
| `padding-bottom` | a length, in px or % |  | yes |
| `padding-left` | a length, in px or % |  | yes |
| `padding` | 1 to 4 lengths, in px or %, in the order of CSS, setting `padding-top`, `padding-right`, `padding-bottom`, `padding-left` |  | yes |
| `width` | a length, in px or %, auto, min-content or max-content |  | yes |
| `height` | a length, in px or %, auto, min-content or max-content |  | yes |
| `min-width` | a length, in px or %, auto, min-content or max-content |  | yes |
| `max-width` | a length, in px or %, none, min-content or max-content |  | yes |
| `min-height` | a length, in px or %, auto, min-content or max-content |  | yes |
| `max-height` | a length, in px or %, none, min-content or max-content |  | yes |
| `left` | a length, in px or % |  | yes |
| `top` | a length, in px or % |  | yes |
| `right` | a length, in px or % |  | yes |
| `bottom` | a length, in px or % |  | yes |
| `flex-grow` | a number of 0 or more |  | yes |
| `flex-shrink` | a number of 0 or more |  | yes |
| `flex-basis` | a length, in px or %, auto, min-content or max-content |  | yes |
| `flex` | a number, none, auto, or a grow, a shrink and a basis, setting `flex-grow`, `flex-shrink`, `flex-basis` |  | yes |
| `display` | none or normal |  | yes |
