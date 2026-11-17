# The physics of a scene

A scene holds the bodies of its nodes in a physics world. Each tick steps the world: the dynamic bodies fall, push each
other and come to rest, and their nodes are placed where the simulation has them. The queries (rays, shape casts,
overlaps) run on the bodies, and each tick tells the bodies which others they touch. A body is static, moved by the
game (kinematic), or moved by the solver (dynamic).

The code lives in `balder::scene::physics`, and the node in `balder::scene::node::node3D::body`.

## Bodies

A `PhysicsBody3D` is a `Node3D` holding the shape of its collider (`ColliderShape`) and its `BodySettings`:

- **motion**: `STATIC` (the ground, the walls), `KINEMATIC` (a door, a platform, a character moved by the game) or
  `DYNAMIC` (a crate, a ball, moved by the solver; never a mesh nor a plane);
- **mass**, **friction**, **restitution**, **linearDamping**, **angularDamping**, **canSleep**: how a dynamic body
  weighs, slides, bounces, slows down and sleeps;
- **rollingFriction**, **spinningFriction** (0 by default): how a ball or a cylinder rolling on a floor, or a top
  spinning on its point, slows down to rest (see The solver);
- **bullet**: a dynamic body advanced along its motion at each step against the static and the kinematic bodies, and
  stopped where it hits one: a projectile, a thin object thrown spinning (see Bullets);
- **trigger**: a trigger reports the bodies it overlaps and stops none of them; the queries skip it unless their
  filter asks for the triggers;
- **layer** and **mask**: the layers the body is in, and the layers of the bodies it touches, one bit by layer. Two
  bodies touch when one of them is in a layer of the mask of the other.

```
let dmut crate = copy PhysicsBody3D ("crate", alias level, shape-> ColliderShape::box (makeVec3 (1.0f, 1.0f, 1.0f)),
                                     settings-> BodySettings (motion-> BodyMotion::KINEMATIC, layer-> 2u32));
crate.mask = 1u32;
```

The node holds the handle of its body in the world of its scene, not the body. It adds its body when it enters a
scene (`onEnter`, `Scene::registerBody`) and removes it when it leaves (`onExit`, `Scene::removeBody`). A
transformation set on the node, or on one of its parents, moves the body (`Scene::onBodyMoved`). A new shape or new
settings change it (`Scene::onBodyChanged`). The node computes its transformation under its parent when it is built,
so that it enters the world where it is.

### Shapes

A `ColliderShape` is centred on the origin of its body:

| Kind       | Built with                            | Notes                                                        |
|------------|---------------------------------------|--------------------------------------------------------------|
| `BOX`      | `ColliderShape::box (size)`           | a side along each axis of the body                           |
| `SPHERE`   | `ColliderShape::sphere (radius)`      |                                                              |
| `CAPSULE`  | `ColliderShape::capsule (r, height)`  | along the Y axis, its caps included in its height            |
| `MESH`     | `ColliderShape::mesh (triangles)`     | a `TriangleBvh`, its hierarchy built at once                 |
| `CYLINDER` | `ColliderShape::cylinder (r, height)` | along the Y axis, scaled along each axis of its body         |
| `PLANE`    | `ColliderShape::plane ()`             | the half space under the XZ plane of its body; static        |
| `HULL`     | `ColliderShape::hull (hull)`          | a shared `ConvexHull` of points (`copy ConvexHull (points)`) |
| `COMPOUND` | `ColliderShape::compound (parts)`     | convex parts placed by rigid transforms (`CompoundShape`)    |

`ColliderShape (volume)` gives the shape of a `VolumeShape`, the shape of a `Volume3D`.

A body knows the shape it is described by in the scene files and in the editor (`described`, a `BodyShape`): a box, a
sphere, a capsule, a cylinder or a plane of its sizes, the hulls or the triangles of a model by the path of its file, or
the compound of the volumes under it. `reshape` builds its collider from one (`colliderOf`): the hulls of a model are
its decomposition saved next to its file, or the hull of each of its meshes when it has none; the triangles of a model
are a mesh shape; a compound takes the volumes under the body, each placed and scaled as it is under it, those under
another body left out, and is refused without a volume. A collider set as a hull, a mesh or a compound (`shape`) is
described by none, and a scene file cannot hold it. The scene files read and write the bodies and the characters (see
the scene files of `doc/editor.md`). A mesh is only a surface: a
ray hits its triangles from either side, a shape overlaps it only when it crosses a triangle, and two meshes never
touch. A mesh shape can share the triangles a mesh instance keeps for its picking (`Scene::keepsTriangles`).

The transformation of the body may scale its shape. A box is scaled along each of its axes, and sheared under a parent
scaled along other axes. A mesh is transformed as it is drawn. A sphere stays round, scaled by the largest scale of the
transformation. A capsule is scaled along its axis by the scale of Y (its cylinder), and its radius by the larger of the
scales of X and Z.

