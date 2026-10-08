#version 450 core

layout (location = 0) in vec2 position;
layout (location = 1) in vec2 textureUV;

layout (push_constant) uniform Window {
    // The dimension of the framebuffer, in CSS pixels
    uvec2 dimension;

    // The number of framebuffer pixels in a CSS pixel
    vec2 ratio;
} window;

// The data of a shape, in the slot its draws give as their instance (see ShapeDrawer)
struct Object {
    vec2 translation;
    vec2 scale;
    vec4 color;

    // The rectangle the shape is cut to, its corners in CSS pixels
    vec4 scissors;
    int level;
};

layout (std430, set = 0, binding = 0) readonly buffer Objects {
    Object objects [];
};

layout (location = 0) out vec2 a_uv;

// The color of the shape
layout (location = 1) flat out vec4 outColor;

// The scissors of the shape, its offset and extent in framebuffer pixels
layout (location = 2) flat out ivec4 outScissors;

out gl_PerVertex {
    vec4 gl_Position;
};

// The scissors of a shape in framebuffer pixels, truncated like the scissors of vkCmdSetScissor were: .xy its offset,
// .zw its extent
ivec4 framebufferScissors (vec4 scissors) {
    vec2 start = max (vec2 (0), scissors.xy * window.ratio);
    vec2 extent = max (vec2 (0), scissors.zw * window.ratio - start);
    return ivec4 (ivec2 (start), ivec2 (extent));
}

void main () {
    Object world = objects [gl_InstanceIndex];

    vec2 rotatedCenter = (position.xy) + 1;
    vec2 scaledCenter = rotatedCenter * (world.scale / window.dimension);
    vec2 pos = scaledCenter + ((world.translation / (window.dimension / 2)) - 1);

    gl_Position =  vec4 (pos, 1 - (world.level * 0.0001), 1);
    a_uv = textureUV;
    outColor = world.color;
    outScissors = framebufferScissors (world.scissors);
}
