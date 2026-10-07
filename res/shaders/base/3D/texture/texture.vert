#version 450 core

layout (location = 0) in vec3 inPosition;
layout (location = 1) in vec3 inNormals;
layout (location = 2) in vec2 inUV;

layout(set = 0, binding = 0) uniform World {
    mat4 model;

    // The progress of the cross-fade between two levels of detail of the mesh, from 0 to 1
    float fade;
} world;

layout(set = 1, binding = 0) uniform Camera {
    mat4 proj;
    mat4 view;
    mat4 viewProj;
    vec3 eyePos;
} camera;

layout (location = 0) out vec4 outPosition;
layout (location = 1) out vec3 outNormals;
layout (location = 2) out vec2 outUV;

// The cross-fade of the draw: .x its progress, .y the role of the draw, its first instance (0 for a level drawn alone,
// 1 for the outgoing level of a cross-fade, 2 for the incoming one)
layout (location = 3) flat out vec2 outFade;

out gl_PerVertex {
    vec4 gl_Position;
};

void main () {    
    vec4 viewPos = camera.view * world.model * vec4 (inPosition, 1.0);    
    gl_Position = camera.proj * viewPos;
    
    outPosition = viewPos;    
    outNormals = inNormals;
    outUV = inUV;
    outFade = vec2 (world.fade, float (gl_InstanceIndex));
}