`SolidObjectModel::hulls` gives the compound of the hulls of the meshes of a model, one by material, before the model
enters a scene that does not keep its triangles. A concave model (a chair, a mug, a teapot) is a compound of the hulls of
its convex decomposition (see below), `SolidObjectModel::decomposition`. A plane has no box: the world keeps its planes
apart from its hierarchy and tests them in every query.

### Convex decomposition

A triangle mesh is static only; a dynamic concave model is the compound of convex hulls approximating it. A
`ConvexDecomposition` splits the triangles of a model (`SolidObjectModel::triangles`, in the space of the model) into
hulls, by its `DecompositionSettings`:

| Setting | Default | Meaning |
|---|---|---|
| `concavity` | 0.01 | the volume a hull may hold outside the model, over the volume of the model |
| `maxHulls` | 16 | the hulls at most |
| `maxVertices` | 32 | the vertices of a hull at most, four at least |
| `resolution` | 64 | the voxels along the longest side of the model |

The decomposition (`Decomposer`, approximate like V-HACD) works on the voxels of the model (`VoxelGrid`): the voxels a
triangle overlaps (`Triangle::overlaps`) are its surface, those a fill from a corner of the grid does not reach its
inside, so that the inside of a surface that is not closed (an open mug) is outside. The solid voxels are taken in their
connected pieces. A piece is measured by the hull of the corners of its voxels, built slice by slice (the outline of
each slice, simplified by half a voxel): the volume the hull holds past its voxels, and past the steps of the voxels
along its faces (none along a face across an axis, half a voxel over a ball), is the volume it holds outside the model.
The piece holding the most is split across an axis by the plane leaving the least outside the hulls of its two sides,
each side giving its connected pieces, until each holds less than the concavity, or until there are twice as many pieces
as hulls asked. Then the two hulls whose hull holds the least outside them are merged, as long as there are more hulls
than asked or that hull holds less than the concavity. Each hull is kept in the box of the model, then reduced to
`maxVertices` by taking the vertex farthest out of the hull of those taken. `shape` gives the compound of the hulls.

It is slow by nature (seconds to tens of seconds for a model of a few thousand triangles), so it runs offline, at
import or in the editor, never at load: the hulls are saved next to the model file (`ConvexDecomposition::fileOf`,
`mug.glb` giving `mug.hulls`), a toml holding the version of the format, the settings, the CRC-32 of the model file
they were made from (`checksumOf`) and a `[[hull]]` table of the coordinates of the vertices of each hull. The game reads
it (`SolidObjectModel::decomposition`, `ConvexDecomposition::fromFile`), a warning telling when the model file changed
since:

```
let dmut mug = copy SolidObjectModel::fromFile("mug", alias body, "res:/models/mug/mug.glb");
body.shape = mug.decomposition().shape();
```

The `decompose` tool (`tools/src/decompose`) decomposes a model at import, the export of a project will (BAL-138); the
panel of the hulls of a model in the editor (see `doc/editor.md`) draws the hulls saved over the model:

```
cd tools && gyllir build decompose && cd ..
./tools/decompose res:/models/teapot/teapot.obj --concavity 0.01 --hulls 16 --vertices 32 --resolution 64
```

## Body state

Next to the slot of each body, the world keeps its `BodyState`, in an array by handle the solver runs over without
reaching the colliders nor the nodes: its pose (a `RigidTransform`, its scale apart), the centre of its mass, its linear
and angular velocities, the inverse of its mass and of its inertia tensor, in the space of the body and in the world.

A dynamic body has the mass of its settings, spread uniformly in its shape scaled as its node is (`MassProperties`): a
compound splits it between its parts by volume. It is placed rigidly, its pose then its scale, the shear of a parent
dropped. A mesh or a plane is never dynamic, the world keeping it static with an error.

A dynamic body still (under `SleepThresholds::linear` and `angular`) for `time` seconds is ready to sleep
(`updateSleep`); the solver puts an island to sleep when all its bodies are, their velocities dropped. Moving a body or
changing its velocity wakes it.

A dynamic body is pushed through its node (`setVelocity`, `applyImpulse`, `applyForce`, each at a point of the world or
its centre of mass), and tells its velocities (`linearVelocity`, `angularVelocity`) and whether it sleeps (`sleeping`).
An impulse changes its velocities at once; a force lasts the steps of the tick it is applied in, so a game applies it
at each tick it pushes. Each call goes through the scene, under its lock, and does nothing outside a scene.

```
crate:.applyImpulse (makeVec3 (0.0f, 5.0f, 0.0f));
if crate.sleeping { ... }
```

## The world

`PhysicsWorld` knows the bodies by their handles, the index of their slot. A handle is free once its body is removed,
and a later body may get it. The world boxes of the colliders are kept in a `Bvh`, the broadphase of the queries and of
the contacts, refit when a body moves or its velocity changes. The box of a body covers what it travels in the next step
at its velocity (its spin at the reach of its box growing it on every side), stretched by two more steps of it, so that
a body thrown at a thin wall pairs with it at its first step, its speculative points stopping it there.

