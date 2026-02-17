import { Filter, GlProgram } from 'pixi.js';

// Import shader source as strings via Vite's ?raw query
import vertexSrc from './pixelSnap.vert?raw';
import fragmentSrc from './pixelSnap.frag?raw';

/**
 * PixelSnapFilter — The core rendering innovation.
 *
 * Wraps the pixel-snap GLSL shaders into a PixiJS v8 Filter.
 * The `uResolution` uniform controls the virtual pixel grid size
 * (e.g., 64.0 means a 64×64 virtual canvas).
 *
 * Usage:
 *   const filter = new PixelSnapFilter(64);
 *   sprite.filters = [filter];
 */
export class PixelSnapFilter extends Filter {
    constructor(virtualResolution: number = 64) {
        const glProgram = new GlProgram({
            vertex: vertexSrc,
            fragment: fragmentSrc,
        });

        super({
            glProgram,
            resources: {
                pixelSnapUniforms: {
                    uResolution: { value: virtualResolution, type: 'f32' },
                },
            },
        });
    }

    /** Get the current virtual resolution */
    get virtualResolution(): number {
        return this.resources.pixelSnapUniforms.uniforms.uResolution as number;
    }

    /** Update the virtual resolution at runtime */
    set virtualResolution(value: number) {
        this.resources.pixelSnapUniforms.uniforms.uResolution = value;
    }
}
