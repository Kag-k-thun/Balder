#version 450

layout (location = 0) in vec3 inNormals;
layout (location = 1) in vec2 inUV;

// The cross-fade of the draw, see the vertex shader
layout (location = 2) flat in vec2 inFade;

// The material of the object
layout (location = 3) flat in uint inMaterial;

// The position in the clip space of the camera, unjittered, at this frame and at the frame before
layout (location = 4) in vec4 inCurrent;
layout (location = 5) in vec4 inPrevious;

// The debug view of the camera, the word of the instance, the cluster drawn and the level of detail, see the vertex shader
layout (location = 6) flat in uvec4 inDebug;

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


layout (set = 0, binding = 2) uniform sampler2D diffuse;


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
 * @returns: the motion of the fragment since the frame before, in texture coordinates (half the motion in normalized
 * device coordinates); a point behind the camera in the frame before moves out of the image
 */
vec2 motion () {
    vec2 current = inCurrent.xy / inCurrent.w;
    vec2 previous = inPrevious.xy / max (inPrevious.w, 1e-6);
    return (current - previous) * 0.5;
}

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
    if (inDebug.x == 1u) {
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

void main() {
    crossFade ();

    normals = octEncode (inNormals);
    albedo = vec4 (texture (diffuse, inUV).xyz, 1);

    // the material has no map but its base colour, its factors used as they are
    surface = vec2 (1.0);
    emissive = vec4 (1.0);
    
    // the debug views show a flat colour, the composition lighting it from the eye
    if (inDebug.x != 0u) {
        albedo = vec4 (debugColor (), 1.0);
        surface = vec2 (0.0, 1.0);
        emissive = vec4 (0.0);
    }

    materialID = inMaterial;
    velocity = motion ();
}