`ScenePhysics` is the world of a scene with the nodes of its bodies: its queries give back the nodes they hit, and it
emits the signals of the contacts on them. The scene guards it with its lock.

## Queries

The scene runs them under its lock, from any thread:

| Query                                                  | Gives                                                  |
|--------------------------------------------------------|--------------------------------------------------------|
| `raycast (ray, filter)`                                | the body hit first, as a `BodyHit`                     |
| `raycastAll (ray, filter)`                             | every body hit, the closest first                      |
| `sphereCast (origin, radius, direction, length, ...)`  | the body a moving sphere hits first                    |
| `shapeCast (shape, transform, direction, length, ...)` | the body a moving box, sphere or capsule hits first    |
| `overlapSphere`, `overlapBox`, `overlapShape`          | the bodies sharing a point with the shape              |
| `penetrations (shape, transform, filter)`              | how deep the shape sinks into each body it overlaps    |
| `pickBody (pixel, filter)`                             | the body the camera sees first through a pixel         |

A `BodyHit` gives the body, the distance along the ray (or travelled by the shape), the point hit and the normal of the
surface there, facing the ray. A ray starting inside a box, a sphere or a capsule hits it at distance 0, its normal
opposite the ray; a shape cast starting against a body hits it at distance 0 too.

A `QueryFilter` chooses the bodies hit: the layers of its `mask`, the triggers when `triggers` is set, and none of the
handles in `exclude` (the body of a character casting a ray from itself).

`penetrations` gives a `ShapeContact` by sub shape the shape sinks into (a part of a compound, a triangle of a mesh):
the body, the normal from the shape to the body, the depth and the deepest point. The shape gets out of it by moving
against the normal by the depth; a shape barely touching a body sinks into nothing.

`pickBody` picks a body by its collider, where `Scene::pick` picks a visual instance by its triangles.

### How a query tests a collider

A ray is tested exactly: a slab test in the space of a box, a sphere and a capsule in the world, the triangles of a
mesh through the hierarchy of its `TriangleBvh`. The ray goes into the space of the body without its direction being
normalized there, so the distances stay those of the world.

The shapes are tested by the distance between their cores (`gjk::separation`, Gilbert, Johnson and Keerthi). A
`Convex` is a core (a point, a segment, a triangle, a box) grown by a margin: a sphere is a point grown by its radius, a
capsule a segment grown by its radius, so both stay exact. A shape cast moves the shape by conservative advancement
(`gjk::sweep`). The distance between two convex shapes, one of them moving in a straight line, is a convex function
of the distance travelled, so the shape can advance by the distance between them divided by the speed at which they get
closer without passing through.

## Contacts

At each tick, after the nodes are ticked and the steps run, the scene reports the contacts
(`PhysicsWorld::contactEvents`). These are the pairs of bodies sharing a point where one of them is not static or is a
trigger, and one of them sees the other through its mask. Two static bodies never touch, unless one is a trigger. Each
body gets the other through its signals:

- `contactBegan`, when the two start touching;
- `contactStayed`, at each tick they still touch;
- `contactEnded`, when they no longer touch, or one of them leaves the scene.

The steps update the pairs more often than the ticks report them: each pair keeps whether the last report gave it
touching (`BroadPair::reported`), the report comparing it with the touching of the last step, and a pair dropped
during the steps while reported is kept aside for its end to be reported. A contact begun and ended within a tick is
not reported. A tick running no step updates the contacts where the bodies were moved (`updateContacts`).

A body leaving the scene ends its contacts at once, because its handle may go to another body before the next update.
The signals go through the slot emitters they are connected with, like the other signals of Balder:

```
crate:.contactBegan ():.connect (alias box, &self:.onCrateTouched);
```

### The narrowphase

`narrow::collide` gives the manifolds of two colliders: a normal from the first to the second, four points at most, each
as deep as the shapes overlap there, negative for a speculative point (the shapes apart). Two spheres, two capsules, a
sphere and a capsule, a sphere and a box, a sphere or a capsule on a plane have closed forms (Ericson, *Real-Time
Collision Detection*, 5.1.9 for the closest points of two segments). The other shapes take the normal of their
penetration (`gjk::penetration`: the closest points of their cores when the cores are apart, the expansion of a
polytope of their difference otherwise, van den Bergen), then the face of one clipped by the sides of the face of the
other (Sutherland-Hodgman), reduced to four spread points. A face is a face of a box, a flat face of a hull (its
triangles of one plane merged, `ConvexHull::polygons`), a cap of a cylinder as an octagon or a segment of its side, the
segment of a capsule lying across the normal. An edge against an edge, two faces facing neither the normal, keeps the
single point of the penetration.

A compound is opened into its parts, a mesh into its triangles near the other shape: a manifold by pair of convex sub
shapes, told apart by its key. A contact on an inactive edge of a mesh (between two triangles in nearly one plane, their
vertices welded by position) takes the normal of its triangle, so a box sliding over a floor does not catch on the
diagonal of its quads.

