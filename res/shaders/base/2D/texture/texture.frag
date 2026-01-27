#version 450 core

layout (location = 0) in vec2 a_uv;

layout (set = 0, binding = 0) uniform World {
    vec2 translation;
    vec2 scale;
    vec4 color;        
    int level;
} world;

layout (set = 0, binding = 1) uniform sampler2D diffuse;
layout (location = 0) out vec4 out_color;

void main () {     
    vec4 texColor = texture (diffuse, a_uv);
    out_color = texColor * world.color;
}
