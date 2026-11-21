# Assets

The meshes and the materials of a scene are assets (`balder::scene::asset`): resources loaded once, cached by their
paths and shared by every node using them. A node of the scene is not its mesh: a `MeshInstance3D` references a mesh
asset and a material for each of its parts, and swapping either keeps the node, its id, its transform and the nodes
under it. A crate of a game is a mesh node, or an actor with a mesh node under it.

```
let crate = Assets::mesh("res:/models/crate.glb");
let painted = Assets::material("res:/materials/painted_wood.material");

let dmut a = copy MeshInstance3D("crate", alias level, alias crate);
let dmut b = copy MeshInstance3D("painted-crate", alias level, alias crate, materials-> copy [(painted)?]);
let dmut floor = copy MeshInstance3D("floor", alias level, alias Assets::mesh(MeshAsset::PLANE));
```

## Meshes

A `MeshAsset` is the geometry of a model file or of a primitive, in parts (`SubMesh`): a part is the geometry of the
meshes of the file sharing a material (`MeshGeometry`, its vertices, its levels of detail and its clusters), the
material it is drawn with by default, and whether its vertices have texture coordinates. A skinned model keeps its
skeleton (`MeshAsset.skeleton`), the parts their skins.

| Path | Mesh |
|---|---|
| `res:/models/crate.glb`, an absolute path | a model file read by assimp (`MeshAsset::read`), its parts in the unit box standing on its origin (x and z in [-0.5, 0.5], y in [0, 1]), each drawn by default with the material of the file it names |
| `engine:/meshes/cube`, `engine:/meshes/sphere`, `engine:/meshes/plane` | a built-in primitive (`MeshAsset::CUBE`…, `MeshAsset::builtin`), one part of the default material, never read from a file |

A model file keeps every attribute its vertices have (normals, tangents, texture coordinates, colours, bones), the
shader of a material reading those it needs (`MeshArray::compactVertices`). Its levels of detail are built unless asked
otherwise (`Assets::mesh(path, lods-> false)`), the two being cached apart. The mesh also gives the colliders of the
physics: the hulls of its parts (`hulls`), their triangles (`triangles`) and the convex decomposition saved next to its
file (`decomposition`, see `doc/physics.md`).

## Materials

A `MaterialAsset` is the factors and the maps of a surface (a `MaterialConfig` and a `MaterialMaps`), named by its path:

| Path | Material |
|---|---|
| `res:/materials/brick.material` | a `.material` file (`MaterialAsset::read`, `save`) |
| `res:/models/crate.glb#0` | the first material of a model file, embedded in its mesh asset (`MaterialAsset::embeddedPath`), named as the file names it |
| `local:<uuid>` | a material local to a scene file, written in a block of the file (`MaterialAsset::local`, see the scene files of `doc/editor.md`) |
| `engine:/materials/default` | the default material (`MaterialAsset::DEFAULT`), a white dielectric, fully rough, built in |

A `.material` file is a toml of the entries of a material (`MaterialAsset::entries`), its version first, the maps it
has not left out; a block of a material local to a scene file has the same entries, written as the entries of a node:

```
# A material of Balder, its factors and the paths of its maps (see MaterialAsset)
version = 1
base-color = [0.8, 0.3, 0.2]
emissive = [0.0, 0.0, 0.0]
metallic = 0.0
roughness = 0.6
specular = 0.5
occlusion = 1.0
base-color-map = "res:/textures/brick.png"
normal-map = "res:/textures/brick_normal.png"
```

| Entry | Value |
|---|---|
| `base-color`, `emissive` | a linear colour, multiplying the texels of the map of the same name (decoded from sRGB) |
| `metallic`, `roughness`, `specular`, `occlusion` | as `MaterialConfig` has them |
| `base-color-map`, `metallic-roughness-map`, `normal-map`, `occlusion-map`, `emissive-map` | the path of a texture, the maps as `MaterialMaps` has them |

Each part a node draws takes a `Material` of its own from the asset (`MaterialAsset.instance`): a metallic/roughness
material when it has maps other than its base colour, a material of its base colour texture when it has only this one,
a constant material when it has none or when the vertices of the part have no texture coordinates. The materials of the
same shader and the same maps share their resources, and the parts of the same geometry draw as instances of one
command.

## The cache

`Assets` holds the assets loaded, by their paths: `Assets::mesh(path, lods)` and `Assets::material(path)` load an asset
the first time it is asked and give the same one afterwards, `Assets::register` puts a material made by the program (or
a local one) under its path, `forget` and `clear` drop assets, the nodes using them keeping them. A model file reads
its materials into the cache, so that a material embedded in it is the same whether its mesh was read with its levels
of detail or without. A mesh whose geometry released its vertices once placed in a scene (`MeshAsset.isReleased`) is
read again when asked, a node drawing it elsewhere needing them.

## Mesh nodes

A `MeshInstance3D` draws its mesh through meshes under it, one per part (`IndexedMesh3D::sharing`, named `__draw_<i>__`,
left out of the scene files and of the outline): the nodes of one mesh share its geometry, placed once in the geometry
pool of each shader. A slot of `materials` gives a part another material, none (or no slot) drawing it with its own
(`materialOf`); `setMesh`, `setMaterials` and `setCastShadow` build the draws again. The node also forces a level of
detail (`forcedLod`), poses a skinned mesh (`pose`, `fitClip`) and copies another (`copyOf`, the same mesh and
materials). A click on one of its draws selects it (`selectedOnClick`).

Its schema (`MeshInstance3D::schema`, group *Mesh*) gives the scene files and the inspector its `mesh` (an asset of the
kind `mesh`, required), its `materials` (`PropertyKind::ASSETS`, assets of the kind `material`), `lods` and `shadows`,
every one changed on a node built.
