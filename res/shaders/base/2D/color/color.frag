#version 450 core

// The color of the shape
layout (location = 0) flat in vec4 inColor;

// The scissors of the shape, its offset and extent in framebuffer pixels
layout (location = 1) flat in ivec4 inScissors;

// The rectangle the shape is drawn in, its corners in CSS pixels
layout (location = 2) flat in vec4 inBox;

// The widths of the ring the shape is drawn as (top, bottom, left, right)
layout (location = 3) flat in vec4 inEdges;

// The number of framebuffer pixels in a CSS pixel
layout (location = 4) flat in vec2 inRatio;

// The radii of the corners of the box, clockwise from the top left one
layout (location = 5) flat in vec4 inRadii;

// The standard deviation of the gaussian blurring the box, a sharp box when it is 0
layout (location = 6) flat in float inBlur;

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

// The coverage of a rounded rectangle at a framebuffer pixel: 0 or 1 along its sides, by the pixels it spans,
// antialiased over a pixel along the arcs of its corners
// @params:
//    - pixel: the framebuffer pixel
//    - box: the first and past-the-last framebuffer pixel the rectangle spans on each axis (.xy and .zw)
//    - radii: the radii of its corners in framebuffer pixels, clockwise from the top left one
float roundedCoverage (vec2 pixel, vec4 box, vec4 radii) {
    if (any (lessThan (pixel, box.xy)) || any (greaterThanEqual (pixel, box.zw))) {
        return 0.0;
    }

    // the corners clockwise from the top left one, and the direction of the inside of the rectangle from each
    vec2 corners [4] = vec2 [4] (box.xy, box.zy, box.zw, box.xw);
    vec2 inwards [4] = vec2 [4] (vec2 (1, 1), vec2 (-1, 1), vec2 (-1, -1), vec2 (1, -1));

    vec2 point = pixel + 0.5;
    float coverage = 1.0;
    for (int i = 0; i < 4; i++) {
        // the arc of a corner cuts the square between the corner and the centre of the arc
        vec2 center = corners [i] + inwards [i] * radii [i];
        vec2 outwards = (center - point) * inwards [i];
        if (outwards.x > 0.0 && outwards.y > 0.0) {
            float distance = length (outwards) - radii [i];
            coverage = min (coverage, clamp (0.5 - distance, 0.0, 1.0));
        }
    }

    return coverage;
}

// The error function of each component, approximated to 5.10^-4
vec2 erf (vec2 x) {
    vec2 s = sign (x);
    vec2 a = abs (x);
    x = 1.0 + (0.278393 + (0.230389 + 0.078108 * (a * a)) * a) * a;
    x *= x;
    return s - s / (x * x);
}

// The density of a centred gaussian of standard deviation sigma
float gaussian (float x, float sigma) {
    return exp (-(x * x) / (2.0 * sigma * sigma)) / (2.5066283 * sigma);
}

// The coverage along a row of a blurred rounded rectangle, the integral of the gaussian across the row of its centred
// rectangle at the height y, the row of a corner being shortened as the arc does
// @params:
//    - x, y: the point, from the centre of the rectangle
//    - corner: the radius of the corner of the quarter the point is in
//    - halfSize: the half size of the rectangle
float shadowRow (float x, float y, float sigma, float corner, vec2 halfSize) {
    float delta = min (halfSize.y - corner - abs (y), 0.0);
    float curved = halfSize.x - corner + sqrt (max (0.0, corner * corner - delta * delta));
    vec2 integral = 0.5 + 0.5 * erf ((x + vec2 (-curved, curved)) * (sqrt (0.5) / sigma));
    return integral.y - integral.x;
}

// The coverage of a rounded rectangle blurred by a gaussian at a point, in CSS pixels: the integral across the rows is
// exact, the one down the columns sampled four times within three standard deviations of the point (Evan Wallace,
// "Fast Rounded Rectangle Shadows")
// @params:
//    - box: the corners of the rectangle
//    - radii: the radii of its corners, clockwise from the top left one
//    - sigma: the standard deviation of the gaussian
float shadowCoverage (vec2 point, vec4 box, vec4 radii, float sigma) {
    vec2 halfSize = (box.zw - box.xy) * 0.5;
    vec2 p = point - (box.xy + box.zw) * 0.5;
    float corner = p.y < 0.0 ? (p.x < 0.0 ? radii.x : radii.y) : (p.x < 0.0 ? radii.w : radii.z);
    corner = min (corner, min (halfSize.x, halfSize.y));

    float start = clamp (-3.0 * sigma, p.y - halfSize.y, p.y + halfSize.y);
    float end = clamp (3.0 * sigma, p.y - halfSize.y, p.y + halfSize.y);
    float step = (end - start) / 4.0;

    float y = start + step * 0.5;
    float coverage = 0.0;
    for (int i = 0; i < 4; i++) {
        coverage += shadowRow (p.x, p.y - y, sigma, corner, halfSize) * gaussian (y, sigma) * step;
        y += step;
    }

    return coverage;
}

// The coverage of the shape at a framebuffer pixel: its box blurred when it is a shadow, otherwise the pixels the
// rasterizer would cover with its box, less those within its edges when it is drawn as a ring, the radius of each inner
// corner being that of the corner less the widest of its two edges
float shapeCoverage (vec2 pixel) {
    if (inBlur > 0.0) {
        return shadowCoverage ((pixel + 0.5) / inRatio, inBox, inRadii, inBlur);
    }

    vec4 box = coveredPixels (inBox);
    vec4 radii = inRadii * (inRatio.x + inRatio.y) / 2.0;

    float coverage = roundedCoverage (pixel, box, radii);
    if (any (notEqual (inEdges, vec4 (0)))) {
        vec4 edges = edgePixels (inEdges);
        vec4 inside = vec4 (box.x + edges.z, box.y + edges.x, box.z - edges.w, box.w - edges.y);
        vec4 insideRadii = max (vec4 (0), radii - max (edges.xxyy, edges.zwwz));
        coverage *= 1.0 - roundedCoverage (pixel, inside, insideRadii);
    }

    return coverage;
}

void main () {
    cut ();

    float coverage = shapeCoverage (floor (gl_FragCoord.xy));
    if (coverage <= 0.0) {
        discard;
    }

    out_color = vec4 (srgbToLinear (inColor.rgb), inColor.a * coverage);
}
