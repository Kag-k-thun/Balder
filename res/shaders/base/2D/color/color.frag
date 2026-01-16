#version 450 core

layout (set = 0, binding = 0) uniform World {    
    vec2 translation;
    vec2 scale;
    vec4 color;        
    int level;
} world;

layout (location = 0) out vec4 out_color;

void main () {    
    out_color = vec4 (world.color.xyz, world.color.w);
}
