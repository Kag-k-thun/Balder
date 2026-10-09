# The .gui and .style language

A `.gui` file says which widgets exist, what they say and how they behave. A `.style` file says how they look and
where they go. Both share one lexer and one grammar of values. This page describes the language as Balder reads it
today; [gui-v2.md](gui-v2.md) is the design it comes from, and still describes parts that are not implemented yet
(components, signals, the CSS box model).

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
- `loadGUIFile` reads a `.gui` file, checks every node against the widget types, then creates the widgets and makes
  the root the content of the manager.
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
        PushButton #YES .yes "Yes";
        PushButton #NO .no "No";
    }
}
```

```
document  = node ;
node      = Type { "#" ident | "." ident } [ values ] ( ";" | "{" { member } "}" ) ;
member    = attribute | node ;
attribute = ident ":" values ";" ;
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
- **The post-process chain of a `Scene3D`** is described by `post: bloom, lut("res:/lut/film.png"), fxaa, invert(off);`:
  each effect is a kind registered in the post registry of the manager (`WidgetManager::getPostRegistry`, `vignette`,
  `bloom`, `invert`, `lut` and `fxaa` in Balder, an application registering its own before loading the file), followed
  by its parameters, numbers and texts (the path of a LUT), `off` adding it disabled. The effects are added to the chain of the scene when the widget is attached (see `doc/render-graph.md`).
- `@import`, `@style` and `@component` are read but refused at load: components are not implemented yet.

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
- **A type**, `#id`, `.class` and `:state` all have to hold. `*` or no type selects every type.
- **States** are registered by the widget types: `:hover`, `:focus`, `:check` for every widget.
- **Parts** style a piece of a widget, `PushButton::label`, and end their selector. A part with states of its own takes
  them after it: `TabLayout::tab:selected` is the selected tab, `TabLayout:hover::tab` every tab of a hovered layout.
- **Checked at load**: a type, a state, a part or a state of a part that none of the types a compound can select
  registers is an error, as is a property affecting the layout in a rule testing a state (hovering must not move
  anything).

### Cascade

- The rules matching a widget apply by origin, then by specificity (ids, then classes, states and parts, then types,
  summed over the compounds), then in the order they were loaded, the later one winning a tie. A rule matching
  through several of its selectors takes the specificity of the most specific one.
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

The attributes of a type are set in the block of a node, `max-length: 64;`, its default attribute by the value after the selector, `Label "Name";`. The attributes of the children are set on a child by its parent's type, `tab: "Form";`. The properties are style properties the type reads beyond the common ones.

### `Box`

- **Attributes:** none
- **Default attribute:** none
- **Children:** none
- **Attributes of the children:** none
- **States:** `hover`, `focus`, `check`
- **Parts:** none
- **Properties:** none

### `FloatingLayout`

- **Attributes:** none
- **Default attribute:** none
- **Children:** any number
- **Attributes of the children:** `capture-events`: true or false
- **States:** `hover`, `focus`, `check`
- **Parts:** none
- **Properties:** none

### `FrameGraph`

- **Attributes:** `frames`: an integer of 0 or more
- **Default attribute:** none
- **Children:** none
- **Attributes of the children:** none
- **States:** `hover`, `focus`, `check`
- **Parts:** `cpu`, `gpu`, `memory`
- **Properties:** none

### `GridLayout`

- **Attributes:** none
- **Default attribute:** none
- **Children:** any number
- **Attributes of the children:** `cell`: two integers of 0 or more
- **States:** `hover`, `focus`, `check`
- **Parts:** none
- **Properties:** `columns`: one or more tracks: lengths in px or %, shares in fr, auto, min-content or max-content; `rows`: one or more tracks: lengths in px or %, shares in fr, auto, min-content or max-content

### `InputText`

- **Attributes:** `text`: a string; `max-length`: an integer of 0 or more; `only-numbers`: true or false
- **Default attribute:** `text`
- **Children:** none
- **Attributes of the children:** none
- **States:** `hover`, `focus`, `check`
- **Parts:** `label`, `selection`, `cursor`
- **Properties:** none

### `Label`

- **Attributes:** `text`: a string
- **Default attribute:** `text`
- **Children:** none
- **Attributes of the children:** none
- **States:** `hover`, `focus`, `check`
- **Parts:** none
- **Properties:** none

### `LinearLayout`

- **Attributes:** none
- **Default attribute:** none
- **Children:** any number
- **Attributes of the children:** none
- **States:** `hover`, `focus`, `check`
- **Parts:** `scrollbar`
- **Properties:** `direction`: row or column; `overflow`: hidden or scroll; `scroll-speed`: a number of 0 or more

### `MenuButton`

- **Attributes:** `text`: a string; `open-on-hover`: true or false
- **Default attribute:** `text`
- **Children:** its popup, optional
- **Attributes of the children:** none
- **States:** `hover`, `focus`, `check`
- **Parts:** `label`
- **Properties:** `popup-align`: left, center or right, then top, center or bottom

### `MenuLayout`

- **Attributes:** none
- **Default attribute:** none
- **Children:** its bar then its content
- **Attributes of the children:** none
- **States:** `hover`, `focus`, `check`
- **Parts:** none
- **Properties:** none

### `PushButton`

- **Attributes:** `text`: a string
- **Default attribute:** `text`
- **Children:** none
- **Attributes of the children:** none
- **States:** `hover`, `focus`, `check`
- **Parts:** `label`
- **Properties:** none

### `Scene3D`

- **Attributes:** `resolution`: two integers of 0 or more; `post`: effects separated by commas, each a kind followed by its parameters, numbers and texts, `off` adding it disabled: `vignette(0.5), lut("res:/lut/neutral.png"), invert(off)`
- **Default attribute:** none
- **Children:** none
- **Attributes of the children:** none
- **States:** `hover`, `focus`, `check`
- **Parts:** none
- **Properties:** none

### `Splitter`

- **Attributes:** none
- **Default attribute:** none
- **Children:** any number
- **Attributes of the children:** none
- **States:** `hover`, `focus`, `check`
- **Parts:** `grip` (states `hover`), `bbox`
- **Properties:** `direction`: row or column

### `TabLayout`

- **Attributes:** none
- **Default attribute:** none
- **Children:** at least 1
- **Attributes of the children:** `tab`: a string, required
- **States:** `hover`, `focus`, `check`
- **Parts:** `tab` (states `hover`, `selected`)
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
| `border-width` | a length in px |  | yes |
| `border-color` | a colour |  |  |
| `radius` | a length in px |  |  |
| `border` | a width in px and a colour, in any order, either one optional, setting `border-width`, `border-color` |  | yes |
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
