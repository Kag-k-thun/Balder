#version 450 core

// The corner of a glyph quad, in window units from the origin of the text
layout (location = 0) in vec2 position;
layout (location = 1) in vec2 textureUV;

layout (push_constant) uniform Window {
    uvec2 dimension;
} window;

layout (set = 0, binding = 0) uniform World {
    vec2 translation;
    vec2 scale;
    vec4 color;
    int level;
} world;


layout (location = 0) out vec2 a_uv;

out gl_PerVertex {
    vec4 gl_Position;
};

void main () {
    vec2 pos = ((world.translation + position) / window.dimension) * 2 - 1;

    gl_Position = vec4 (pos, 1 - (world.level * 0.0001), 1);
    a_uv = textureUV;
}
