#version 450

layout (location = 0) in vec4 inPosition;
layout (location = 1) in vec3 inNormals;

// The cross-fade of the draw, see the vertex shader
layout (location = 3) flat in vec2 inFade;

// The material of the object
layout (location = 4) flat in uint inMaterial;

layout (location = 0) out vec3 position;
layout (location = 1) out vec3 normals;
layout (location = 2) out vec4 albedo;
layout (location = 3) out uint materialID;

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

void main() {
    crossFade ();

    position = vec3 (inPosition.xyz);
    normals = vec3 (inNormals);
    albedo = vec4 (1, 1, 1, 1); 
    materialID = inMaterial;
}
