#version 450 core

layout (location = 0) in vec2 a_uv;

// The color of the text
layout (location = 1) flat in vec4 inColor;

// The scissors of the shape, its offset and extent in framebuffer pixels
layout (location = 2) flat in ivec4 inScissors;

// A page of the glyph atlas, its alpha being the coverage of the glyphs
layout (set = 0, binding = 1) uniform sampler2D atlas;
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

void main () {
    cut ();

    // The coverage is blended as is, like the blended surfaces of SDL2_ttf the text was drawn with,
    // so the strokes keep the same weight
    float coverage = texture (atlas, a_uv).a;
    out_color = vec4 (srgbToLinear (inColor.rgb), inColor.a * coverage);
}
