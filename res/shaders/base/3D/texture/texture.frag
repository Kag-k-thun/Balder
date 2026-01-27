#version 450

layout (location = 0) in vec4 inPosition;
layout (location = 1) in vec3 inNormals;
layout (location = 2) in vec2 inUV;

layout (location = 0) out vec3 position;
layout (location = 1) out vec3 normals;
layout (location = 2) out vec3 binormals;
layout (location = 3) out vec4 albedo;
layout (location = 4) out uint materialID;


layout(set = 0, binding = 1) uniform Material {    
    uint materialID;
} material;

layout (set = 0, binding = 2) uniform sampler2D diffuse;


void main() {
    position = inPosition.xyz;
    normals = vec3 (inNormals);
    binormals = vec3 (inNormals);
    albedo = vec4 (texture (diffuse, inUV).xyz, 1);
    
    materialID = material.materialID;            
}
