#version 450

layout (location = 0) in vec4 inPosition;
layout (location = 1) in vec3 inNormals;
layout (location = 2) in vec3 inColor;

layout (location = 0) out vec3 position;
layout (location = 1) out vec3 normals;
layout (location = 2) out vec3 binormals;
layout (location = 3) out vec4 albedo;
layout (location = 4) out uint materialID;

void main() {
    int id = gl_PrimitiveID * 7907 % 256;
    int id2 = gl_PrimitiveID * 3931 % 256;
    int id3 = gl_PrimitiveID * 17 % 256;

    float r, g, b;
    // notice the 256's instead of 255
    r = (id) / 255.0f;
    g = (id2 / 255.0f);
    b = (id3 / 255.0f);

    float depth = (gl_FragCoord.z / gl_FragCoord.w) / 200.f;
    position = vec3 (r, g, b); //inPosition.xyz);
    normals = vec3 (inNormals);
    binormals = vec3 (inNormals);
    albedo = vec4 (vec3 (depth / 0.9), 1);
    materialID = 1;
}
