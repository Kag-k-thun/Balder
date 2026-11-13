# The physics of a scene

A scene holds the bodies of its nodes in a physics world. The queries (rays, shape casts, overlaps) run on them, and
each tick tells the bodies which others they touch. Nothing moves the bodies yet: there is no solver, no gravity and no
dynamic body, so a body is static or moved by the game (kinematic). The queries need none of these, only the colliders
and the broadphase.

The code lives in `balder::scene::physics`, and the node in `balder::scene::node::node3D::body`.

## Bodies

A `PhysicsBody3D` is a `Node3D` holding the shape of its collider (`ColliderShape`) and its `BodySettings`:

- **motion**: `STATIC` (the ground, the walls) or `KINEMATIC` (a door, a platform, a character moved by the game);
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

| Kind      | Built with                           | Notes                                                    |
|-----------|--------------------------------------|----------------------------------------------------------|
| `BOX`     | `ColliderShape::box (size)`          | a side along each axis of the body                       |
| `SPHERE`  | `ColliderShape::sphere (radius)`     |                                                          |
| `CAPSULE` | `ColliderShape::capsule (r, height)` | along the Y axis, its caps included in its height        |
| `MESH`    | `ColliderShape::mesh (triangles)`    | a `TriangleBvh`, its hierarchy built at once             |

`ColliderShape (volume)` gives the shape of a `VolumeShape`, the shape of a `Volume3D`. A mesh is only a surface: a
ray hits its triangles from either side, a shape overlaps it only when it crosses a triangle, and two meshes never
touch. A mesh shape can share the triangles a mesh instance keeps for its picking (`Scene::keepsTriangles`).

The transformation of the body may scale its shape. A box is scaled along each of its axes, and sheared under a parent
scaled along other axes. A mesh is transformed as it is drawn. A sphere stays round, scaled by the largest scale of the
transformation. A capsule is scaled along its axis by the scale of Y (its cylinder), and its radius by the larger of the
scales of X and Z.

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

At each tick, after the nodes are ticked, the scene updates the contacts (`PhysicsWorld::updateContacts`). These are
the pairs of bodies sharing a point where one of them is kinematic or a trigger, and one of them sees the other through
its mask. Two static bodies never touch, unless one is a trigger. Each body gets the other through its signals:

- `contactBegan`, when the two start touching;
- `contactStayed`, at each update they still touch;
- `contactEnded`, when they no longer touch, or one of them leaves the scene.

A body leaving the scene ends its contacts at once, because its handle may go to another body before the next update.
The signals go through the slot emitters they are connected with, like the other signals of Balder:

```
crate:.contactBegan ():.connect (alias box, &self:.onCrateTouched);
```

## Threads

The game moves its bodies from the activity thread (its ticks), and the editor from the main thread. The queries run
from either, all under the scene lock, like the visibility of the instances. Nothing writes the transformations back
yet, so there is no contention: when the solver writes the transformation of every dynamic body at each step, its
results should be double-buffered rather than written under the lock body by body. The interpolation between two steps
can then read the two buffers.

## Steps

The physics advances by steps of a fixed duration, `physics` steps a second (60 by default, `[timer]` of the
configuration), whatever the duration of the ticks: a `FixedStep` adds the delta of each tick and runs the steps it
covers, the time left over carried to the next tick. A tick runs `catchUp` steps at most (4 by default); the time beyond
them is dropped, so a long stall slows the simulation down instead of piling up steps. `alpha`, the time left over over
the duration of a step, places the display between the last two steps.

A body turns by its angular velocity through `Quaternion::integrated`, and is placed by a `RigidTransform` (a rotation
then a translation). A `Node3D` holds its rotation as a quaternion: the Euler angles it is given are kept for the editor
and the scene files, and read from the quaternion once it is set as one (`orientation`).

## Not done yet

- dynamic bodies, the narrowphase giving contact points and depths (GJK/EPA), the solver, and the transformations
  written back to the nodes;
- the bodies in the scene files and in the editor (their panel, their wires);
- the debug view of the colliders and a character controller.

