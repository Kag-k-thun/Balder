#version 450 core

layout (location = 0) in vec2 a_uv;
layout (location = 1) in vec2 a_pos;

layout (binding = 0) uniform World {
    vec2 dimension;
    vec2 translation;
    vec2 scale;

    int radius;
    int level;

    vec4 color;
    vec4 rotation;
    vec4 scissors;
} world;

layout (binding = 1) uniform sampler2D diffuse;
layout (location = 0) out vec4 out_color;


float sdRountRect (vec2 pos, vec2 ext, vec2 cr) {
    vec2 s = step (pos, vec2 (0.0));
    float r = mix (mix (cr.x, cr.y, s.y),
                   mix (cr.x, cr.y, s.y),
                   s.x);

    return length (max (abs (pos) + vec2 (r) - ext, 0.0)) - r;
}


void main () {
    if (gl_FragCoord.x < world.scissors.x || gl_FragCoord.x > world.scissors.z) { discard; }
    if (gl_FragCoord.y < world.scissors.y || gl_FragCoord.y > world.scissors.w) { discard; }

    vec2 pos = a_pos * world.scale / world.dimension.yy;
    vec2 size = vec2 (0.5, 0.5) * world.scale / world.dimension.yy;
    float dist = sdRountRect (pos, size, vec2 (world.radius) / world.dimension);
    if (dist > 0.0) discard;

    vec4 texColor = texture (diffuse, a_uv);
    out_color = texColor * world.color;
}
