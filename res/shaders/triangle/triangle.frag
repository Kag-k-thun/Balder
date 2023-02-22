#version 450

layout (location = 0) in vec3 inColor;
layout (location = 0) out vec4 outFragColor;

layout (binding = 0) uniform UniformBufferObject {
    vec3 f_color;
} ubo;

void main()
{
    outFragColor = vec4 (1 - inColor + ubo.f_color, 1.0f);
}
