#version 450 core

layout (location = 0) in vec2 a_uv;
layout (location = 1) in vec2 a_pos;

layout (binding = 0) uniform World {
    vec2 dimension;
    vec2 translation;
    vec2 scale;
    float radius;
    int level;

    vec4 color;
    vec4 rotation;
} world;

layout (binding = 1) uniform sampler2D diffuse;
layout (location = 0) out vec4 out_color;

void main () {
    if (world.radius > 0) {
        mat2 rot = mat2 (world.rotation.x, world.rotation.y, world.rotation.z, world.rotation.w);

        vec2 top_left = vec2 (-0.5 + world.radius, -0.5 + world.radius);
        vec2 top_right = vec2 (0.5 - world.radius, -0.5 + world.radius);
        vec2 bottom_left = vec2 (-0.5 + world.radius, 0.5 - world.radius);
        vec2 bottom_right = vec2 (0.5 - world.radius, 0.5 - world.radius);

        vec2 dist_top_left = (a_pos - top_left);
        vec2 dist_top_right = (a_pos - top_right);
        vec2 dist_bottom_right = (a_pos - bottom_right);
        vec2 dist_bottom_left = (a_pos - bottom_left);

        if (length (dist_top_left) > world.radius     && (a_pos.x < top_left.x && a_pos.y < top_left.y)) discard;
        if (length (dist_top_right) > world.radius    && (a_pos.x > top_right.x && a_pos.y < top_right.y)) discard;
        if (length (dist_bottom_right) > world.radius && (a_pos.x > bottom_right.x && a_pos.y > bottom_right.y)) discard;
        if (length (dist_bottom_left) > world.radius  && (a_pos.x < bottom_left.x && a_pos.y > bottom_left.y)) discard;
    }

    vec4 texColor = texture (diffuse, a_uv);
    out_color = vec4 (texColor.xyz * world.color.xyz, texColor.w);
}