Two boxes take the axis they overlap the least along (`primitives::boxAxis`: their faces, then the products of their
edges, a face kept unless another axis separates them more by half a millimetre, two edges by 5 mm), the expansion of
the polytope failing on two faces barely touching. The manifold of two faces clipped takes the normal of the reference
face, exact where the normal of the penetration is only within the tolerance of the expansion.

The manifolds live on the pairs of the broadphase (`BroadPair::manifolds`), and their points carry the impulses of the
step before when they are found again: by the features making them, or within 2 cm on both shapes. The faces are clipped
in the buffers of a `ContactScratch` the world keeps (`narrow::collideWith`): the corners of the two faces, the two
polygons the side planes clip between, the points kept; what a pair keeps is copied once, its points reduced to four
(`narrow::collide` builds a scratch of its own, for a query or a test). A pair touches when
a point of its manifolds is not speculative; a trigger only tells whether it overlaps.

The speculative points cover what two bodies may travel toward each other in a step (2 cm at least, plus their relative
speed and their spins at the reach of their boxes): the solver will let them close in by that much and no more, so a
fast body does not pass through a thin one. That is the continuous collision of Balder, the bullets aside.

### Bullets

The speculative points leave two cases out. They are found once a step at the closest features of two bodies, so a thin
body spinning fast (a plank 2 cm thick thrown at 50 m/s spinning at 50 rad/s) may turn another part of itself into a
thin wall, or sink into it lying flat against it past its middle, the normal then pushing it through. And they cover a
whole step ahead, so a fast body passing by a corner gets a point there and is slowed by it (a ghost collision: a ball
at 50 m/s passing 1 cm over the edge of a box is nearly stopped).

A body whose settings are a `bullet` is advanced at each step, once its island is solved, along its motion of the step
against the static and the kinematic bodies it touches by their layers and masks, triggers and bodies a joint holds
apart left out (`PhysicsWorld::impactOf`). Its motion (`StepMotion`) is the straight line of the centre of its mass and
its rotation about it by the angle and the axis it turned through over the sub steps (`Quaternion::turn`, beyond half a
turn when it spins that fast). The bullet is stopped at the first impact, 5 mm from what it hits (`IMPACT_DISTANCE`),
its velocities kept: the rest of its step is dropped, and its speculative points take over at the next step, stopping
it, bouncing it back by its restitution or letting it slide.

Each convex part of its collider is advanced by the time of impact of Catto (`gjk::advance`, after `b2TimeOfImpact` of
Box2D, "Continuous Collision", GDC 2013). The closest points of the part and of the shape it may hit (`gjk`, its simplex
of four vertices at most held in place, started from the normal found last) give an axis. The point of the part the
deepest along the axis at the end of the step is followed along its actual motion back to the fraction at which its
separation along the axis comes to the stop distance (bisections and secants in turn), then the point the deepest
there, until the deepest one is at that distance. The separation along an axis never exceeds the distance between two
shapes, so the part comes no closer before that fraction; the closest points are searched again there, until the
shapes are within the stop distance, or the part stays farther along an axis to the end of the step. A point turning
about the centre of the mass may come closer along the axis between two fractions than at either of them, by its reach
times the square of the angle over 8 at most: the rest of the step is looked at in parts turning by little enough that
no point comes closer within one than at its ends by more than a quarter of the stop distance, so that the end of a
plank sweeping into a wall and back out within a step is caught. A half space (a plane) is its own axis, the
separation along its normal being the distance.

Only a fast bullet is advanced (after Box2D v3): what the cores of its shape travel over the step, its displacement
plus its angle times their reach from the centre of its mass, reaches half its half thickness, the thinnest of its
parts (both measured once a step, `PhysicsWorld::measureBullet`). A slower bullet sinks by less than that into what it
meets, and is left to its speculative points, which cover its speed as for any other body: a bullet resting or rolling
slowly moves as a body that is not one, and costs no more.

A part the bullet starts against (within 5 mm) is left to the contacts, else a bullet resting or sliding on the ground
would never move: its shape eroded by half its half thickness (`Convex::eroded`) is advanced instead, so that it sinks
by a part of its thickness and no more, then, sunk that deep, its core, a sphere about its centre (after Box2D v3). A
triangle of a mesh whose plane the bullet lies against but which it is apart from is left out, the bullet sliding onto
it from a neighbour over an inner edge (`Collider::advance`).

Against the static and the kinematic bodies, the speculative points of a fast bullet cover the spin of the cores of its
shape only (none for a ball), its advancement covering its speed: a corner it passes by gets no point. A bullet against
a dynamic body has the speculative points of any other body. A kinematic body is still during the steps, the game moving
it between them, so a bullet is advanced against where it is.

The `bullets` scene of `physbench` (see Measuring a step) throws planks spinning at thin walls and balls grazing low
blocks, again every two seconds: their advancement is about a fifth of a step there, the solver most of the rest.

## The solver

