# Balder GUI v2 syntax

**Status:** proposal for BAL-24 (epic BAL-25, the component format and the style engine). The open questions of
[§10](#10-open-questions) are to be settled before BAL-21, BAL-22 and BAL-23 start.

One value grammar shared by `.gui` and `.style`, a structure file that only says what exists, a size model where every
length lives in the style sheet and means what it reads like, components, signals bound by name, and conditional rules.

| Question | Proposal | Status |
|---|---|---|
| Where do sizes live? | Every size and position of the layout in `.style`. The render resolution of a `Scene3D` stays in the `.gui`: it is the size the scene is rendered at before being scaled to the widget, not a layout size ([§3](#3-the-structure-file)). | Proposed |
| What do sizes mean? | CSS semantics: `width` is the border box, margins sit outside it, `%` is of the parent, unset means `auto` (sized to the content along a layout's axis, stretched across it). | Proposed |
| Layouts that change with the space? | BAL-53's `flex-wrap`, `justify-content`, `align-items` and `gap`, plus `@when (…)` blocks testing the available space, the window (size, scale, density, dpi) and variables published by the application. | Proposed |
| Two files or one? | Keep two, with one lexer and one value grammar. | Proposed |
| What replaces `(class: "x", orientation: horizontal)`? | `Type #id .class "default value" { attr: value; children }`. Ids are optional. | Proposed |
| Inline styles in `.gui`? | No. Every visual property is reachable from a selector, `#id` included. | Open |
| Variables? | `$name: value;` constants at the top of a sheet, shared through `@import`. Text and font properties are inherited, which removes most of the repetition on its own. | Open |
| Reusable groups of widgets? | `@component Name ($param, …) { root }` in a `.gui`, used like any widget type, with `@slot` for the children of an instance. A component can take a Ymir class as its root to get behaviour. | Proposed |
| Connecting signals? | `on-click: quit;` in the `.gui` names a slot that the code registered under that name. The loader connects and type-checks every signal at load, and again on reload. | Proposed |
| How does a new widget plug in? | It registers its attributes, default attribute, signals, child slots, states and parts. The parsers never name a widget type. | Proposed |

## 1. What goes in which file

Today the boundary is accidental. A floating child takes its position, `(x: 12, y: 12)`, in the `.gui`, while every
other size and margin is in the `.style`. One rule settles it:

> A `.gui` says what exists, what it says and how it behaves. A `.style` says how it looks and where it goes. If a
> value sizes or places a widget in the layout, it belongs in the style.
>
> A test for edge cases: could a second theme reasonably want a different value? Then it is style. Would code reading
> the widget notice the change? Then it is structure.

**`.gui`, structure:**

- the widget tree, types and ids
- classes (the hooks for the style)
- text content: labels, buttons, tab titles
- behaviour: `max-length`, `only-numbers`, `open-on-hover`, `capture-events`
- signals: which slot each one calls
- slots: which tab, which grid cell
- render settings: the resolution a `Scene3D` renders at

**`.style`, presentation:**

- every length: `width`, `height`, their `min-`/`max-` bounds, `margin`, `padding`, `border`, `gap`, `left`/`top`
- flex: `flex`, `direction`, `flex-wrap`, alignment, grid tracks
- colours, fonts, text alignment and wrapping
- overflow and scrolling
- visibility by condition: `display` in `@when`

## 2. Sizes

Sizes are the part that is hard to manage today, and changing the spelling alone will not fix that. Most of the
difficulty comes from what the values mean.

### What makes them hard today

- **A pixel size is a clamp in disguise.** `width: 120` builds `WidgetSize(relative 1.0, min 120, max 120)`, which
  means 100% of the parent clamped to exactly 120. It can never shrink or grow. To get "120 that may shrink to 80" you
  have to write `{ relative: 1; min: 80; max: 120; }`. (`widget/alignement.yr`, `WidgetSize(pix)`)
- **Unset means "all of the parent".** An unset size is `relative: 1.0`, so every child of a column asks for the whole
  height and the children shrink into equal shares. Any widget that should be as tall as its content has to say so:
  `gallery.style` writes `height: auto` 11 times and `width: max-content` 6 times. (`style/implem.yr`, size defaults)
- **The width includes the margins.** `resolveWidth` returns "the outer width, margins included". With
  `width: 120; margin: 4;` the visible box is 112 wide, and adding a border or padding shrinks the content again. The
  number you write is never the size you see. (`widget.yr`, `resolveWidth`, `computePostMarginSize`)
- **Relative margins are a part of the widget itself.** `getSides` resolves a relative margin or padding against the
  widget's own outer size. So `margin-left: { relative: 0.4; }` in the dialog is 40% of the button row, not of the
  dialog. Relative widths, on the other hand, are parts of the parent. (`widget.yr`, `getSides`)
- **Bounds are pixels only, and only inside a block.** `min` and `max` exist only inside `width: { … }`, in pixels.
  "At least as wide as its longest word", or "at most 80% of the window", cannot be said. A theme cannot override only
  the bound, because the whole block is one value. (`style/parser.yr`, `readComplexSize`)
- **"Fill the rest" takes two properties.** A filler is `flex-grow: 1; flex-basis: 0;`, four times in the gallery. A
  forgotten `flex-basis: 0` keeps the 100% default basis and silently changes how space is shared.
  (`widget/layout/linear.yr`, flex items)

### The model

Take CSS's sizing semantics wholesale, since the parser already borrows CSS's property names and BAL-44 already
implemented the CSS flex algorithm. Readers then bring correct intuitions with them.

- **`width` and `height` are the border box**: border, padding and content. Margins are added outside. What you write
  is the box you see: `width: 120; margin: 4;` draws a box 120 wide that takes 128 in its parent (112 and 120 today).
- **A length is `12`, `12px` or `40%`.** A bare number is `px`, a logical pixel as today (the layout already divides
  by the display scale). `%` is always of the parent's content box on the same axis, for widths, heights, bounds,
  margins, paddings and positions alike.
- **Unset is `auto`**, resolved by the parent (table below). Along a layout's axis that means "as big as my content".
  Fillers are the exception and say `flex: 1`.
- **Bounds are their own properties**: `min-width`, `max-width`, `min-height`, `max-height`. Each takes any length or
  `min-content`/`max-content`, and each cascades separately.
- **A fixed size is a preferred size.** `width: 120` is a flex basis of 120 that can shrink down to its `min-width` (by
  default its min-content, so text is never cut mid-word). A size that must never move says `flex: none`.
- **One shorthand for flex**: `flex: 1` (grow 1, shrink 1, basis 0), `flex: none` (0 0 auto), or `flex: 2 1 120`
  spelled out.

What `auto` resolves to:

| Parent | Along its axis | Across its axis |
|---|---|---|
| `LinearLayout`, `Splitter` | content size: max-content, shrinking down to min-content | stretched to the layout |
| `GridLayout` cell | stretched to the cell, the tracks being sized by `columns`/`rows` | |
| `FloatingLayout` | content size, placed by `left`/`top`/`right`/`bottom`; `left` and `right` both set give the width | |
| single-child containers: window, tab page, menu root | stretched to the container | |

### The gallery, before and after

Today:

```
LinearLayout .sidebar {
    background-color: #161b22;
    width: {
        relative: 0.2;
        min: 160;
        max: 360;
    }
}

Box .fill {
    background-color: #000000 : 0;
    border-color: #000000 : 0;
    flex-grow: 1;
    flex-basis: 0;
}

LinearLayout .row {
    background-color: #0d1117;
    height: auto;
}

PushButton .chip {
    background-color: #21262d;
    border-color: #30363d;
    border: 1;
    margin: 4;
    padding-left: 14;
    padding-right: 14;
    padding-top: 6;
    padding-bottom: 6;
    width: max-content;
}

Label .fps {
    padding: 6;
    width: max-content;
    height: max-content;
}
// and in gallery.gui:
// (x: 12, y: 12, capture-events: false) Label FPS …
```

v2:

```
LinearLayout.sidebar {
    background-color: $panel;
    width: 20%;
    min-width: 160;
    max-width: 360;
}

Box.fill {
    background-color: transparent;
    flex: 1;
}

LinearLayout.row {
    background-color: $page;
    direction: row;
    // height: auto is the default
}

PushButton.chip {
    background-color: $raised;
    border: 1 $edge;
    margin: 4;
    padding: 6 14;
    // auto along a row: as wide as its text
}

Label.fps {
    left: 12;
    top: 12;
    padding: 6;
    // auto in a floating layout: its content size
}
```

### Wrapping and alignment

BAL-53 specifies the half of flex that BAL-44 left out: `justify-content`, `align-items` and `align-self`, `gap`, and
`flex-wrap` with `align-content`. v2 takes these properties unchanged, written with the sizes above. With them, a
layout changes shape as its space changes. For example, an input followed by Yes and No:

```
LinearLayout .prompt {
    InputText #ANSWER .answer;
    LinearLayout .choices {
        PushButton #YES .yes "Yes";
        PushButton #NO .no "No";
    }
}
```

```
LinearLayout.prompt {
    direction: row;
    flex-wrap: wrap;
    gap: 8;
}

InputText.answer {
    flex: 1 1 240;     // at least 240 on its line, then the free space
}

LinearLayout.choices {
    direction: row;
    flex-wrap: wrap;
    gap: 8;
}

PushButton.yes, PushButton.no { min-width: 90; }
```

| Width of `.prompt` | Layout |
|---|---|
| under 188 (Yes, gap, No) | top to bottom: the input, then Yes, then No |
| under 436 (240, gap, both buttons) | the input alone at full width; Yes and No together below it, on the left |
| wider | one row: the input grows and pushes Yes and No to the right edge |

Adding `justify-content: end` to `.prompt` also puts Yes and No on the right when they are on their own line. Wrapping
switches layout when the content stops fitting, so the thresholds come from the bases and minimum sizes. To switch at
a width you choose, use `@when` ([§4](#conditional-rules-when)).

## 3. The structure file

A node is its type, then the selector that will match it, then an optional default value, then either `;` or a block.
The head of a node reads like the selector that styles it. Inside a block, `name: value;` is an attribute and anything
starting with a type name is a child. Two tokens of lookahead tell them apart.

```
document  = node ;
node      = Type { "#" ident | "." ident } [ value ] ( ";" | "{" { member } "}" ) ;
member    = attribute | node ;
attribute = ident ":" values ";" ;           (* values: the shared grammar, §5 *)
```

`res/dialog/message.gui` today:

```
LinearLayout FL (class: "root") {
    Label QUESTION (class: "question") { "HELLO?" }
    LinearLayout F2 (class: "inner", orientation: horizontal) {
        PushButton YES (class: "yes") { "Yes" }
        PushButton NO (class: "no") { "No" }
    }
}
```

v2:

```
LinearLayout #FL .root {
    Label #QUESTION .question "HELLO?";
    LinearLayout #F2 .inner {
        PushButton #YES .yes "Yes";
        PushButton #NO .no "No";
    }
}
```

### Rules that keep it short

- **Default attribute.** Each widget names one attribute that a bare value after the selector sets: `text` for
  `Label`, `PushButton`, `MenuButton` and `InputText`. `Label .heading "Form";` needs no block.
- **Ids are optional.** Only the widgets the code looks up need one. An anonymous widget adds no segment to a `find`
  path, so `find("BODY/MAIN/TABS/FORM/NAME")` reaches the input through an unnamed row. Two named widgets reachable by
  the same path are a load error.
- **Slots belong to the parent.** A container declares the attributes its children may carry: `tab: "Form";` under a
  `TabLayout`, `cell: 1 0;` under a `GridLayout`, `capture-events: false;` under a `FloatingLayout`. They replace the
  `("Form")` and `(x: 0, y: 0)` prefixes. A grid child without `cell` takes the next free cell, row by row.
- **One string syntax**: double quotes. Classes go after a dot, several being written `.chip .primary`; there are no
  combinators in a `.gui`, so spaces are harmless here.

`example/gallery/gallery.gui` today (excerpt):

```
MenuLayout ROOT (class: "root") {
    LinearLayout BAR (class: "bar", orientation: horizontal) {
        MenuButton FILE (class: "menu") {
            "File";
            LinearLayout FILE_MENU (class: "popup") {
                PushButton NEW (class: "item") { "New page" }
                PushButton QUIT (class: "item") { "Quit" }
            }
        }
        Box BAR_FILL (class: "fill");
        Label CLOCK (class: "clock") { "0 fps" }
    }

    LinearLayout BODY (class: "body") {
        Splitter MAIN (class: "main", orientation: horizontal) {
            TabLayout TABS (class: "tabs") {
                ("Form") LinearLayout FORM (class: "page") {
                    Label FORM_TITLE (class: "heading") { "Tell us about yourself" }
                    LinearLayout NAME_ROW (class: "row", orientation: horizontal) {
                        Label NAME_LABEL (class: "field") { "Name" }
                        InputText NAME (class: "input", len: 64);
                    }
                    LinearLayout AGE_ROW (class: "row", orientation: horizontal) {
                        Label AGE_LABEL (class: "field") { "Age" }
                        InputText AGE (class: "input", len: 3, only-numbers: true);
                    }
                }

                ("3D scene") FloatingLayout SCENE_PAGE (class: "scene-page") {
                    (x: 0, y: 0) Scene3D SCENE (class: "scene", w: 1280, h: 720);
                    (x: 12, y: 12, capture-events: false) Label FPS (class: "fps") { "0 fps" }
                }

                ("Layouts") LinearLayout LAYOUTS (class: "page") {
                    GridLayout GRID (class: "grid", columns: 3, rows: 2) {
                        (0, 0) Box CELL_A (class: "cell-a");
                        (1, 0) Label CELL_B (class: "cell") { "(1, 0)" }
                        (2, 0) Box CELL_C (class: "cell-b");
                    }
                }
            }
        }
    }
}
```

v2:

```
MenuLayout #ROOT .root {
    LinearLayout #BAR .bar {
        MenuButton #FILE .menu "File" {
            LinearLayout #FILE_MENU .popup {
                PushButton #NEW .item "New page";
                PushButton #QUIT .item "Quit";
            }
        }
        Box .fill;
        Label #CLOCK .clock "0 fps";
    }

    LinearLayout #BODY .body {
        Splitter #MAIN .main {
            TabLayout #TABS .tabs {
                LinearLayout #FORM .page {
                    tab: "Form";
                    Label .heading "Tell us about yourself";
                    LinearLayout .row {
                        Label .field "Name";
                        InputText #NAME .input { max-length: 64; }
                    }
                    LinearLayout .row {
                        Label .field "Age";
                        InputText #AGE .input { max-length: 3; only-numbers: true; }
                    }
                }

                FloatingLayout #SCENE_PAGE .scene-page {
                    tab: "3D scene";
                    Scene3D #SCENE .scene { resolution: 1280 720; }
                    Label #FPS .fps "0 fps" { capture-events: false; }
                }

                LinearLayout #LAYOUTS .page {
                    tab: "Layouts";
                    GridLayout #GRID .grid {
                        Box .cell-a;
                        Label .cell "(1, 0)";
                        Box .cell-b;
                    }
                }
            }
        }
    }
}
```

**The `Scene3D` resolution.** `w: 1280, h: 720` is the size of the render target, not of the widget. The scene is
rendered into a texture at that resolution, and the texture is then scaled up or down to the widget. Choosing that
resolution is the point: it trades image quality against rendering cost, whatever size the widget ends up at. It is a
property of the scene, not a layout size, so it stays in the `.gui`, renamed `resolution: 1280 720;` to say what it
is. The widget's own size is styled like any other widget's.

## 4. The style file

The property syntax is already CSS-shaped and stays. Two things change: selectors use CSS order and meaning, and the
sheet gets constants, imports, inheritance and conditions.

- **Compound selectors are glued**, in CSS order: `PushButton.yes:hover::label` instead of
  `PushButton :hover ::label .yes`. A space now means a descendant (`.sidebar PushButton`), `>` a direct child, `,` a
  list of selectors sharing one block. `#id` selects one widget.
- **States are named, not positional.** `:hover`, `:focus`, `:check` today, registered by the widgets so `:pressed` or
  `:disabled` come without touching the parser. Several states in one compound all have to hold, as in CSS; today they
  are alternatives.
- **Parts** (`::label`, `::grip`, `::bbox`, `::tab`, `::selection`, `::cursor`) are registered by their widget the same
  way. A part that has states of its own takes them after it, as CSS's `::part(tab):hover`:
  `TabLayout::tab:selected` is the selected tab, `TabLayout:hover::tab` every tab of a hovered layout. A part ends its
  selector.
- **Checked against the registry.** A type, a state, a part or a state of a part that none of the types a compound can
  select registers is an error at load, located at the compound. A rule testing a state, on the widget, a part or an
  ancestor, cannot set a property that affects the layout: hovering must not move anything (BAL-44).
- **Specificity** is CSS's (ids, then classes, states and parts, then types, summed over the compounds), later rules
  winning ties. A rule listing several selectors takes the specificity of the most specific one that matches. The
  sheets of the application win over the `@style` sheets of the components ([§8](#8-components)) whatever their
  specificity.
- **Inherited properties**: `text-color`, the `font-*` properties, `text-xalign`, `text-yalign` and `text-wrap`, and
  the properties a widget type registers as inherited, pass from a widget to its children and parts. Set the font once
  on the root.
- **Computed once.** A widget keeps its computed style, computed again when it is attached, when one of its states or
  classes changes, and when a sheet is loaded. Its descendants follow when they inherit a property that changed, or
  when a rule tests that state on an ancestor. Only a change of a property that affects the layout lays the interface
  out again: a `:hover` colour is repainted, not laid out.

```
sheet       = { directive | constant | rule | when } ;
directive   = "@" ident ( "{" { declaration } "}" | values ";" ) ;    (* @font-face, @import *)
constant    = "$" ident ":" values ";" ;
rule        = selector { "," selector } "{" { declaration | when } "}" ;
when        = "@when" "(" condition ")" "{" { declaration | rule } "}" ;  (* rules at the top level *)
condition   = test { ( "and" | "or" ) test } ;
test        = "not" test | "(" condition ")" | variable [ compare value ] ;
variable    = ident { "." ident } ;
compare     = "<" | "<=" | ">" | ">=" | "==" | "!=" ;
selector    = compound { [ ">" ] compound } ;                        (* a space: a descendant *)
compound    = [ Type | "*" ] { "#" ident | "." ident | ":" state } [ "::" part { ":" state } ] ;
declaration = ident ":" values ";" ;
```

`res/dialog/default.style` today, 82 lines:

```
LinearLayout .root {
    background-color: #202328;
}

LinearLayout .inner {
    background-color: #202328;
    margin-left: {
        relative: 0.4;
    }
    margin-right: 10;
    height: 60;
}

Label .question {
    text-color: #eeeff2;
    font-family: "Noto Sans", sans-serif;
    font-size: 22;
    text-xalign: center;
    margin-top: 10;
    height: auto;
}

PushButton .yes {
    background-color: #22252a;
    border-color: #4a5259;
    border: 2;
    margin: 10;
    width: {
        relative: 0.5;
    }
}

PushButton :hover .yes {
    background-color: #cccccc;
    border-color: #ffffff;
}

PushButton ::label .yes {
    text-color: #4c98fd;
    font-family: "Noto Sans", sans-serif;
    font-size: 20;
}

PushButton :hover ::label .yes {
    text-color: #2fc49f;
    font-family: "Noto Sans", sans-serif;
    font-size: 20;
}

// … and the same four rules again for .no
```

v2, 43 lines:

```
$surface: #202328;
$button:  #22252a;
$edge:    #4a5259;

FloatingLayout.root { background-color: grey!10; }

LinearLayout.root, LinearLayout.inner {
    background-color: $surface;
}

LinearLayout.root {
    font-family: "Noto Sans", sans-serif;
    font-size: 20;             // inherited by every text below
}

LinearLayout.inner {
    direction: row;
    height: 60;
    margin-left: 40%;
    margin-right: 10;
}

Label.question {
    text-color: #eeeff2;
    font-size: 22;
    text-xalign: center;
    margin-top: 10;
}

PushButton.yes, PushButton.no {
    background-color: $button;
    border: 2 $edge;
    margin: 10;
    flex: 1;
}

PushButton.yes::label       { text-color: #4c98fd; }
PushButton.yes:hover        { background-color: #cccccc; border-color: #ffffff; }
PushButton.yes:hover::label { text-color: #2fc49f; }

PushButton.no::label        { text-color: #f1bcbd; }
PushButton.no:hover         { background-color: red!40; border-color: grey!70; }
PushButton.no:hover::label  { text-color: black; }
```

The hover rules shrink to their differences because a state rule now cascades over the base rule instead of replacing
it. Today the `:hover ::label` rules repeat the font so the label keeps it while hovered.

### Conditional rules: `@when`

A `@when (condition) { … }` block applies only while its condition holds. Inside a rule it holds declarations for the
widgets the rule matches. At the top level it holds whole rules. Conditions read variables from the layout, from the
window, and from the application.

```
$narrow: 500;

LinearLayout.prompt {
    direction: row;
    flex-wrap: wrap;

    @when (width < $narrow) {
        direction: column;          // stacked below 500, whatever fits
    }
}

@when (window.width < 800) {
    LinearLayout.inspector { display: none; }
    Label.status { font-size: 12; }
}

@when (window.density >= 2) {
    Box.logo { image: "res:/images/logo@2x.png"; }
}

@when (app.mode == edit and not app.read-only) {
    LinearLayout.toolbar { display: normal; }
}
```

The variables:

| Variable | Read from | Meaning |
|---|---|---|
| `width`, `height` | the layout | the space available to the widget: the content box of its nearest ancestor whose size on that axis does not depend on its content, or the window if there is none |
| `window.width`, `window.height` | `ShapeDrawer.getDimension ()` | the size of the window in layout pixels, the unit of every length in the style |
| `window.scale` | `Window.getScale ()` | the display scale, 1.5 on a Wayland output scaled to 150% |
| `window.density` | `Window.getPixelDensity ()` | physical pixels per layout pixel, for choosing high-resolution images |
| `window.dpi` | `Window.getDpi ()` | the dots per inch of the display, for physical sizes |
| `app.name` | set by the code | any value the application publishes: `self.gui:.setVariable ("mode", "edit")`. A variable that was never set makes its test false. |
| `theme`, `pointer` | later: needs a getter on `Window` | the system's light or dark theme (`SDL_GetSystemTheme`), and whether the last input was touch or a mouse |

The rules:

- **Tests** compare a variable to a value with `<` `<=` `>` `>=` `==` `!=`, and combine with `and`, `or`, `not` and
  parentheses. A variable alone tests a boolean (`app.compact`). Values use the shared grammar, so breakpoints can be
  constants (`$narrow`).
- **Cascade.** Declarations in a `@when` keep the specificity of the rule around them and come after its own
  declarations, so they win while the condition holds.
- **Any property**, sizes included. State rules cannot carry sizes (BAL-44), because hovering must not move the layout;
  a condition is decided before the layout, so it can.
- **No loops.** `width` and `height` never measure something the condition can change. A `.prompt` turned into a
  column grows taller, but its available width does not change, and a content-sized parent is skipped for the next
  ancestor with a fixed size.
- **Evaluated on change.** Each condition records the variables it reads. A resize, a change of scale or a
  `setVariable` restyles only the widgets matched by rules reading that variable, then lays them out again.
- **`display: none`** takes a widget out of the layout and out of the drawing, and `display: normal` is the default. A
  widget hidden by code stays hidden whatever its style says.

## 5. One value grammar

Both files parse the right-hand side of `name: …;` with the same code. The attribute or property schema says which
kind it expects, so a value is checked against its type, not against a list of keywords.

| Kind | Syntax | Examples | Replaces |
|---|---|---|---|
| length | number, optionally `px` or `%` | `12` `12px` `40%` | `{ relative: 0.4; }`, `w: 1280` |
| size | a length, or `auto` `min-content` `max-content` | `width: auto` | unchanged keywords |
| track | a size, or a share of the free space in `fr` | `columns: 1fr 2fr 120` | `columns: 3` |
| colour | `#rgb` `#rrggbb` `#rrggbbaa`, palette `name!shade`, `transparent`, then an optional `/ alpha` | `#388bfd / 40%` `black!0 / 0.6` | `#388bfd : 100` (alpha out of 255) |
| number | integer or decimal, leading digit required | `0.5` `700` | |
| string | double quotes only | `"Noto Sans"` | `'…'` in `.gui` |
| keyword | identifier from the property's own set | `row` `bold` `center` | the flat `Keywords` enums |
| tuple | values separated by spaces | `padding: 6 14` `border: 2 $edge` `cell: 1 0` | `padding-left` … `padding-bottom` |
| list | values separated by commas | `"DejaVu Sans Mono", monospace` | unchanged |
| constant | `$name` | `$accent` | copy and paste |
| slot | a registered name, optionally with bound arguments, or `none` ([§9](#9-signals)) | `quit` `describe ("…")` | `find` then `connect` in code |
| function | `name(values)`, reserved | `rgb(…)` `clamp(160, 20%, 360)` later | |

Shorthands follow CSS order: one value for all sides, two for vertical then horizontal, four clockwise from the top.
Both spellings of a side cascade, so `padding: 6; padding-left: 20;` works as it reads.

## 6. Where every current attribute goes

| Today | On | v2 | File |
|---|---|---|---|
| `NAME` | all | `#NAME`, optional | .gui |
| `class: "a"` | all | `.a` | .gui |
| `{ "text" }` | Label, PushButton, MenuButton | `"text"` after the selector | .gui |
| `orientation: horizontal` | LinearLayout, Splitter | `direction: row` | .style (open question 3) |
| `scrollable: true` | LinearLayout | `overflow: scroll` | .style |
| `scroll-speed: 2` | LinearLayout | `scroll-speed: 2` | .style |
| `columns: 3, rows: 2` | GridLayout | `columns: 1fr 1fr 1fr; rows: 1fr 1fr;` | .style |
| `(0, 0)` prefix | GridLayout child | `cell: 0 0;`, or nothing to fill row by row | .gui slot |
| `(x: 12, y: 12)` | FloatingLayout child | `left: 12; top: 12;` | .style |
| `capture-events: false` | FloatingLayout child | `capture-events: false;` | .gui slot |
| `("Form")` prefix | TabLayout child | `tab: "Form";` | .gui slot |
| `len: 64` | InputText | `max-length: 64;` | .gui |
| `only-numbers: true` | InputText | `only-numbers: true;` | .gui |
| `on-hover: true` | MenuButton | `open-on-hover: true;` | .gui |
| `x: left, y: bottom` | MenuButton | `popup-align: left bottom;` | .style |
| `w: 1280, h: 720` | Scene3D | `resolution: 1280 720;`, the size rendered at before scaling | .gui |
| `width: { relative: r; min: a; max: b; }` | style | `width: r%; min-width: a; max-width: b;` | .style |
| `flex-grow: 1; flex-basis: 0;` | style | `flex: 1;` | .style |

## 7. How a widget plugs in

The loader builds a tree of nodes with unparsed values, then asks a registry to instantiate each node. A widget type
registers, next to its class, everything the parsers currently hardcode. Adding a widget, or an application-defined
widget, touches no parser. The registry itself is BAL-23; this is the information the syntax relies on.

| Registered | Example: InputText | Example: TabLayout |
|---|---|---|
| type name | `InputText` | `TabLayout` |
| attributes and their value kinds | `max-length`: number, `only-numbers`: bool | |
| default attribute | `text` | |
| signals and their payloads | `on-validate`: `[c8]`, with `on-click`, `on-focus`, `on-blur` from `Widget` | `on-click`, `on-focus`, `on-blur` from `Widget` |
| children accepted | none | any number |
| slot attributes for its children | | `tab`: string |
| states | `hover`, `focus` | `hover`, `focus` |
| parts, and their states | `label`, `selection`, `cursor` | `tab` (`hover`, `selected`) |
| style properties it reads beyond the common ones | | |

Room left in the grammar for what comes next, so that later features do not break existing files:

- `@` starts a directive in both files: `@font-face`, `@import`, `@when` in a `.style`, and in a `.gui` `@component`,
  `@slot` and `@style` ([§8](#8-components)).
- `name(…)` is a function call in values: `clamp()`, `rgb()`, `calc()` can arrive one at a time.
- `$name` constants can later be allowed inside a rule, scoped to the widgets it matches, without changing their
  syntax.

## 8. Components

A component is a group of widgets written once in a `.gui` and used anywhere as if it were a widget type. Once
declared, `FieldRow` is written like `Label`: same node syntax, an id, classes, a default value, attributes, children.
Whoever reads a file cannot tell a component from a built-in widget, and does not need to.

### Declaring and using one

The gallery's form repeats the same row three times: a label, an input, a row around them, and an id for each.

Today:

```
("Form") LinearLayout FORM (class: "page") {
    Label FORM_TITLE (class: "heading") { "Tell us about yourself" }
    LinearLayout NAME_ROW (class: "row", orientation: horizontal) {
        Label NAME_LABEL (class: "field") { "Name" }
        InputText NAME (class: "input", len: 64);
    }
    LinearLayout AGE_ROW (class: "row", orientation: horizontal) {
        Label AGE_LABEL (class: "field") { "Age" }
        InputText AGE (class: "input", len: 3, only-numbers: true);
    }
    LinearLayout EMAIL_ROW (class: "row", orientation: horizontal) {
        Label EMAIL_LABEL (class: "field") { "Email address" }
        InputText EMAIL (class: "input", len: 128);
    }
}
```

As a component:

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

LinearLayout #FORM .page {
    tab: "Form";
    Label .heading "Tell us about yourself";
    FieldRow #NAME "Name";
    FieldRow #AGE "Age" { max-length: 3; only-numbers: true; }
    FieldRow #EMAIL "Email address" { max-length: 128; }
}
```

- **Parameters** are `$name`, the same sigil as the style constants: a named value substituted where it is written. A
  parameter may have a default after `:`. Its kind is taken from the attributes it is used in, and an instance passing
  a value of the wrong kind is a load error at the instance.
- **The first parameter is the default attribute**, so `FieldRow #AGE "Age"` reads like `Label "Age"`.
- **A component has exactly one root node.** The instance is that root: its `#id` and classes are put on the root,
  next to the root's own classes. In the style, the root matches both its type and the component's name, so
  `FieldRow`, `LinearLayout.field-row` and `#AGE` all select it.
- **Ids inside a component are scoped to the instance**: the instance's id is a path segment.
  `find("BODY/MAIN/TABS/FORM/AGE/INPUT")` reaches the second input. Two instances may then use the same inner ids,
  which a copy-pasted block cannot.
- **An instance attribute is a parameter first**, then a slot attribute of the parent. So `tab: "Form";` on a component
  instance under a `TabLayout` works as on any widget.

### Slots: components that take children

A tab page, a panel or a dialog frame wraps content that changes at each use. `@slot;` marks where the instance's
children go. A named slot, `@slot actions;`, receives the children that say `slot: actions;`, and the unnamed one
receives the rest.

`res/widgets/panel.gui`:

```
@style "panel.style";

@component Panel ($title) {
    LinearLayout .panel {
        LinearLayout .panel-bar {
            Label .panel-title $title;
            Box .fill;
            @slot tools;
        }
        LinearLayout .panel-body {
            @slot;
        }
    }
}
```

`example/gallery/gallery.gui`:

```
@import "res:/widgets/panel.gui";

Panel #INSPECTOR "Inspector" {
    PushButton #PIN .tool "Pin" { slot: tools; }
    Label #SELECTION .info "Nothing selected yet.";
}

Panel #SIDEBAR "Widgets" {
    PushButton #W_LABEL .entry "Label";
    PushButton #W_INPUT .entry "InputText";
}
```

Code finds the slotted widgets under the instance, not under the slot's container: `find("INSPECTOR/SELECTION")`. The
instance's file decides where things are, and the component is free to move its slot without breaking that path.

### Sharing them, and their style

- **`@import "file.gui";`** brings the components of another file in. A file holding only components is a widget
  library.
- **`@style "panel.style";`** in a component file loads the components' default look, at a lower precedence than any
  sheet the application loads. The library is usable as is, and the application overrides it with ordinary rules,
  without needing more specific selectors.
- **Styles are not scoped.** `Panel Label` or `.panel-title` select inside an instance like anywhere else. Prefixing the
  classes with the component name avoids collisions.
- A parameter cannot carry a style value: a component exposes variants through classes, `Panel .compact "Inspector"`,
  which keeps [§1](#1-what-goes-in-which-file)'s boundary.

### Components with behaviour

A markup component has no code: it is expanded at load time. A tab-like widget whose header opens and closes its body
needs code. For that, a component can take as its root the Ymir class registered under its own name. The class gets the
attributes it registers and names its slots ([§9](#9-signals)), and the component gives its default inner structure,
connected to those slots.

`res/widgets/collapsible.gui`:

```
@component Collapsible ($title, $open: true) {
    // the root is the registered class of the same name
    Collapsible .collapsible {
        open: $open;
        PushButton #HEADER .collapsible-header $title { on-click: toggle; }
        LinearLayout #BODY .collapsible-body { @slot; }
    }
}

// used anywhere:
Collapsible #ADVANCED "Advanced settings" {
    open: false;
    FieldRow #PORT "Port" { max-length: 5; only-numbers: true; }
}
```

`collapsible.yr` (a sketch, not a final API):

```
pub class Collapsible over LinearLayout {

    let mut _open = true;

    pub self (dmut manager: &WidgetManager, name: [c8])
        with super (alias manager, name)
    {
        // 'on-click: toggle;' in the component's body resolves here
        self:.slot ("toggle", &self:.onToggle);
    }

    // registered as the attribute 'open: bool'
    pub fn setOpen (mut self, open: bool) {
        self._open = open;
        if let Ok (dmut body) = alias self:.find (["BODY"]) {
            // show or hide it
        }
    }

    fn onToggle (mut self, button: u8) {
        self:.setOpen (!self._open);
    }
}
```

The structure of a code-backed widget then lives in a `.gui`, so a theme can rearrange it: put the header below the
body, or add an icon. The only contract is the slots the class names (`toggle`) and the ids it looks for (`BODY`),
which the class documents and reports when they are missing.

### Grammar

Additions to the `.gui` grammar of [§3](#3-the-structure-file):

```
document  = { directive | component } [ node ] ;
directive = "@import" string ";" | "@style" string ";" ;
component = "@component" Type "(" [ param { "," param } ] ")" "{" node "}" ;
param     = "$" ident [ ":" values ] ;            (* the first one is the default attribute *)
member    = attribute | node | slot ;
slot      = "@slot" [ ident ] ";" ;              (* only inside a component *)
```

### Left out on purpose

- **Loops and conditions.** A list with one row per item is built from code. The loader exposes the expansion for
  that: something like `gui:.instantiate ("FieldRow", parent-> "BODY/MAIN/TABS/FORM", id-> "PHONE", "Phone")`.
- **Expressions on parameters.** A parameter is substituted whole.
- **Recursion.** A component may use other components; a cycle is a load error naming the chain.

## 9. Signals

Today every handler is connected by code that finds the widget by its path first. `example/gallery/main.yr` has ten
`find(…)` calls that exist only to connect a signal. Each one breaks silently when a widget moves or is renamed in the
`.gui`: the `if let Ok` fails, and the button no longer does anything.

The proposal reverses the direction. The code publishes its handlers under names, the `.gui` says which signal goes to
which name, and the loader connects them. A `.gui` can then be rearranged, or reloaded (BAL-20), without touching the
code.

`example/gallery/main.yr` today:

```
fn connectMenus (mut self) {
    if let Ok (dmut quit) = alias self.gui:.find ("BAR/FILE/FILE_MENU/QUIT") {
        quit:.clicked ():.connect (self.box, &self:.onQuitClicked);
    }

    if let Ok (dmut clear) = alias self.gui:.find ("BAR/FILE/FILE_MENU/CLEAR") {
        clear:.clicked ():.connect (self.box, &self:.onResetClicked);
    }
    // … ABOUT
}

fn connectForm (mut self) {
    if let Ok (dmut input: &InputText) = self.gui:.find ("BODY/MAIN/TABS/FORM/NAME_ROW/NAME") {
        input:.textValidated ():.connect (self.box, &self:.onNameValidated);
    }
    // … AGE, EMAIL, SUBMIT, RESET
}

fn connectChips (mut self) {
    for chip in ["CHIPS/CHIP_A", "CHIPS/CHIP_B", "CHIPS/CHIP_C", "GRID/CELL_F"] {
        if let Ok (dmut button) = alias self.gui:.find ("BODY/MAIN/TABS/LAYOUTS/" ~ chip) {
            button:.clicked ():.connect (self.box, &self:.onChipClicked);
        }
    }
}

// and a class EntrySlot, one instance per sidebar entry,
// to carry the description shown when the entry is clicked
```

v2:

```
over onStart (mut self) {
    self:.slot ("quit", &self:.onQuitClicked);
    self:.slot ("reset", &self:.onResetClicked);
    self:.slot ("about", &self:.onAboutClicked);
    self:.slot ("submit", &self:.onSubmitClicked);
    self:.slot ("chip", &self:.onChipClicked);
    self:.slot ("name-set", &self:.onNameValidated);
    self:.slot ("age-set", &self:.onAgeValidated);
    self:.slot ("email-set", &self:.onEmailValidated);
    self:.slot ("describe", &self:.onDescribe);

    // every 'on-…' of the file is connected and checked here
    self.gui:.loadGUIFile (galleryFile ("gallery.gui"))?;
}

// replaces EntrySlot: the text comes from the .gui
fn onDescribe (mut self, text: [c8], button: u8) {
    if button == SDL_BUTTON_LEFT {
        self:.setSelection (text);
    }
}
```

```
PushButton #QUIT .item "Quit" { on-click: quit; }
PushButton #CLEAR .item "Clear the form" { on-click: reset; }

FieldRow #NAME "Name" { on-validate: name-set; }
FieldRow #AGE "Age" { max-length: 3; only-numbers: true; on-validate: age-set; }

PushButton .chip "Short" { on-click: chip; }               // no id needed any more
PushButton .chip "A longer chip" { on-click: chip; }

PushButton .entry "Label" {
    on-click: describe ("Label: a text in UTF-8, shaped with the font of its style …");
}
```

### The rules

- **Signals are registered by the widgets**, like attributes, under an `on-` name: `on-click` (`clicked`),
  `on-double-click`, `on-focus`, `on-blur` (`unfocused`), `on-validate` (`textValidated`), `on-menu-open`,
  `on-menu-close`. The registry records each payload type: `u8` for a click, `[c8]` for a validated text.
- **Slots are registered by the code, under a name.** `Activity.slot (name, delegate)` files the delegate with the
  activity's `SlotEmitter`, so the handler still runs on the activity's thread, as with `connect (self.box, …)` today.
  Names are free-form. `::` is allowed in them, so `form::submit` works as a namespace, but it is a name, not a path the
  loader looks up.
- **The connection is checked at load.** Registering a slot records the types of its parameters with `typeinfo`. A slot
  name that does not exist, or a slot whose parameters do not match the signal, is a load error naming the file, the
  line, the signal and the slot. It is not a button that silently does nothing.
- **Bound arguments.** A slot reference may carry constant arguments, `describe ("…")`, written with the value grammar.
  The slot receives them first, then the signal's payload. One slot then serves many widgets, and the per-widget
  classes like `EntrySlot` disappear.
- **Lookup is lexical.** A name is looked up first in the slots of the nearest code-backed component around the widget
  (`toggle` in `Collapsible`, [§8](#8-components)), then in the activity's. A component library therefore cannot be
  broken by an application slot of the same name.
- **Components forward signals as parameters.** `$on-validate: none` in `FieldRow`, used as `on-validate: $on-validate;`
  on its input, lets `FieldRow #AGE "Age" { on-validate: age-set; }` reach the inner widget. `none` leaves a signal
  unconnected.
- **The connections belong to the widget.** They are dropped with it and made again when the file is reloaded.
  `connect` stays available for widgets created by code.

For the forwarding above, `FieldRow` of [§8](#8-components) gains one parameter and one line:

```
@component FieldRow ($label, $max-length: 64, $only-numbers: false, $on-validate: none) {
    LinearLayout .field-row {
        Label .field $label;
        InputText #INPUT .input {
            max-length: $max-length;
            only-numbers: $only-numbers;
            on-validate: $on-validate;
        }
    }
}
```

### Why the code names its slots

Writing `on-click: "gallery::GalleryActivity::onQuitClicked"` and letting the loader find the method would remove the
registration lines. Ymir cannot do that today. A compiled program has no table of its methods to look a name up in at
runtime. At compile time, the compiler exposes `__members__` and the names of enums, but cannot list the methods of a
class. The registration is also where the parameter types are recorded for the check above.

If the compiler later learns to list the methods of a class that carry an attribute, a `@{slot}` on the method could
replace the `self:.slot (…)` line with no change to any `.gui`: the files only ever see names.

### Grammar

Additions to the value grammar of [§5](#5-one-value-grammar):

```
slot-ref = "none" | name [ "(" values ")" ] ;       (* the value of an on-… attribute *)
name     = ident { "::" ident } ;
```

## 10. Open questions

Each has a recommendation.

1. **Border-box widths, margins outside.** This is the largest semantic change: every `width` written today with a
   margin grows by twice that margin. The port in BAL-19 would subtract the margins where the exact pixel width
   matters. *Recommendation: adopt it.* It is the precondition for sizes meaning what they say.
2. **Can a pixel width shrink?** CSS lets `width: 120` shrink in a flex line down to its `min-width`. Today it is
   rigid. Keeping it rigid is less surprising for fixed chrome, while shrinking avoids overflow when the window is
   small. *Recommendation: CSS behaviour*, with `flex: none` for the rigid case. The default `min-width: auto`
   (min-content) already stops text from being cut.
3. **Orientation: style or structure?** Under the rule of [§1](#1-what-goes-in-which-file), `direction` is
   presentation, and a theme could turn a toolbar vertical. But a `.gui` reader can then no longer see whether a layout
   is a row or a column. *Recommendation: style*, named in the class (`.row`, `.toolbar`) as the gallery already does.
   The alternative is `Row` and `Column` types in the registry.
4. **Inline styles in `.gui`.** Allowing `width: 120;` inside a node would mean one less rule for a one-off widget, at
   the price of a theme no longer reaching it and of the boundary of [§1](#1-what-goes-in-which-file) blurring.
   *Recommendation: none.* `#ID` selectors cover the one-off case from the style sheet.
5. **Constants or cascading variables.** `$accent` is resolved at parse time: simple, no runtime cost, re-skinning
   means loading another sheet. CSS's `--accent` with `var()` cascades per subtree, but every property then needs late
   resolution. *Recommendation: `$name` constants now*, with the rule-scoped form of [§7](#7-how-a-widget-plugs-in) as
   the upgrade path.
6. **Anonymous widgets in find paths.** Skipping unnamed widgets keeps paths short and lets a layout wrapper be added
   without breaking the code. It also means a path no longer mirrors the file exactly. *Recommendation: skip them*, and
   report an ambiguous path at load time rather than at lookup.
7. **How a component names its Ymir class.** [§8](#8-components) lets a component use the registered class of its own
   name as its root. The explicit alternative is `@component Collapsible : CollapsibleWidget ($title) { … }`, which
   costs a second name but lets one class serve several components. *Recommendation: the same-name rule*, adding the
   explicit form only once a class needs two structures.
8. **Where slotted widgets are found.** A slotted widget really lives inside the component's tree
   (`INSPECTOR/…/SELECTION`). Finding it directly under the instance (`INSPECTOR/SELECTION`) hides that, so the
   component can change its inner structure without breaking the code that uses it. *Recommendation: under the
   instance.*
9. **A missing slot: error or warning?** An error catches typos at once. A warning lets someone edit a `.gui` before
   the code has the slot, and keeps a hot reload from refusing a file over one button. *Recommendation: an error at
   load*, and on hot reload a refused file that keeps the previous tree, with the error logged.
10. **Bound arguments in the `.gui`.** `describe ("…")` moves data into the structure file, and adds a second set of
    parameters to type-check. Without it, each sidebar entry still needs its own slot, or a slot that receives the
    sender and reads its id. *Recommendation: keep them*, limited to constants of the value grammar.
11. **Ask the compiler for method listing?** Self-registering `@{slot}` methods need a bootstrap feature: listing a
    class's methods and their attributes at compile time. *Recommendation: not now.* Explicit registration is one line
    per slot and works today. Open a bootstrap issue if those lines become a burden.
12. **What `width` measures in `@when`.** The nearest ancestor with a size that does not depend on its content is CSS's
    container-query rule, and it cannot loop. Testing the direct parent is simpler to explain, but a content-sized
    parent could then flip between two layouts every frame. *Recommendation: the nearest ancestor with a fixed size*,
    the window at worst.

## 11. What follows from it

- **BAL-21** value grammar: the shared lexer and [§5](#5-one-value-grammar), plus the size model of [§2](#2-sizes) in
  `WidgetSize` and the box model.
- **BAL-22** selector engine: [§4](#4-the-style-file)'s selectors, specificity, cascade and inheritance.
- **BAL-53** wrapping and alignment, written in the v2 grammar.
- **`@when`** ([§4](#conditional-rules-when)) has no work item yet: the variables, the evaluation on change and
  `display`. A new item under BAL-25, after BAL-22, since it relies on the cascade.
- **BAL-23** registry and generic parser: [§3](#3-the-structure-file) and [§7](#7-how-a-widget-plugs-in), retiring the
  `readX`/`readXHeader` pairs.
- **BAL-19** port of `res/` and the examples.
- **BAL-20** hot reload, which a single generic parser makes much simpler. Reloading a component file expands its
  instances again.
- **Components** ([§8](#8-components)) have no work item yet. They need the registry of BAL-23 and add expansion,
  scoping and `@import`/`@style` on top, so they would be a new item under BAL-25, after BAL-23.
- **Signals** ([§9](#9-signals)) have no work item yet either: slot registration on `Activity` and on widgets, signal
  schemas in the registry, connection and checking at load. A new item under BAL-25, after BAL-23. Components can come
  before or after it.

Sources: `interface/loader.yr`, `interface/style/parser.yr`, `interface/widget/alignement.yr`, `interface/widget.yr`,
`interface/drawer.yr`, `core/application/window.yr`, `core/application/signal.yr`, `res/` and `example/` on Balder
master (2dd0784).
