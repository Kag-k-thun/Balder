#version 450

layout (location = 0) in vec4 inPosition;
layout (location = 1) in vec3 inNormals;
layout (location = 2) in vec3 inColor;

layout (location = 0) out vec4 position;
layout (location = 1) out vec3 normals;
layout (location = 2) out vec4 albedo;
layout (location = 3) out uint materialID;

void main() {
    int id = gl_PrimitiveID * 7907 % 256;
    int id2 = gl_PrimitiveID * 3931 % 256;
    int id3 = gl_PrimitiveID * 17 % 256;

    float r, g, b;
    // notice the 256's instead of 255
    r = (id) / 255.0f;
    g = (id2 / 255.0f);
    b = (id3 / 255.0f);

    position = vec4 (r, g, b, (gl_FragCoord.z / gl_FragCoord.w));
    normals = vec3 (inNormals);
    albedo = vec4 (inColor, 1);
    materialID = 1;
}
