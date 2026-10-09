#version 450

layout (location = 0) in vec3 inNormals;
layout (location = 1) in vec2 inUV;

// The cross-fade of the draw, see the vertex shader
layout (location = 2) flat in vec2 inFade;

// The material of the object
layout (location = 3) flat in uint inMaterial;

// The tangent in world space, its handedness in w
layout (location = 4) in vec4 inTangents;

// The normal, folded by octEncode
layout (location = 0) out vec2 normals;

// The base colour, and the occlusion in alpha
layout (location = 1) out vec4 albedo;
layout (location = 2) out uint materialID;

// The metalness and the roughness, multiplying the factors of the material
layout (location = 3) out vec2 surface;

// The emissive colour, multiplying the emissive colour of the material
layout (location = 4) out vec4 emissive;


// The maps of the materials drawn together, those a material has not being white (the normal map flat)
layout (set = 0, binding = 2) uniform sampler2D baseColorMap;

// The roughness in green, the metalness in blue, as glTF packs them
layout (set = 0, binding = 3) uniform sampler2D metallicRoughnessMap;
layout (set = 0, binding = 4) uniform sampler2D normalMap;
layout (set = 0, binding = 5) uniform sampler2D occlusionMap;
layout (set = 0, binding = 6) uniform sampler2D emissiveMap;


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

/**
 * @returns: the normal of the surface at the fragment, its interpolated normal bent by the normal map
 * @info: the tangent space is the tangent, along the growing u, the bitangent, along the growing v, which runs down the
 * images (the texture coordinates of the meshes start at the top left), and the normal; the normal maps point their y up
 * the images (as glTF and OpenGL read them), against the bitangent; the handedness flips the bitangent where the
 * texture is mirrored
 */
vec3 bentNormal () {
    vec3 N = normalize (inNormals);

    // the tangent made perpendicular to the interpolated normal; none where the texture coordinates are degenerate
    vec3 T = inTangents.xyz - N * dot (N, inTangents.xyz);
    if (dot (T, T) < 1e-12 || any (isnan (T))) {
        return N;
    }

    T = normalize (T);
    vec3 B = cross (N, T) * (inTangents.w < 0.0 ? -1.0 : 1.0);

    vec3 m = texture (normalMap, inUV).xyz * 2.0 - 1.0;
    return normalize (T * m.x - B * m.y + N * m.z);
}

void main() {
    crossFade ();

    normals = octEncode (bentNormal ());
    albedo = vec4 (texture (baseColorMap, inUV).rgb, texture (occlusionMap, inUV).r);

    vec4 metallicRoughness = texture (metallicRoughnessMap, inUV);
    surface = vec2 (metallicRoughness.b, metallicRoughness.g);
    emissive = vec4 (texture (emissiveMap, inUV).rgb, 1.0);

    materialID = inMaterial;
}
