#version 450 core

layout (location = 0) in vec3 position;
layout (location = 1) in vec2 textureUV;

layout (binding = 0) uniform World {
    vec2 translation;
    vec2 scale;
    mat2 rotation;
} world;

layout (location = 0) out vec2 a_uv;

void main () {
    vec2 pos = world.rotation * position.xy;
    gl_Position =  vec4 ((pos.xy * world.scale) + world.translation, 1, 1);
    a_uv = textureUV;
}
