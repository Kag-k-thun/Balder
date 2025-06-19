#version 450 core

layout (location = 0) in vec3 position;

layout (binding = 0) uniform World {
    vec2 dimension;
    vec2 translation;
    vec2 scale;
    float radius;

    vec4 color;
    vec4 rotation;
} world;

layout (location = 0) out vec2 a_uv;

out gl_PerVertex {
    vec4 gl_Position;
};

void main () {
    mat2 rot = mat2 (world.rotation.x, world.rotation.y, world.rotation.z, world.rotation.w);
    vec2 pos = (rot * (position.xy - 0.5));
    vec2 translation = world.translation - (world.dimension - world.scale / 2); // + (world.scale / 2);

    pos = ((pos * world.scale + translation) / world.dimension);

    gl_Position =  vec4 (pos, 0, 1);
    a_uv = position.xy - 0.5;
}
