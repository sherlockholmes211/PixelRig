import { Application, Container, Sprite, Texture } from 'pixi.js';
import { GridRenderer } from './GridRenderer';
import { BoneRenderer } from './BoneRenderer';
import { useBoneStore } from '../store/useBoneStore';
import { angleBetween, distance } from '../utils/math';
import type { Tool } from '../types';

/**
 * SceneManager orchestrates the entire PixiJS scene:
 *  - Application initialization
 *  - Grid overlay
 *  - Sprite loading + PixelSnap filter
 *  - Bone/joint rendering
 *  - Pointer interaction for placing joints and rotating bones
 */
export class SceneManager {
    public app: Application;
    private gridRenderer!: GridRenderer;
    private boneRenderer!: BoneRenderer;
    private spriteContainer!: Container;
    private currentSprite: Sprite | null = null;

    // Interaction state
    private isDragging = false;
    private dragStartAngle = 0;
    private dragBoneId: string | null = null;
    private pendingJointId: string | null = null;

    private canvasSize: number;
    private virtualResolution: number;

    constructor() {
        const state = useBoneStore.getState();
        this.canvasSize = state.canvasSize;
        this.virtualResolution = state.virtualResolution;
        this.app = new Application();
    }

    async init(canvas: HTMLCanvasElement) {
        await this.app.init({
            canvas,
            width: this.canvasSize,
            height: this.canvasSize,
            backgroundColor: 0x0d0d14,
            antialias: false,
            resolution: 1,
            autoDensity: false,
        });

        // Create subsystems after app is initialized
        this.gridRenderer = new GridRenderer(this.canvasSize, this.virtualResolution);
        this.boneRenderer = new BoneRenderer();
        this.spriteContainer = new Container();
        this.spriteContainer.label = 'SpriteContainer';

        // Layer order: sprite → grid → bones
        this.app.stage.addChild(this.spriteContainer);
        this.app.stage.addChild(this.gridRenderer.container);
        this.app.stage.addChild(this.boneRenderer.container);

        // Make stage interactive for placing joints
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = { contains: () => true };

        this.setupInteraction();
        this.startRenderLoop();
    }

    private setupInteraction() {
        const stage = this.app.stage;

        stage.on('pointerdown', (event) => {
            const pos = event.global;
            const store = useBoneStore.getState();
            const tool: Tool = store.activeTool;

            if (tool === 'addJoint') {
                store.addBone({
                    parentId: null,
                    position: { x: pos.x, y: pos.y },
                    rotation: 0,
                    length: 0,
                });
            } else if (tool === 'addBone') {
                if (!this.pendingJointId) {
                    const closest = this.findClosestBone(pos.x, pos.y);
                    if (closest) {
                        this.pendingJointId = closest.id;
                    }
                } else {
                    const parentBone = store.bones.find((b) => b.id === this.pendingJointId);
                    if (parentBone) {
                        const parentWorld = store.getWorldTransform(parentBone.id);
                        const angle = angleBetween(parentWorld.x, parentWorld.y, pos.x, pos.y);
                        const len = distance(parentWorld.x, parentWorld.y, pos.x, pos.y);

                        store.addBone({
                            parentId: parentBone.id,
                            position: { x: 0, y: 0 },
                            rotation: angle - parentWorld.rotation,
                            length: len,
                        });
                    }
                    this.pendingJointId = null;
                }
            } else if (tool === 'select') {
                const closest = this.findClosestBone(pos.x, pos.y);
                if (closest) {
                    store.setActiveBone(closest.id);
                    const parentWorld = store.getWorldTransform(closest.id);
                    this.isDragging = true;
                    this.dragBoneId = closest.id;
                    this.dragStartAngle = angleBetween(parentWorld.x, parentWorld.y, pos.x, pos.y);
                } else {
                    store.setActiveBone(null);
                }
            }
        });

        stage.on('pointermove', (event) => {
            if (!this.isDragging || !this.dragBoneId) return;

            const pos = event.global;
            const store = useBoneStore.getState();
            const bone = store.bones.find((b) => b.id === this.dragBoneId);
            if (!bone) return;

            const world = store.getWorldTransform(bone.id);
            const currentAngle = angleBetween(world.x, world.y, pos.x, pos.y);
            const delta = currentAngle - this.dragStartAngle;
            this.dragStartAngle = currentAngle;

            store.updateBone(bone.id, { rotation: bone.rotation + delta });
        });

        stage.on('pointerup', () => {
            this.isDragging = false;
            this.dragBoneId = null;
        });

        stage.on('pointerupoutside', () => {
            this.isDragging = false;
            this.dragBoneId = null;
        });
    }

    private findClosestBone(x: number, y: number): { id: string } | null {
        const store = useBoneStore.getState();
        let closest: { id: string; dist: number } | null = null;
        const maxDist = 20;

        for (const bone of store.bones) {
            const world = store.getWorldTransform(bone.id);
            const d = distance(world.x, world.y, x, y);
            if (d < maxDist && (!closest || d < closest.dist)) {
                closest = { id: bone.id, dist: d };
            }

            if (bone.length > 0) {
                const endX = world.x + Math.cos(world.rotation) * bone.length;
                const endY = world.y + Math.sin(world.rotation) * bone.length;
                const dEnd = distance(endX, endY, x, y);
                if (dEnd < maxDist && (!closest || dEnd < closest.dist)) {
                    closest = { id: bone.id, dist: dEnd };
                }
            }
        }

        return closest;
    }

    async loadSprite(dataUrl: string) {
        // Remove existing sprite
        if (this.currentSprite) {
            this.spriteContainer.removeChild(this.currentSprite);
            this.currentSprite.destroy();
            this.currentSprite = null;
        }

        const texture = Texture.from(dataUrl);
        texture.source.scaleMode = 'nearest';

        const sprite = new Sprite(texture);
        sprite.label = 'UserSprite';
        sprite.width = this.canvasSize;
        sprite.height = this.canvasSize;

        // Apply PixelSnap filter — lazy-load to avoid blocking initial render
        try {
            const { PixelSnapFilter } = await import('./PixelSnapFilter');
            const filter = new PixelSnapFilter(this.virtualResolution);
            sprite.filters = [filter];
        } catch (err) {
            console.warn('PixelSnapFilter failed to load, rendering without pixel-snap:', err);
        }

        this.spriteContainer.addChild(sprite);
        this.currentSprite = sprite;
    }

    private startRenderLoop() {
        this.app.ticker.add(() => {
            const state = useBoneStore.getState();
            this.boneRenderer.draw(
                state.bones,
                (id) => state.getWorldTransform(id),
                state.activeBoneId,
            );
        });
    }

    destroy() {
        this.app.destroy(true, { children: true, texture: true });
    }
}
