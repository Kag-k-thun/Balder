#version 450 core

// The vertex shader of the depth prepass of the 3D shaders, reading the positions only, the first entry of their vertices

layout (location = 0) in vec3 inPosition;

layout(set = 1, binding = 0) uniform Camera {
    mat4 proj;
    mat4 view;
    mat4 viewProj;
    vec3 eyePos;
} camera;

// The data of an object, in the slot given by the words of its instances (see the draws of IndexedMesh3D)
struct Object {
    mat4 model;

    // The progress of the cross-fade between two levels of detail of the mesh, from 0 to 1
    float fade;

    // The index of the material of the object in the composition pass
    uint material;

    // The center and the half size along each axis of the box enclosing the object in world space, read by the cull
    // pass of the scene (an empty box has a negative extent)
    vec4 boxCenter;
    vec4 boxExtent;

    // The world the frame before drew the object with, the motion of its pixels being written in the g-buffer
    mat4 previousModel;
};

layout (std430, set = 0, binding = 0) readonly buffer Objects {
    Object objects [];
};

// The word of each instance drawn: the slot of its object above the two low bits, and in them the role of the draw
layout (std430, set = 0, binding = 1) readonly buffer Instances {
    uint instances [];
};

// The cross-fade of the draw: .x its progress, .y the role of the draw, the two low bits of its word (0 for a level
// drawn alone, 1 for the outgoing level of a cross-fade, 2 for the incoming one)
layout (location = 0) flat out vec2 outFade;

// Computed as the vertex shaders of the passes compute it, so the passes find the depth written by the prepass
out gl_PerVertex {
    invariant vec4 gl_Position;
};

void main () {
    uint word = instances [gl_InstanceIndex];
    Object object = objects [word >> 2];

    vec4 viewPos = camera.view * object.model * vec4 (inPosition, 1.0);
    gl_Position = camera.proj * viewPos;

    outFade = vec2 (object.fade, float (word & 3u));
}
