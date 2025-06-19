#version 450 core

layout (location = 0) in vec2 a_uv;
layout (location = 1) in vec2 a_pos;



layout (binding = 0) uniform World {
    vec2 dimension;
    vec2 translation;
    vec2 scale;
    vec3 color;
    float radius;
    vec4 rotation;
} world;

layout (binding = 1) uniform sampler2D diffuse;

layout (location = 0) out vec4 out_color;

void main () {
    vec2 pos = (abs(a_pos)) * vec2(world.dimension.x * world.scale.x, world.dimension.y * world.scale.y);

    float angle_left = acos (dot (vec2 (1, 0), a_pos) / (length (a_pos))) > 1.54 ? 1.0 : 0.0;
    float angle_right = acos (dot (vec2 (-1, 0), a_pos) / (length (a_pos))) > 1.54 ? 1.0 : 0.0;
    float angle_bottom = acos (dot (vec2 (0, 1), a_pos) / (length (a_pos))) > 1.54 ? 1.0 : 0.0;
    float angle_top = acos (dot (vec2 (0, -1), a_pos) / (length (a_pos))) > 1.54 ? 1.0 : 0.0;

    vec2 arc_cpt_vec_tl = max(pos - vec2(world.dimension.x * world.scale.x, world.dimension.y * world.scale.y) + world.radius, 0.0);
    vec2 arc_cpt_vec_tr = max(pos - vec2(world.dimension.x * world.scale.x, world.dimension.y * world.scale.y) + world.radius, 0.0);
    vec2 arc_cpt_vec_bl = max(pos - vec2(world.dimension.x * world.scale.x, world.dimension.y * world.scale.y) + world.radius, 0.0);
    vec2 arc_cpt_vec_br = max(pos - vec2(world.dimension.x * world.scale.x, world.dimension.y * world.scale.y) + world.radius, 0.0);

    if (length(arc_cpt_vec_tl) > world.radius && angle_top * angle_left > 0) discard;
    if (length(arc_cpt_vec_tr) > world.radius && angle_top * angle_right > 0) discard;
    if (length(arc_cpt_vec_bl) > world.radius && angle_bottom * angle_left > 0) discard;
    if (length(arc_cpt_vec_br) > world.radius && angle_bottom * angle_right > 0) discard;

    vec4 texColor = texture (diffuse, a_uv);
    out_color = texColor;
}