A step (`PhysicsWorld::step`) updates the pairs and their manifolds once (a pair whose bodies both sleep or are static
keeps its own), groups the bodies in islands, then solves and moves each awake island in `substeps` sub steps (4 by
default, more for an island of bodies of very different masses, see below; `solveIsland`, after Box2D v3):

- each manifold is a `ContactConstraint` (its bodies, its normal and two tangents, its frictions) over a range of
  `ConstraintPoint`s, prepared once a step: the arms of each point, its masses along the normal and the tangents, its
  separation, the speed it bounces back with; the bodies are copied as `SolverBody`s (their velocities, their centre,
  their inverse mass and inertia, gravity and their forces, none for a static or a kinematic body) the sub steps read
  and write without reaching the world;
- at each sub step, the velocities take gravity, the forces and the damping (`v / (1 + c h)`); the impulses the points
  gathered are applied first (warm starting), which is what lets a stack hold; `iterations` passes (2 by default) push,
  manifold by manifold, the normal of each of its points, the impulse gathered never pulling, then their friction,
  bounded by the friction times the impulse of the normal (the pyramid of the cone), then the rolling and the spinning
  friction of the manifold (see below); the velocities of the two bodies
  of a manifold are loaded once for its points and written back once; the bodies move by their velocities; a last pass
  relaxes the velocities the correction of the penetrations left, so pushing a body out gives it no speed;
- the separation of a point follows the motion of its bodies through the sub steps (their arms turned with them), the
  contacts being found once a step;
- once the sub steps are run, the points that closed faster than `bounce-threshold` (1 m/s) before the step and that
  a sub step pushed on bounce back by their restitution; the impulses are written back to the points of the manifolds,
  for the next step, and the velocities and the poses to the states. They are kept as those over a step (those of a
  sub step times the sub steps, the angular impulses of the manifolds and those of the joints alike), so that they
  carry over to a step of other sub steps.

A point apart (speculative) closes in by its gap and no more, which stops a fast body at a thin wall. A point sunk is
pushed out as by a spring of `contact-hertz` (60 Hz, a quarter of the rate of the sub steps at most) damped by
`contact-damping` (a ratio of 10), `max-correction` (2 m/s) at most (a soft contact, `Softness`). The material of a
contact is the geometric mean of the frictions (ice on rubber slides) and the larger restitution (a ball bounces off any
floor).

The friction acts at the points, so a ball rolling on a floor, or a top spinning on its point, would lose speed through
its damping only. The rolling friction is an angular impulse per manifold against the rolling of its two bodies about
the axes across its normal, bounded together (a disc) by the rolling friction times the impulse of all the normals of
the manifold times its radius; the spinning friction the same about the normal. The radius is the largest distance
along the normal from the centre of the mass of a body the solver moves to a point of the manifold: the radius of a
ball, of a cylinder on its side, the height of a top (`solver::prepareRolling`). The two frictions of a contact are the
geometric means of those of its bodies, like the friction, so a floor of none lets any ball roll. Their angular impulse
is carried by the manifold to the next step while its normal turns little, as the friction of its points. A ball of
radius `r` rolling at `v` on a floor of the same rolling friction `c` stops within `7 v² / (10 c g)` (its torque
`c m g r`, its inertia `2/5 m r²`), and a ball spinning on it slows by `5/2 c g / r`.

A stack of ten crates holds still with the sub steps and the soft contacts, and falls asleep within two seconds: at a
step of 1/60 s, more passes over the contacts left it swaying, and a rigid correction of the penetrations (Baumgarte)
acted as a spring with no damping. Finding the contacts once a step rather than at each sub step makes a step about five
times cheaper. A stack of thirty crates holds still too and sleeps within two seconds, its top 6 cm lower than it was
built, each contact giving 2 mm on average under the crates it carries; a pyramid of a hundred and five boxes, fourteen
at its base, sleeps within a second, no box moving by more than 5 mm. The correction of the penetrations gives the bodies
no speed, the last pass of a sub step relaxing the velocities it left: there is no need for split impulses.

### Large mass ratios

A soft contact is a spring on the mass of its point: under a load giving that mass an acceleration `a`, it sinks by
`a / ω²` (`ω` the angular frequency of the spring), so a crate of 1 kg alone on a floor sinks 0.07 mm at 60 Hz, but
under a crate of 500 kg, both its contacts carrying the weight of the heavy one, it sinks 500 times as deep, 3.5 cm
each. The frequency of the spring is bound by the rate of the sub steps (a quarter of it): stiffer, the springs no
longer converge in a few passes and the bodies bounce (a spring stiffened by the load of each point did, as did a
contact without give).

