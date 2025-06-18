#version 450 core

layout (location = 0) in vec2 a_uv;

layout (binding = 0) uniform World {
    vec2 translation;
    vec2 scale;
    mat2 rotation;
    vec3 color;
} world;


layout (binding = 1) uniform sampler2D diffuse;

layout (location = 0) out vec4 out_color;

void main () {
    vec4 texColor = texture (diffuse, a_uv);
    out_color = max (texColor, vec4 (world.color, 0.0));
}
