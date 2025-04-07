#version 450

layout (location = 0) in vec3 inColor;
layout (location = 1) in vec2 inUV;

layout (location = 0) out vec4 outFragColor;

layout(binding = 2) uniform sampler2D texSampler;

void main()
{
    vec4 texColor = texture(texSampler, inUV);
    outFragColor = texColor;
}