An island is therefore solved in more sub steps when its lightest body carrying its heaviest one would sink deeper
than `max-sink` (5 mm): the depth being `r g / ω²` for a ratio `r` of their masses, and its contacts stiffened by as
many more sub steps as it is given (`contact-hertz` being their frequency at `substeps`, `solver::softnessOf`), it takes
`substeps · sqrt(r g / max-sink) / ω` of them, `max-substeps` (16) at most (`solver::substepsOf`): 5 for a ratio of
100, 11 for 500, 15 for 1000. A crate of 1 kg then holds one of 100, 500 or 1000 kg and both sleep within a second,
each contact sinking 5 mm at most. The ratio is read from the masses, not from the impulses the points gathered: those
swell and shrink as the bodies bounce on the contacts, and sub steps following them stiffened the springs while they
were compressed and softened them while they were not, which kept the heavy crate bouncing. An island of bodies of the
same mass (a stack, a pile, a pyramid) keeps its `substeps`, whatever its height. `max-substeps` at `substeps` or less
(or `max-sink` at 0) solves every island in `substeps`, the depth of a light crate under a heavy one growing back with
the ratio of their masses.

### Islands and sleep

The islands are built again at each step, by union-find over the dynamic bodies: two of them share an island when
their pair has a point of contact, even speculative, or a joint holds them (see Joints). An `IslandSet` lays the
bodies, the pairs and the joints of the islands out island after island; it and the buffers of the solver (the solver
bodies, the constraints, their points and the joints) are kept
from step to step and only grow, so a step builds no map nor array for them. A static or a kinematic body joins no island, else the ground would
make the whole level one. An awake body, or a moving kinematic body, wakes the sleeping bodies it is in contact with,
their whole island with them: a stack wakes at once rather than a crate a step. An island whose bodies all stayed under
`sleep-linear` and `sleep-angular` for `sleep-time` sleeps, their velocities dropped; a body that cannot sleep keeps its
island awake. A body moved by the game, removed, pushed or given a velocity wakes what it touches.

### Kinematic bodies

The game moves a kinematic body by its node, once a tick. At the start of the steps of a tick, a kinematic body moved
since the last tick gets the velocities of its move (`deriveKinematics`): the displacement over the tick, the rotation
between its two orientations. The steps do not move it, it is where the game put it, but the solver pushes and carries
what it touches by its velocity, so a crate rides a platform. A kinematic body not moved has no velocity, unless the
game set one (`setVelocity`), kept until it moves again: a conveyor belt.

## Joints

A joint holds two bodies by a frame: its origin is the anchor, its X axis the axis of a hinge or a slider. The world
places the frame on each body as they are when the joint is made (`PhysicsWorld::addJoint (a, b, frame, settings)`, the
frame in the space of the pose of each body), and keeps the second frame where the first is, but for the motion its kind
leaves free (`JointSettings::kind`):

| Kind     | Keeps                                                    | Rows                         |
|----------|----------------------------------------------------------|------------------------------|
| `FIXED`  | the anchor shared and the two turned alike: one body     | 3 linear, 3 angular          |
| `BALL`   | the anchor shared, the bodies turning freely about it    | 3 linear                     |
| `HINGE`  | the anchor shared, the bodies turning about X only       | 3 linear, 2 angular, 1 axial |
| `SLIDER` | the bodies sliding along X without turning               | 2 linear, 3 angular, 1 axial |

The position of a hinge is the angle it turned by about its axis since it was made, in [-pi, pi]; that of a slider the
distance it slid along its axis (`jointPosition`). Both are 0 when the joint is made. The other `JointSettings`:

| Setting | Default | What it does |
|---|---|---|
| `limited`, `lower`, `upper` | false, 0, 0 | the position of a hinge (radians) or a slider (metres) kept within [lower, upper] |
| `motor`, `motorSpeed`, `maxMotorForce` | false, 0, 0 | the position driven at a speed, by a torque (N m) or a force (N) at most |
| `breakForce`, `breakTorque` | 0, 0 | the force of the linear rows and the torque of the angular rows the joint holds at most before it breaks, 0 never breaking |
| `collide` | false | whether the two bodies still touch each other; false leaves the limbs of a ragdoll free to overlap |

```
let hinge = world:.addJoint (post, door, RigidTransform (hinge, upright),
                             settings-> JointSettings (kind-> JointKind::HINGE, limited-> true, lower-> 0.0f, upper-> 1.6f));
```

A joint is solved by the solver of the contacts, with other rows (`joint_solver`, after Box2D v3): prepared once a step
(its arms from the centres of the masses to the anchors, the rotations of its frames in the world, `JointConstraint`),
turned with its bodies through the sub steps, warm started then solved before the contacts at each pass, relaxed with
them. The anchors are held by a block of three rows solved at once, the rotation of a fixed joint or a slider by a block
of three, the axis of a hinge by two rows across it, a slider on its axis by two linear rows across it. An error is pulled
back as by a spring of `joint-hertz` (60 Hz) damped by `joint-damping` (a ratio of 2), a soft joint (`Softness`). A limit
not reached lets its position close in by what is left of the way to it in the sub step and no more, as a speculative
contact does; a limit passed is pushed back by the spring. A motor drives the speed along the axis, its impulse bounded
by its force over the sub step. The impulses are kept on the joint from step to step (`Joint`).

