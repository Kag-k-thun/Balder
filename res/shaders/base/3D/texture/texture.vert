#version 450 core

layout (location = 0) in vec3 inPosition;
layout (location = 1) in vec3 inNormals;
layout (location = 2) in vec2 inUV;

layout(set = 0, binding = 0) uniform World {
    mat4 model;
} world;

layout(set = 1, binding = 1) uniform Camera {
    mat4 proj;
    mat4 view;
    mat4 viewProj;
    vec3 eyePos;
} camera;

layout (location = 0) out vec4 outPosition;
layout (location = 1) out vec3 outNormals;
layout (location = 2) out vec2 outUV;

out gl_PerVertex {
    vec4 gl_Position;
};

void main () {    
    vec4 viewPos = camera.view * world.model * vec4 (inPosition, 1.0);    
    gl_Position = camera.proj * viewPos;  
    
    outPosition = gl_Position;    
    outNormals = inNormals;
    outUV = inUV;
}
