#version 450 core

layout (location = 0) in vec2 position;

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

    // The widths of the ring the shape is drawn as (top, bottom, left, right), in CSS pixels, the whole shape being
    // drawn when they are all 0
    vec4 edges;

    // The rectangle the shape is drawn in, its corners in CSS pixels, and the radii of its corners clockwise from the
    // top left one
    vec4 box;
    vec4 radii;
    int level;
};

layout (std430, set = 0, binding = 0) readonly buffer Objects {
    Object objects [];
};

// The color of the shape
layout (location = 0) flat out vec4 outColor;

// The scissors of the shape, its offset and extent in framebuffer pixels
layout (location = 1) flat out ivec4 outScissors;

// The rectangle the shape is drawn in, its corners in CSS pixels
layout (location = 2) flat out vec4 outBox;

// The widths of the ring the shape is drawn as (top, bottom, left, right)
layout (location = 3) flat out vec4 outEdges;

// The number of framebuffer pixels in a CSS pixel
layout (location = 4) flat out vec2 outRatio;

// The radii of the corners of the box, clockwise from the top left one
layout (location = 5) flat out vec4 outRadii;

out gl_PerVertex {
    vec4 gl_Position;
};

// The scissors of a shape in framebuffer pixels, the pixels whose centre is in their rectangle as the rasterizer covers
// a quad, its corners being snapped to the subpixel precision of the rasterizer before: .xy its offset, .zw its extent
ivec4 framebufferScissors (vec4 scissors) {
    vec4 corners = max (vec4 (0), ceil (round (scissors * window.ratio.xyxy * 256.0) / 256.0 - 0.5));
    return ivec4 (corners.xy, max (vec2 (0), corners.zw - corners.xy));
}

void main () {
    Object world = objects [gl_InstanceIndex];

    // the quad is grown by a framebuffer pixel past each side, so that the fragment shader decides alone which pixels
    // the box of the shape covers, an edge on the centre of a pixel being moved past it by the rounding of the position
    vec2 margin = 1.0 / window.ratio;
    vec2 translation = world.translation - margin;
    vec2 scale = world.scale + 2.0 * margin;

    vec2 rotatedCenter = position.xy + 1;
    vec2 scaledCenter = rotatedCenter * (scale / window.dimension);
    vec2 pos = scaledCenter + ((translation / (window.dimension / 2)) - 1);

    gl_Position =  vec4 (pos.x, pos.y, 1 - (world.level * 0.0001), 1);
    outColor = world.color;
    outScissors = framebufferScissors (world.scissors);
    outBox = world.box;
    outEdges = world.edges;
    outRatio = window.ratio;
    outRadii = world.radii;
}