The motor and the limits of a hinge are solved with its anchors kept on each other: each impulse along the axis comes
with the impulse at the anchors that leaves them where they are, and its mass is that of the bodies turning about the
anchor. A door hinged at its edge is five times heavier to turn about its hinge than about its centre: its limit solved
alone stopped it about its centre, the point of the hinge then turned it on, and it bounced back off its limit by 13% of
its speed whatever the passes. A slider keeps the plain row, its rotation being locked.

Two dynamic bodies joined share an island: they wake and sleep together, and a moving kinematic body wakes what it is
joined to. A joint to a static or a kinematic body is solved in the island of its dynamic body. Two bodies joined do not
touch each other unless `collide` says so: the world counts the joints holding each pair apart, and the broadphase keeps
no pair of them; the two find their pairs again once the last of their joints is removed or broken.

Once the sub steps are run, a joint that held its bodies by more than its `breakForce` or its `breakTorque` (its impulses
over the duration of a sub step, the motor and the limits counted along the axis) breaks: it holds nothing more, stays in
the world until it is removed, and `takeBroken` gives it once. Making, changing, removing or breaking a joint wakes its
bodies, their time still counted again, so a body held still until its joint broke falls. Removing a body removes its
joints.

### Joint3D

A `Joint3D` is a `Node3D` naming its two bodies (two `PhysicsBody3D`), its origin the anchor and its X axis the axis. It
is made in the world of its scene at the first tick it and its two bodies are in the scene, from where they are then, so
a node placed in the tick it is built in is joined where it is placed; moving it afterwards does not move the joint. A
body leaving the scene takes the joint out, made again at the first tick it is back. `settings` changes the joint at
once (a motor driven at another speed), `jointPosition` and `isBroken` read it, and `broken` is emitted after the steps of
the tick that broke it.

```
let dmut hinge = copy Joint3D ("door-hinge", alias root, post, door, settings-> JointSettings (kind-> JointKind::HINGE));
hinge:.setTransform (at, Quaternion::fromAxisAngle (pi / 2, makeVec3 (0.0f, 0.0f, 1.0f)), makeVec3 (1.0f, 1.0f, 1.0f));
hinge:.broken ():.connect (alias box, &self:.onDoorTorn);
```

## Characters

A `CharacterBody3D` is a kinematic capsule (0.4 metres of radius and 1.8 of height by default, its origin at its
centre) moved through the level by a `CharacterController`, by queries rather than by the solver. The game moves it
once a tick by a velocity it keeps from tick to tick, gravity added to it:

```
velocity.y -= 9.81f * seconds;
if jumping && character.canJump { velocity.y = 5.0f; character:.jumped (); }
velocity = character:.moveAndSlide (velocity, delta);
```

A move (`CharacterController::moveAndSlide`, `Scene::moveCharacter` under the lock of the scene) first pushes the
capsule out of what it sinks into (`penetrations`, `depenetrations` passes at most), then moves it across the up
direction, then along it. Each part casts the capsule (`shapeCast`), stops it a `skin` short of the first surface met
and turns what is left of the move along it, along the crease of two surfaces met one after the other, `maxSlides`
surfaces at most. The `CharacterSettings`:

| Setting | Default | What it does |
|---|---|---|
| `up` | +Y | the up direction, gravity pulling the other way |
| `slopeLimit` | 45° | the steepest floor; a steeper slope is a wall to a move that does not go down, the character sliding down it |
| `stepOffset` | 0.3 m | the highest ledge stepped onto: a walk stopped by a side too steep is tried again raised by it and put down on what is under it, kept when it went farther and landed on a floor |
| `snapDistance` | 0.3 m | how far below a character that was on the floor and does not go up it is put back on the ground, walking down a slope or a stair |
| `skin` | 0.01 m | the distance kept from the surfaces |
| `coyoteTime` | 0.15 s | the time the character can still jump once it walked off the floor (`canJump`, spent by `jumped`) |
| `pushMass` | 40 kg | the mass the character pushes the dynamic bodies it walks into with |
| `maxSlides`, `depenetrations` | 4, 4 | the surfaces slid along and the passes out of the bodies at most in a move |

After the motion, the floor is looked for a skin and a little more under the capsule (`onFloor`, `floorNormal`,
`floorBody`); `onWall` and `onCeiling` tell what else the move met. The velocity given back has lost what the walls
stopped and, on the floor, its fall; a floor does not turn it up a slope, so the next move is not taken for a jump.
The dynamic bodies met across the up direction are pushed by an impulse at the point met, the speed of the character
against them times the smaller of `pushMass` and their mass; the solver never pushes the character back, its body
being kinematic.

## The debug view

`Scene::physicsDebug` draws what the physics holds over the image of the scene, the bits of `PhysicsDebug` chosen:

