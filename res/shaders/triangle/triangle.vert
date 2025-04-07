#version 450

layout(binding = 0) uniform World {
    mat4 model;
} world;

layout(binding = 1) uniform Camera {
    mat4 view;
    mat4 proj;
} camera;


layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inColor;
layout (location = 2) in vec2 inUV;

layout (location = 0) out vec3 outColor;
layout (location = 1) out vec2 outUV;

void main() {
    gl_Position = camera.proj * camera.view * world.model * vec4 (inPosition, 1.0);
    outColor = inColor;
    outUV = inUV;
}
