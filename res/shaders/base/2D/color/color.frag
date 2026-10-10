#version 450 core

// The color of the shape
layout (location = 0) flat in vec4 inColor;

// The scissors of the shape, its offset and extent in framebuffer pixels
layout (location = 1) flat in ivec4 inScissors;

// The rectangle of the shape, its corners in CSS pixels
layout (location = 2) flat in vec4 inQuad;

// The widths of the ring the shape is drawn as (top, bottom, left, right)
layout (location = 3) flat in vec4 inEdges;

// The number of framebuffer pixels in a CSS pixel
layout (location = 4) flat in vec2 inRatio;

layout (location = 0) out vec4 out_color;

// The colors of the shapes are sRGB values, like those of the style sheets, and the framebuffer encodes linear ones
vec3 srgbToLinear (vec3 c) {
    return mix (c / 12.92, pow ((c + 0.055) / 1.055, vec3 (2.4)), step (vec3 (0.04045), c));
}

// Discard the pixels out of the scissors of the shape
void cut () {
    ivec2 pixel = ivec2 (gl_FragCoord.xy);
    if (any (lessThan (pixel, inScissors.xy)) || any (greaterThanEqual (pixel, inScissors.xy + inScissors.zw))) {
        discard;
    }
}

// The pixels the rasterizer covers with a quad, those whose centre is in its rectangle: the first and past-the-last
// framebuffer pixel on each axis (.xy and .zw), the corners of the rectangle being snapped to the subpixel precision of
// the rasterizer before
vec4 coveredPixels (vec4 rect) {
    vec4 corners = round (rect * inRatio.xyxy * 256.0) / 256.0;
    return ceil (corners - 0.5);
}

// The widths of the edges (top, bottom, left, right) in whole framebuffer pixels, one at least for an edge that is not
// 0, so that the sides of a ring are as wide as one another wherever the ring is
vec4 edgePixels (vec4 edges) {
    return mix (vec4 (0), max (vec4 (1), round (edges * inRatio.yyxx)), greaterThan (edges, vec4 (0)));
}

// Discard the pixels inside the ring of a shape drawn as a ring, those within its edges from the pixels the rasterizer
// covers with its quad
void hollow () {
    if (all (equal (inEdges, vec4 (0)))) {
        return;
    }

    vec4 quad = coveredPixels (inQuad);
    vec4 edges = edgePixels (inEdges);
    vec4 inside = vec4 (quad.x + edges.z, quad.y + edges.x, quad.z - edges.w, quad.w - edges.y);

    vec2 pixel = floor (gl_FragCoord.xy);
    if (all (greaterThanEqual (pixel, inside.xy)) && all (lessThan (pixel, inside.zw))) {
        discard;
    }
}

void main () {
    cut ();
    hollow ();
    out_color = vec4 (srgbToLinear (inColor.rgb), inColor.a);
}
