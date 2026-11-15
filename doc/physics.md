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

`ColliderShape (volume)` gives the shape of a `VolumeShape`, the shape of a `Volume3D`. A mesh is only a surface: a
ray hits its triangles from either side, a shape overlaps it only when it crosses a triangle, and two meshes never
touch. A mesh shape can share the triangles a mesh instance keeps for its picking (`Scene::keepsTriangles`).

The transformation of the body may scale its shape. A box is scaled along each of its axes, and sheared under a parent
scaled along other axes. A mesh is transformed as it is drawn. A sphere stays round, scaled by the largest scale of the
transformation. A capsule is scaled along its axis by the scale of Y (its cylinder), and its radius by the larger of the
scales of X and Z.

`SolidObjectModel::hulls` gives the compound of the hulls of the meshes of a model, one by material, before the model
enters a scene that does not keep its triangles. A concave model is authored by hand as a compound: there is no convex
decomposition. A plane has no box: the world keeps its planes apart from its hierarchy and tests them in every query.

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
the contacts, refit when a body moves.

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
| `pickBody (pixel, filter)`                             | the body the camera sees first through a pixel         |

A `BodyHit` gives the body, the distance along the ray (or travelled by the shape), the point hit and the normal of the
surface there, facing the ray. A ray starting inside a box, a sphere or a capsule hits it at distance 0, its normal
opposite the ray; a shape cast starting against a body hits it at distance 0 too.

A `QueryFilter` chooses the bodies hit: the layers of its `mask`, the triggers when `triggers` is set, and none of the
handles in `exclude` (the body of a character casting a ray from itself).

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
fast body does not pass through a thin one. That is the continuous collision of Balder; a body spinning faster than its
box accounts for, or slowed by a speculative point at a corner it only brushes past, would need conservative
advancement (`gjk::sweep`) for the few bodies flagged as bullets.

## The solver

A step (`PhysicsWorld::step`) updates the pairs and their manifolds once (a pair whose bodies both sleep or are static
keeps its own), groups the bodies in islands, then solves and moves each awake island in `substeps` sub steps (4 by
default, `solveIsland`, after Box2D v3):

- each manifold is a `ContactConstraint` (its bodies, its normal and two tangents, its friction) over a range of
  `ConstraintPoint`s, prepared once a step: the arms of each point, its masses along the normal and the tangents, its
  separation, the speed it bounces back with; the bodies are copied as `SolverBody`s (their velocities, their centre,
  their inverse mass and inertia, gravity and their forces, none for a static or a kinematic body) the sub steps read
  and write without reaching the world;
- at each sub step, the velocities take gravity, the forces and the damping (`v / (1 + c h)`); the impulses the points
  gathered are applied first (warm starting), which is what lets a stack hold; `iterations` passes (2 by default) push,
  manifold by manifold, the normal of each of its points, the impulse gathered never pulling, then their friction,
  bounded by the friction times the impulse of the normal (the pyramid of the cone); the velocities of the two bodies
  of a manifold are loaded once for its points and written back once; the bodies move by their velocities; a last pass
  relaxes the velocities the correction of the penetrations left, so pushing a body out gives it no speed;
- the separation of a point follows the motion of its bodies through the sub steps (their arms turned with them), the
  contacts being found once a step;
- once the sub steps are run, the points that closed faster than `bounce-threshold` (1 m/s) before the step and that
  a sub step pushed on bounce back by their restitution; the impulses are written back to the points of the manifolds,
  for the next step, and the velocities and the poses to the states.

A point apart (speculative) closes in by its gap and no more, which stops a fast body at a thin wall. A point sunk is
pushed out as by a spring of `contact-hertz` (60 Hz, a quarter of the rate of the sub steps at most) damped by
`contact-damping` (a ratio of 10), `max-correction` (2 m/s) at most (a soft contact, `Softness`). The material of a
contact is the geometric mean of the frictions (ice on rubber slides) and the larger restitution (a ball bounces off any
floor).

A stack of ten crates holds still with the sub steps and the soft contacts, and falls asleep within two seconds: at a
step of 1/60 s, more passes over the contacts left it swaying, and a rigid correction of the penetrations (Baumgarte)
acted as a spring with no damping. Finding the contacts once a step rather than at each sub step makes a step about five
times cheaper.

### Islands and sleep

The islands are built again at each step, by union-find over the dynamic bodies: two of them share an island when
their pair has a point of contact, even speculative. An `IslandSet` lays the bodies and the pairs of the islands out
island after island; it and the buffers of the solver (the solver bodies, the constraints and their points) are kept
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
floor of triangles) and `mix` (boxes, spheres, capsules and cylinders). `--no-sleep` keeps every body awake, each step
solving them all.

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

The scene runs the steps in its tick (`ScenePhysics::advance`): the kinematic velocities derived, the steps run, the
forces dropped, then each awake dynamic body places its node between its pose before the last step and its pose after
it, by `alpha` (`PhysicsBody3D::placeFromPhysics`, the pose of the world brought under the parent of the node, its scale
kept). That move does not go back to the world as a teleport. A body that fell asleep is placed once more where it
stopped, then no longer. A body moved by the game is placed where it is, not swept from where it was. The settings of
the solver are those of the `[physics]` table of the configuration:

```
[physics]
gravity = [0.0, -9.81, 0.0]
substeps = 4
iterations = 2
contact-hertz = 60.0
contact-damping = 10.0
max-correction = 2.0
bounce-threshold = 1.0
sleep-linear = 0.05
sleep-angular = 0.05
sleep-time = 0.5
```

The `crates` example (`./crates`) shows a stack of crates, two boxes on a slope (one sticking, one sliding) and balls
bouncing; Space throws a ball from the camera.

A body turns by its angular velocity through `Quaternion::integrated`, and is placed by a `RigidTransform` (a rotation
then a translation). A `Node3D` holds its rotation as a quaternion: the Euler angles it is given are kept for the editor
and the scene files, and read from the quaternion once it is set as one (`orientation`).

## Not done yet

- joints (fixed, hinge, ball and socket, slider), the same solver with other rows (BAL-197);
- the bodies in the scene files and in the editor (their panel, their wires);
- the debug view of the colliders and a character controller.

