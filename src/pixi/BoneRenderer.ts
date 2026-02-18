import { Graphics, Container } from 'pixi.js';
import type { Bone, WorldTransform } from '../types';

/**
 * Renders bone visualizations (lines + joint circles) on a PixiJS Container.
 * Reads bone data from the store and draws in world space.
 */
export class BoneRenderer {
    public container: Container;
    private graphics: Graphics;

    /** Create a container and graphics layer for bone overlay rendering. */
    constructor() {
        this.container = new Container();
        this.container.label = 'BoneOverlay';
        this.graphics = new Graphics();
        this.container.addChild(this.graphics);
    }

    /**
     * Redraws all bones and joints.
     * @param bones     The full bone array from the store
     * @param getWorld  A function to compute the world transform for a bone
     * @param activeId  The currently selected bone id (highlighted)
     */
    draw(
        bones: Bone[],
        getWorld: (id: string) => WorldTransform,
        activeId: string | null,
    ) {
        const g = this.graphics;
        g.clear();

        if (bones.length === 0) return;

        for (const bone of bones) {
            const world = getWorld(bone.id);
            const isActive = bone.id === activeId;

            // Calculate bone endpoint
            const endX = world.x + Math.cos(world.rotation) * bone.length;
            const endY = world.y + Math.sin(world.rotation) * bone.length;

            // Draw bone line
            g.setStrokeStyle({
                width: isActive ? 3 : 2,
                color: isActive ? 0x818cf8 : 0x94a3b8,
                alpha: isActive ? 1 : 0.7,
            });
            g.moveTo(world.x, world.y);
            g.lineTo(endX, endY);
            g.stroke();

            // Draw joint circle at bone origin
            g.setStrokeStyle({
                width: 2,
                color: isActive ? 0xa78bfa : 0x64748b,
            });
            g.circle(world.x, world.y, isActive ? 6 : 4);
            g.fill({ color: isActive ? 0x6366f1 : 0x334155, alpha: 0.9 });
            g.stroke();

            // Draw small endpoint indicator
            g.circle(endX, endY, 3);
            g.fill({ color: isActive ? 0x818cf8 : 0x475569, alpha: 0.7 });
            g.stroke();
        }
    }

    /** Dispose of the graphics container. */
    destroy() {
        this.container.destroy({ children: true });
    }
}
