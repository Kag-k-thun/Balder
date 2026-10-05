#version 450 core

layout (set = 0, binding = 0) uniform World {    
    vec2 translation;
    vec2 scale;
    vec4 color;        
    int level;
} world;

layout (location = 0) out vec4 out_color;

// The colors of the shapes are sRGB values, like those of the style sheets, and the framebuffer encodes linear ones
vec3 srgbToLinear (vec3 c) {
    return mix (c / 12.92, pow ((c + 0.055) / 1.055, vec3 (2.4)), step (vec3 (0.04045), c));
}

void main () {    
    out_color = vec4 (srgbToLinear (world.color.rgb), world.color.a);
}
