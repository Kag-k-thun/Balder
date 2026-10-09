#version 450

layout (location = 0) in vec3 inNormals;

// The cross-fade of the draw, see the vertex shader
layout (location = 2) flat in vec2 inFade;

// The material of the object
layout (location = 3) flat in uint inMaterial;

// The normal, folded by octEncode
layout (location = 0) out vec2 normals;

// The base colour, and the occlusion in alpha
layout (location = 1) out vec4 albedo;
layout (location = 2) out uint materialID;

// The metalness and the roughness, multiplying the factors of the material
layout (location = 3) out vec2 surface;

// The emissive colour, multiplying the emissive colour of the material
layout (location = 4) out vec4 emissive;

/**
 * The threshold of a pixel in a 4x4 ordered dithering matrix, in (0, 1)
 */
float ditherThreshold (vec2 pixel) {
    const float bayer [16] = float [16] (0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
    ivec2 p = ivec2 (pixel) & 3;
    return (bayer [p.y * 4 + p.x] + 0.5) / 16.0;
}

/**
 * Discard the pixels a cross-fade gives to the other level: the incoming level takes the pixels whose threshold is
 * under the progress, the outgoing level keeps the others, so the two levels never overlap nor leave a hole
 */
void crossFade () {
    if (inFade.y > 0.5) {
        bool incoming = inFade.y > 1.5;
        if ((ditherThreshold (gl_FragCoord.xy) < inFade.x) != incoming) {
            discard;
        }
    }
}

/**
 * @returns: a direction folded onto the octahedron |x| + |y| + |z| = 1, its lower half unfolded over the corners of the
 * square [-1, 1]², so it fits in two channels (the composition unfolds it back)
 */
vec2 octEncode (vec3 n) {
    n /= max (abs (n.x) + abs (n.y) + abs (n.z), 1e-8);
    if (n.z < 0.0) {
        return (1.0 - abs (n.yx)) * vec2 (n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
    }

    return n.xy;
}

void main() {
    crossFade ();

    normals = octEncode (inNormals);
    albedo = vec4 (1, 1, 1, 1);

    // the material has no map, its factors used as they are
    surface = vec2 (1.0);
    emissive = vec4 (1.0);
    materialID = inMaterial;
}
