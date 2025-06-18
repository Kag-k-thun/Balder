#version 450 core

layout (location = 0) in vec2 a_uv;


layout (binding = 0) uniform World {
    vec2 dimension;
    vec2 translation;
    vec2 scale;
    vec3 color;
    vec4 rotation;
} world;

layout (location = 0) out vec4 out_color;

void main () {
    // vec2 pos = (abs(a_uv)) * vec2(dimensions.x * world.scale.x, dimensions.y * world.scale.y);

    // float angle_left = acos (dot (vec2 (1, 0), a_uv) / (length (a_uv))) > 1.54 ? 1.0 : 0.0;
    // float angle_right = acos (dot (vec2 (-1, 0), a_uv) / (length (a_uv))) > 1.54 ? 1.0 : 0.0;
    // float angle_bottom = acos (dot (vec2 (0, 1), a_uv) / (length (a_uv))) > 1.54 ? 1.0 : 0.0;
    // float angle_top = acos (dot (vec2 (0, -1), a_uv) / (length (a_uv))) > 1.54 ? 1.0 : 0.0;

    // vec2 arc_cpt_vec_tl = max(pos - vec2(dimensions.x * world.scale.x, dimensions.y * world.scale.y) + radius.x, 0.0);
    // vec2 arc_cpt_vec_tr = max(pos - vec2(dimensions.x * world.scale.x, dimensions.y * world.scale.y) + radius.y, 0.0);
    // vec2 arc_cpt_vec_bl = max(pos - vec2(dimensions.x * world.scale.x, dimensions.y * world.scale.y) + radius.z, 0.0);
    // vec2 arc_cpt_vec_br = max(pos - vec2(dimensions.x * world.scale.x, dimensions.y * world.scale.y) + radius.w, 0.0);

    // if (length(arc_cpt_vec_tl) > radius.x && angle_top * angle_left > 0) discard;
    // if (length(arc_cpt_vec_tr) > radius.y && angle_top * angle_right > 0) discard;
    // if (length(arc_cpt_vec_bl) > radius.z && angle_bottom * angle_left > 0) discard;
    // if (length(arc_cpt_vec_br) > radius.w && angle_bottom * angle_right > 0) discard;

    out_color = vec4 (world.color, 1); // world.color, 1.0);
}
