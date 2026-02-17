import { Application, Assets, Container, Sprite } from 'pixi.js';
import { GridRenderer } from './GridRenderer';
import { BoneRenderer } from './BoneRenderer';
import { useBoneStore } from '../store/useBoneStore';
import { angleBetween, distance } from '../utils/math';
import type { Tool } from '../types';

type DragMode = 'rotate' | 'move';

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
    private dragMode: DragMode = 'rotate';
    private dragStartAngle = 0;
    private dragStartPos: { x: number; y: number } | null = null;
    private dragBoneStartPos: { x: number; y: number } | null = null;
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
                    this.dragStartPos = { x: pos.x, y: pos.y };

                    // Determine drag mode based on where they clicked (joint vs bone body)
                    // For now, let's say clicking near the origin is 'move', and further out is 'rotate'
                    // But actually, typically 'select' tool does rotation by default in simple IK/FK apps
                    // Let's implement a simple logic: if closest point is < 10px from origin -> move (if root) or rotate (if child)?
                    // Actually, simpler: Left Click = Rotate, Right Click (or Shift+Click) = Move.
                    // Or let's just make it context sensitive:
                    // If you click on the joint circle -> Move
                    // If you click on the bone line -> Rotate

                    // Refined finding logic:
                    // We need to know if we clicked the "origin" of the bone or the "body"
                    const bone = store.bones.find(b => b.id === closest.id);
                    if (bone) {

                        // If it's a root bone, we can move it
                        // If it's a child bone, moving it changes its local position (which acts like scaling/sliding)
                        // For a rigid skeleton, usually we only Rotate children.
                        // But users asked to "move the character".

                        // Let's implement:
                        // 1. Root bones: Dragging moves the whole tree.
                        // 2. Child bones: Dragging rotates the parent (IK) or just rotates self (FK). 
                        // The user said "move the character", implying root movement.
                        // And "using bone and joints" implies manipulating the rig.

                        if (bone.parentId === null) {
                            this.dragMode = 'move';
                            this.dragBoneStartPos = { ...bone.position };
                        } else {
                            this.dragMode = 'rotate';
                            this.dragStartAngle = angleBetween(parentWorld.x, parentWorld.y, pos.x, pos.y);
                        }
                    }
                } else {
                    store.setActiveBone(null);
                }
            }
        });

        stage.on('pointermove', (event) => {
            if (!this.isDragging || !this.dragBoneId || !this.dragStartPos) return;

            const pos = event.global;
            const store = useBoneStore.getState();
            const bone = store.bones.find((b) => b.id === this.dragBoneId);
            if (!bone) return;

            if (this.dragMode === 'move') {
                // Moving a root bone
                if (this.dragBoneStartPos) {
                    const dx = pos.x - this.dragStartPos.x;
                    const dy = pos.y - this.dragStartPos.y;

                    store.updateBone(bone.id, {
                        position: {
                            x: this.dragBoneStartPos.x + dx,
                            y: this.dragBoneStartPos.y + dy
                        }
                    });
                }
            } else if (this.dragMode === 'rotate') {
                const world = store.getWorldTransform(bone.id);
                // For rotation, we need the angle relative to the bone's origin
                // But wait, if we are rotating *this* bone, the pivot is its origin.
                // The angle we are dragging is the angle from the pivot to the mouse.
                const currentAngle = angleBetween(world.x, world.y, pos.x, pos.y);

                // We need the *change* in angle to apply to the local rotation
                // But wait, `dragStartAngle` was initialized relative to world space.
                // So `delta` is the world space rotation difference.
                // We can just add this delta to the local rotation.

                // Re-initialize dragStartAngle on move to avoid jumps if we switched modes?
                // No, standard click-drag logic:
                // On Down: record StartAngle (Mouse -> Pivot)
                // On Move: CurrentAngle (Mouse -> Pivot)
                // Delta = Current - Start
                // NewRotation = OldRotation + Delta
                // This requires storing OldRotation on MouseDown. 

                // Current implementation was:
                // delta = current - prev
                // rot += delta
                // prev = current

                // Let's stick to the incremental approach which is robust
                const delta = currentAngle - this.dragStartAngle;
                this.dragStartAngle = currentAngle;

                store.updateBone(bone.id, { rotation: bone.rotation + delta });
            }
        });

        stage.on('pointerup', () => {
            this.isDragging = false;
            this.dragBoneId = null;
            this.dragStartPos = null;
            this.dragBoneStartPos = null;
        });

        stage.on('pointerupoutside', () => {
            this.isDragging = false;
            this.dragBoneId = null;
            this.dragStartPos = null;
            this.dragBoneStartPos = null;
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
        try {
            // Remove existing sprite
            if (this.currentSprite) {
                this.spriteContainer.removeChild(this.currentSprite);
                this.currentSprite.destroy();
                this.currentSprite = null;
            }

            // In PixiJS v8, use Assets.load for robust async loading
            const texture = await Assets.load(dataUrl);

            // Ensure pixel-perfect scaling
            if (texture.source) {
                texture.source.scaleMode = 'nearest';
            }

            const sprite = new Sprite(texture);
            sprite.label = 'UserSprite';
            sprite.width = this.canvasSize;
            sprite.height = this.canvasSize;

            // Apply PixelSnap filter — lazy-load to avoid blocking initial render
            try {
                // Ensure dynamic import works with Vite
                const { PixelSnapFilter } = await import('./PixelSnapFilter');
                if (PixelSnapFilter) {
                    const filter = new PixelSnapFilter(this.virtualResolution);
                    sprite.filters = [filter];
                }
            } catch (err) {
                console.warn('PixelSnapFilter failed to load, rendering without pixel-snap:', err);
            }

            this.spriteContainer.addChild(sprite);
            this.currentSprite = sprite;
        } catch (error) {
            console.error('Failed to load sprite:', error);
        }
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
