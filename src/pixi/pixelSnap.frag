/**
 * Pixel-Snap Fragment Shader (PixiJS v8 / WebGL2 GLSL 300 es)
 *
 * The "secret sauce" of PixelRig. Instead of sampling the texture with
 * standard bilinear interpolation (which blurs rotated pixels), this shader
 * snaps each UV coordinate to the nearest virtual-pixel boundary:
 *
 *   UV_snapped = floor(UV × resolution) / resolution
 *
 * This produces crisp, stair-stepped edges regardless of rotation angle.
 */

in vec2 vTextureCoord;

out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uResolution;

// Snap UVs to virtual pixels and sample the texture.
void main(void) {
    // Snap UV to the nearest virtual pixel
    vec2 snappedUV = floor(vTextureCoord * uResolution) / uResolution;

    // Sample the texture at the snapped coordinate with no interpolation
    finalColor = texture(uTexture, snappedUV);
}
