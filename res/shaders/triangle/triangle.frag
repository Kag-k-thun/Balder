#version 450

layout (location = 0) in vec3 inColor;
layout (location = 1) in vec2 inUV;

layout (location = 0) out vec4 outFragColor;

layout(binding = 2) uniform sampler2D texSampler;
layout(binding = 3) uniform sampler2D depthSampler;

void main()
{
    vec4 texColor = texture(texSampler, inUV);
    vec4 depthColor = texture (depthSampler, inUV);

    outFragColor = vec4 (0.1 * (texColor.xyz * inColor) + (1 - depthColor.r), 1);
}
