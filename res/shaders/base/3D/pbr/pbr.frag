#version 450

layout (location = 0) in vec3 inNormals;
layout (location = 1) in vec2 inUV;

// The cross-fade of the draw, see the vertex shader
layout (location = 2) flat in vec2 inFade;

// The material of the object
layout (location = 3) flat in uint inMaterial;

// The tangent in world space, its handedness in w
layout (location = 4) in vec4 inTangents;

// The position in the clip space of the camera, unjittered, at this frame and at the frame before
layout (location = 5) in vec4 inCurrent;
layout (location = 6) in vec4 inPrevious;

#ifdef BALDER_DEBUG
// The debug view of the camera, the word of the instance, the cluster drawn and the level of detail, see the vertex shader
layout (location = 7) flat in uvec4 inDebug;
#endif

// The normal, folded by octEncode
layout (location = 0) out vec2 normals;

// The base colour, and the occlusion in alpha
layout (location = 1) out vec4 albedo;
layout (location = 2) out uint materialID;

// The metalness and the roughness, multiplying the factors of the material
layout (location = 3) out vec2 surface;

// The emissive colour, multiplying the emissive colour of the material
layout (location = 4) out vec4 emissive;

// The motion of the fragment since the frame before, in texture coordinates, the jitter of the projection left out
layout (location = 5) out vec2 velocity;


// The maps of the materials drawn together, those a material has not being white (the normal map flat)
layout (set = 0, binding = 2) uniform sampler2D baseColorMap;

// The roughness in green, the metalness in blue, as glTF packs them
layout (set = 0, binding = 3) uniform sampler2D metallicRoughnessMap;
layout (set = 0, binding = 4) uniform sampler2D normalMap;
layout (set = 0, binding = 5) uniform sampler2D occlusionMap;
layout (set = 0, binding = 6) uniform sampler2D emissiveMap;

// A metallic/roughness material (MaterialConfig), laid out as the composition reads it
struct Material {
    vec3 baseColor;
    float metallic;
    vec3 emissive;
    float roughness;
    float specular;
    float occlusion;

    // How far the normal map bends the normals, scaling the slopes it gives them
    float normalStrength;
    float emissiveStrength;

    // The tiling and the offset of the texture coordinates of the maps
    vec2 tiling;
    vec2 offset;
};

// The materials of the scene, by the index the material word of an object holds
layout (std430, set = 0, binding = 7) readonly buffer Materials {
    Material materials [];
};

// The bit of the material word set when the object is outlined, the other bits holding its material
const uint OUTLINED = 0x80000000u;

#ifdef BALDER_DEBUG
// The first debug view of a channel of the materials (see DebugView), shaded by the composition from the materials
const uint FIRST_CHANNEL_VIEW = 5u;

// The debug view of the edges of the triangles, the g-buffer holding the colour of each triangle as for TRIANGLES, the
// composition drawing the edges where it changes
const uint WIREFRAME_VIEW = 4u;
#endif

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
 * @returns: the normal of the surface at the fragment, its interpolated normal bent by the normal map, its slopes scaled
 * by a strength
 * @info: the tangent space is the tangent, along the growing u, the bitangent, along the growing v, which runs down the
 * images (the texture coordinates of the meshes start at the top left), and the normal; the normal maps point their y up
 * the images (as glTF and OpenGL read them), against the bitangent; the handedness flips the bitangent where the
 * texture is mirrored
 */
vec3 bentNormal (vec2 uv, float strength) {
    vec3 N = normalize (inNormals);

    // the tangent made perpendicular to the interpolated normal; none where the texture coordinates are degenerate
    vec3 T = inTangents.xyz - N * dot (N, inTangents.xyz);
    if (dot (T, T) < 1e-12 || any (isnan (T))) {
        return N;
    }

    T = normalize (T);
    vec3 B = cross (N, T) * (inTangents.w < 0.0 ? -1.0 : 1.0);

    vec3 m = texture (normalMap, uv).xyz * 2.0 - 1.0;
    m.xy *= strength;
    return normalize (T * m.x - B * m.y + N * m.z);
}

/**
 * @returns: the motion of the fragment since the frame before, in texture coordinates (half the motion in normalized
 * device coordinates); a point behind the camera in the frame before moves out of the image
 */
vec2 motion () {
    vec2 current = inCurrent.xy / inCurrent.w;
    vec2 previous = inPrevious.xy / max (inPrevious.w, 1e-6);
    return (current - previous) * 0.5;
}

#ifdef BALDER_DEBUG
// The cluster of a command drawing a whole level
const uint NO_CLUSTER = 0xffffffffu;

// The number of triangles of a cluster, the clusters of a level following each other from its first triangle
const uint CLUSTER_TRIANGLES = 64u;

/**
 * @returns: a value mixing the bits of another (lowbias32)
 */
uint hash (uint x) {
    x ^= x >> 16;
    x *= 0x7feb352du;
    x ^= x >> 15;
    x *= 0x846ca68bu;
    x ^= x >> 16;
    return x;
}

/**
 * @returns: a bright colour picked by a hash
 */
vec3 hashColor (uint h) {
    return vec3 (h & 0xffu, (h >> 8) & 0xffu, (h >> 16) & 0xffu) / 255.0 * 0.75 + 0.25;
}

/**
 * @returns: the colour of the fragment in the debug view of the camera: its triangle, its cluster (a run of
 * CLUSTER_TRIANGLES triangles of the level when the level is drawn whole), or its level of detail, from green to magenta
 */
vec3 debugColor () {
    uint word = inDebug.y, cluster = inDebug.z, primitive = uint (gl_PrimitiveID);
    if (inDebug.x == 1u || inDebug.x == WIREFRAME_VIEW) {
        uint id = cluster == NO_CLUSTER ? primitive : hash (cluster) + primitive;
        return hashColor (hash (word * 0x9e3779b9u + id));
    }

    if (inDebug.x == 2u) {
        uint id = cluster == NO_CLUSTER ? primitive / CLUSTER_TRIANGLES : cluster;
        return hashColor (hash (word * 0x9e3779b9u + id));
    }

    const vec3 levels [6] = vec3 [6] (vec3 (0.1, 0.8, 0.1), vec3 (0.6, 0.85, 0.1), vec3 (0.95, 0.85, 0.1),
                                      vec3 (1.0, 0.5, 0.05), vec3 (0.9, 0.1, 0.1), vec3 (0.8, 0.1, 0.8));
    return levels [min (inDebug.w, 5u)];
}
#endif

void main() {
    crossFade ();

    Material mat = materials [inMaterial & ~OUTLINED];
    vec2 uv = inUV * mat.tiling + mat.offset;

    normals = octEncode (bentNormal (uv, mat.normalStrength));
    albedo = vec4 (texture (baseColorMap, uv).rgb, texture (occlusionMap, uv).r);

    vec4 metallicRoughness = texture (metallicRoughnessMap, uv);
    surface = vec2 (metallicRoughness.b, metallicRoughness.g);
    emissive = vec4 (texture (emissiveMap, uv).rgb, 1.0);

#ifdef BALDER_DEBUG
    // the debug views of the geometry show a flat colour, the composition lighting it from the eye
    if (inDebug.x != 0u && inDebug.x < FIRST_CHANNEL_VIEW) {
        albedo = vec4 (debugColor (), 1.0);
        surface = vec2 (0.0, 1.0);
        emissive = vec4 (0.0);
    }
#endif

    materialID = inMaterial;
    velocity = motion ();
}
