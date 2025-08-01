#version 450 core

layout (location = 0) in vec2 a_uv;
layout (location = 1) in vec2 a_pos;

layout (binding = 0) uniform World {
    vec2 dimension;
    vec2 translation;
    vec2 scale;

    int level;

    vec4 color;
    vec4 rotation;
    vec4 scissors;
} world;

layout (binding = 1) uniform sampler2D diffuse;
layout (location = 0) out vec4 out_color;

void main () {
    if (gl_FragCoord.x < world.scissors.x || gl_FragCoord.x > world.scissors.z) { discard; }
    if (gl_FragCoord.y < world.scissors.y || gl_FragCoord.y > world.scissors.w) { discard; }

    vec4 texColor = texture (diffuse, a_uv);
    out_color = texColor * world.color;
}