| Category | Drawn |
|---|---|
| `SHAPES` | the colliders: grey static, blue kinematic, orange awake, green sleeping, yellow triggers; a plane as a grid and its normal |
| `CONTACTS` | the points of the manifolds, red crosses (pale when speculative), and their normals, yellow arrows |
| `BOXES` | the boxes of the colliders in the world |
| `BROADPHASE` | the hierarchy of the enlarged boxes (`Bvh::nodeBoxes`), the parents coloured by depth, the leaves cyan |
| `JOINTS` | the joints holding, pink: the arm from the centre of each body to its anchor, a cross at each anchor, the axis of a hinge or a slider |

The scene draws them at each tick after the steps (`ScenePhysics::drawDebug`, `debug_view::drawWorld`) in the
`physics` layer of its debug lines (see the debug lines of `doc/render-graph.md`), and clears the layer once no
category is drawn. `debug_view::drawCollider` draws a single collider in any `DebugLines`, and `debug_view::colorOfSettings` gives the colour
of a body by its settings out of a world (a dynamic body as an awake one): the editor draws the colliders of its scene
with them, its scene never stepped. In the `crates` example,
`--debug` draws the shapes, the contacts and the joints from the start, and `S`, `C`, `B`, `T` and `J` toggle the shapes,
the contacts, the boxes, the hierarchy and the joints.

## Measuring a step

`PhysicsWorld::timings` tells what the last step cost (`StepTimings`): the microseconds of its phases (the pairs, the
manifolds, the islands, the solve, the sleep, the whole step) and what it ran over (the pairs, the points solved, the
islands, the awake bodies). The `physbench` example builds a scene of dynamic bodies without a window and steps it,
printing the averages of a window of steps:

```
gyllir build physbench --release
./physbench --scene pile --count 1000 --steps 600 --window 60 [--no-sleep]
```

The scenes are `pile` (columns of boxes ten high), `pyramid` (walls of boxes, twenty at their base), `spheres` (on a
floor of triangles), `mix` (boxes, spheres, capsules and cylinders) and `bullets` (a lane by bullet, a plank 2 cm thick
spinning at 50 rad/s thrown at 50 m/s at a thin wall, or a ball thrown at 40 m/s over a low block, all thrown again
every two seconds). `--no-sleep` keeps every body awake, each step solving them all.

## Threads

The game moves its bodies from the activity thread (its ticks), and the editor from the main thread. The queries run
from either, all under the scene lock, like the visibility of the instances. The steps write only the arrays of the
world; the nodes of the dynamic bodies are placed once a tick, after the steps, in one pass under the lock
(`ScenePhysics::advance`). The renderer reads the nodes, never the world.

## Steps

The physics advances by steps of a fixed duration, `physics` steps a second (60 by default, `[timer]` of the
configuration), whatever the duration of the ticks: a `FixedStep` adds the delta of each tick and runs the steps it
covers, the time left over carried to the next tick. A tick runs `catchUp` steps at most (4 by default); the time beyond
them is dropped, so a long stall slows the simulation down instead of piling up steps. `alpha`, the time left over over
the duration of a step, places the display between the last two steps.

The scene runs the steps in its tick (`ScenePhysics::advance`), unless it does not simulate (`Scene::simulates`, false
in an `EditableScene`): its bodies are then in its world, where their nodes are, hit by the queries, but no step moves
them and no contact is reported. When it simulates: the kinematic velocities derived, the steps run, the
forces dropped, then each awake dynamic body places its node between its pose before the last step and its pose after
it, by `alpha` (`PhysicsBody3D::placeFromPhysics`, the pose of the world brought under the parent of the node, its scale
kept). That move does not go back to the world as a teleport. A body that fell asleep is placed once more where it
stopped, then no longer. A body moved by the game is placed where it is, not swept from where it was. The settings of
the solver are those of the `[physics]` table of the configuration:

```
[physics]
gravity = [0.0, -9.81, 0.0]
substeps = 4
max-substeps = 16
max-sink = 0.005
iterations = 2
contact-hertz = 60.0
contact-damping = 10.0
joint-hertz = 60.0
joint-damping = 2.0
max-correction = 2.0
bounce-threshold = 1.0
sleep-linear = 0.05
sleep-angular = 0.05
sleep-time = 0.5
```

The `crates` example (`./crates`) shows a stack of crates, two boxes on a slope (one sticking, one sliding), balls
bouncing, a chain swinging from a beam, a door closed by a weak motor against the lower limit of its hinge, a ragdoll
tumbling down stairs, and teapots falling on each other, the hulls of their decomposition
(`res/models/teapot/teapot.hulls`) their shape; Space throws a ball from the camera, `P` fires a plank spinning, a
bullet.

A body turns by its angular velocity through `Quaternion::integrated`, and is placed by a `RigidTransform` (a rotation
then a translation). A `Node3D` holds its rotation as a quaternion: the Euler angles it is given are kept for the editor
and the scene files, and read from the quaternion once it is set as one (`orientation`).

## Not done yet

- the joints in the scene files and in the editor;
- the convex decomposition of the models at the export of a project (BAL-138), the editor no longer decomposing them;
- the play mode of the editor, simulating the scene edited (BAL-134).
- an example walking a character through a level.

