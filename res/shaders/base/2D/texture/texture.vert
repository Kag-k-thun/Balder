#version 450 core

layout (location = 0) in vec2 position;
layout (location = 1) in vec2 textureUV;

layout (binding = 0) uniform World {
    vec2 dimension;
    vec2 translation;
    vec2 scale;
    
    int level;

    vec4 color;    
    vec4 scissors;
} world;

layout (location = 0) out vec2 a_uv;
layout (location = 1) out vec2 a_pos;

out gl_PerVertex {
    vec4 gl_Position;
};

void main () {    
    vec2 rotatedCenter = (position.xy) + 1;
    vec2 scaledCenter = rotatedCenter * (world.scale / world.dimension);
    vec2 pos = scaledCenter + ((world.translation / (world.dimension / 2)) - 1);

    gl_Position =  vec4 (pos, 1 - (world.level * 0.0001), 1);
    a_pos = position.xy / 2;
    a_uv = textureUV;
}
