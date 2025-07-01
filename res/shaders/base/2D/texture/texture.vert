#version 450 core

layout (location = 0) in vec2 position;
layout (location = 1) in vec2 textureUV;

layout (binding = 0) uniform World {
    vec2 dimension;
    vec2 translation;
    vec2 scale;
    float radius;
    int level;

    vec4 color;
    vec4 rotation;
    vec4 scissors;
} world;

layout (location = 0) out vec2 a_uv;
layout (location = 1) out vec2 a_pos;

out gl_PerVertex {
    vec4 gl_Position;
};

void main () {
    mat2 rot = mat2 (world.rotation.x, world.rotation.y, world.rotation.z, world.rotation.w);
    vec2 rotatedCenter = (rot * position.xy) + 1;
    vec2 scaledCenter = rotatedCenter * (world.scale / world.dimension);
    vec2 pos = scaledCenter + ((world.translation / (world.dimension / 2)) - 1);

    gl_Position =  vec4 (pos, 1 - (world.level * 0.001), 1);
    a_pos = position.xy - 0.5;
    a_uv = textureUV;
}
