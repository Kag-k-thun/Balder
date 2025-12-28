#version 450 core

layout (location = 0) in vec3 inPosition;
layout (location = 1) in vec3 inNormals;
layout (location = 2) in vec2 inUV;

layout(binding = 0) uniform World {
    mat4 model;
} world;

layout(binding = 1) uniform Camera {
    mat4 proj;
    mat4 view;
    mat4 viewProj;
} camera;

layout(binding = 2) uniform Color {
    vec4 color;
} color;

layout (location = 0) out vec4 outPosition;
layout (location = 1) out vec3 outNormals;
layout (location = 2) out vec2 outUV;

out gl_PerVertex {
    vec4 gl_Position;
};

void main () {
    gl_Position = camera.viewProj * world.model* vec4 (inPosition, 1.0);    
    
    outPosition = gl_Position;
    outNormals = inNormals;
    outUV = inUV;
}
