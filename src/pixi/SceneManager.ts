import { Application, Assets, Container, Mesh, MeshGeometry, Rectangle } from 'pixi.js';
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
    private currentMesh: Mesh | null = null;
    private bindData: { boneId: string; localX: number; localY: number; index: number }[] | null = null;
    private originalVertices: Float32Array | null = null;

    // Interaction state
    private isDragging = false;
    private dragMode: DragMode = 'rotate';
    private dragStartAngle = 0;
    private dragStartPos: { x: number; y: number } | null = null;
    private dragBoneStartPos: { x: number; y: number } | null = null;
    private dragBoneId: string | null = null;
    private pendingJoint: { id: string; attach: 'origin' | 'end' } | null = null;

    private canvasSize: number;
    private virtualResolution: number;

    constructor() {
        const state = useBoneStore.getState();
        this.canvasSize = state.canvasSize;
        this.virtualResolution = state.virtualResolution;
        this.app = new Application();

        // Subscribe to store changes to handle binding
        useBoneStore.subscribe((state, prevState) => {
            if (state.isBound && !prevState.isBound) {
                this.bindSkeleton();
            } else if (!state.isBound && prevState.isBound) {
                this.unbindSkeleton();
            }
        });
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
            const tool: Tool = store.isBound ? 'select' : store.activeTool;

            if (tool === 'addJoint') {
                store.addBone({
                    parentId: null,
                    position: { x: pos.x, y: pos.y },
                    rotation: 0,
                    length: 0,
                    radius: 50,
                });
            } else if (tool === 'addBone') {
                if (!this.pendingJoint) {
                    const closest = this.findClosestBone(pos.x, pos.y);
                    if (closest) {
                        this.pendingJoint = closest;
                    }
                } else {
                    const parentBone = store.bones.find((b) => b.id === this.pendingJoint!.id);
                    if (parentBone) {
                        const parentWorld = store.getWorldTransform(parentBone.id);
                        const attachAtEnd = this.pendingJoint!.attach === 'end';
                        const anchorX = attachAtEnd
                            ? parentWorld.x + Math.cos(parentWorld.rotation) * parentBone.length
                            : parentWorld.x;
                        const anchorY = attachAtEnd
                            ? parentWorld.y + Math.sin(parentWorld.rotation) * parentBone.length
                            : parentWorld.y;
                        const angle = angleBetween(anchorX, anchorY, pos.x, pos.y);
                        const len = distance(anchorX, anchorY, pos.x, pos.y);

                        store.addBone({
                            parentId: parentBone.id,
                            position: attachAtEnd ? { x: parentBone.length, y: 0 } : { x: 0, y: 0 },
                            rotation: angle - parentWorld.rotation,
                            length: len,
                            radius: 50,
                        });
                    }
                    this.pendingJoint = null;
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
                const currentAngle = angleBetween(world.x, world.y, pos.x, pos.y);
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

    private findClosestBone(
        x: number,
        y: number,
    ): { id: string; attach: 'origin' | 'end' } | null {
        const store = useBoneStore.getState();
        let closest: { id: string; dist: number; attach: 'origin' | 'end' } | null = null;
        const maxDist = 20;

        for (const bone of store.bones) {
            const world = store.getWorldTransform(bone.id);
            const d = distance(world.x, world.y, x, y);
            if (d < maxDist && (!closest || d < closest.dist)) {
                closest = { id: bone.id, dist: d, attach: 'origin' };
            }

            if (bone.length > 0) {
                const endX = world.x + Math.cos(world.rotation) * bone.length;
                const endY = world.y + Math.sin(world.rotation) * bone.length;
                const dEnd = distance(endX, endY, x, y);
                if (dEnd < maxDist && (!closest || dEnd < closest.dist)) {
                    closest = { id: bone.id, dist: dEnd, attach: 'end' };
                }
            }
        }

        return closest ? { id: closest.id, attach: closest.attach } : null;
    }

    async loadSprite(dataUrl: string) {
        try {
            if (this.currentMesh) {
                this.spriteContainer.removeChild(this.currentMesh);
                this.currentMesh.destroy();
                this.currentMesh = null;
            }

            const texture = await Assets.load(dataUrl);
            if (texture.source) {
                texture.source.scaleMode = 'nearest';
            }

            // Create a dense grid for deformation
            // For pixel art, we want a vertex every few pixels?
            // Let's use a 32x32 grid for now (32 segments -> 33 vertices)
            // Create a dense grid for deformation using custom interleaved geometry
            // This ensures we have [x, y, u, v] in a single buffer, robust for default Mesh shader.
            const geometry = this.createPlaneGeometry(this.canvasSize, this.canvasSize, 32, 32);

            // Cast to any/MeshGeometry because standard Mesh expects specific geometry type but works with generic
            const mesh = new Mesh({ geometry: geometry as any, texture });
            mesh.label = 'UserMesh';

            // Apply PixelSnap
            try {
                const { PixelSnapFilter } = await import('./PixelSnapFilter');
                if (PixelSnapFilter) {
                    // const filter = new PixelSnapFilter(this.virtualResolution);
                    // mesh.filters = [filter];
                }
            } catch (err) {
                console.warn('PixelSnapFilter error:', err);
            }

            this.spriteContainer.addChild(mesh);
            this.currentMesh = mesh;
            this.bindData = null; // Clear old binding
        } catch (error) {
            console.error('Failed to load sprite:', error);
        }
    }

    private bindSkeleton() {
        if (!this.currentMesh) {
            console.warn('bindSkeleton: No mesh found');
            return;
        }
        const store = useBoneStore.getState();
        if (store.bones.length === 0) {
            console.warn('bindSkeleton: No bones found');
            return;
        }

        console.log('bindSkeleton: Starting binding...');
        this.pendingJoint = null;

        // Ensure we have a geometry with accessible buffer
        const attribute = this.currentMesh.geometry.getAttribute('aPosition');
        const buffer = attribute.buffer;
        buffer.static = false; // Allow dynamic updates to vertices
        const vertices = buffer.data as Float32Array;

        console.log(`bindSkeleton: Mesh has ${vertices.length / 2} vertices. Bones: ${store.bones.length}`);

        // Save original state
        this.originalVertices = new Float32Array(vertices);
        this.bindData = [];

        // Calculate weights (Rigid Binding: 1 vertex = 1 bone)
        // Attribute stride/offset are in bytes. 1 float = 4 bytes.
        // If stride is 0, it means tightly packed (size * 4).
        const size = attribute.size || 2;
        const rawStride = attribute.stride || (size * 4);
        const rawOffset = attribute.offset || 0; // Pixi v8 uses 'offset', v7 used 'start' check types? Assuming offset.

        const stride = rawStride / 4;
        const offset = rawOffset / 4;

        console.log(`bindSkeleton: Stride (floats): ${stride}, Offset (floats): ${offset}, Total Length: ${vertices.length}`);
        console.log(`bindSkeleton: First vertex: ${vertices[offset]}, ${vertices[offset + 1]}`);
        console.log(`bindSkeleton: Last vertex: ${vertices[vertices.length - stride]}, ${vertices[vertices.length - stride + 1]}`);


        let boundCount = 0;
        // Iterate by stride
        for (let i = offset; i < vertices.length; i += stride) {
            const vx = vertices[i];
            const vy = vertices[i + 1];

            let closestBoneId = null;
            let minDist = Infinity;
            let closestWorld = null;

            // Find controlling bone
            for (const bone of store.bones) {
                const world = store.getWorldTransform(bone.id);
                const d = distance(world.x, world.y, vx, vy);

                if (d < minDist) {
                    minDist = d;
                    closestBoneId = bone.id;
                    closestWorld = world;
                }
            }

            if (closestBoneId && closestWorld) {
                // Calculate local offset
                const dx = vx - closestWorld.x;
                const dy = vy - closestWorld.y;
                const cos = Math.cos(-closestWorld.rotation);
                const sin = Math.sin(-closestWorld.rotation);

                this.bindData.push({
                    boneId: closestBoneId,
                    localX: cos * dx - sin * dy,
                    localY: sin * dx + cos * dy,
                    index: i // Store the index to write back to
                });
                boundCount++;
            } else {
                console.warn(`bindSkeleton: Vertex at index ${i} has no bone`);
            }
        }
        console.log(`bindSkeleton: Bound ${boundCount} vertices.`);
    }

    private unbindSkeleton() {
        if (!this.currentMesh || !this.originalVertices) return;

        // Restore original vertices
        const buffer = this.currentMesh.geometry.getAttribute('aPosition').buffer;
        const vertices = buffer.data as Float32Array;
        vertices.set(this.originalVertices);
        buffer.update();

        this.bindData = null;
    }

    private updateDeformation() {
        if (!this.currentMesh || !this.bindData) return;

        // console.log('updateDeformation: Running...'); // Uncomment for verbose loop log

        const store = useBoneStore.getState();
        const buffer = this.currentMesh.geometry.getAttribute('aPosition').buffer;
        const vertices = buffer.data as Float32Array;

        for (let i = 0; i < this.bindData.length; i++) {
            const data = this.bindData[i];
            if (!data.boneId) continue;

            const world = store.getWorldTransform(data.boneId);

            // Apply current bone transform to local offset
            const cos = Math.cos(world.rotation);
            const sin = Math.sin(world.rotation);


            const nx = world.x + (cos * data.localX - sin * data.localY);
            const ny = world.y + (sin * data.localX + cos * data.localY);

            // Use stored index to handle stride correctly
            vertices[data.index] = nx;
            vertices[data.index + 1] = ny;
        }

        buffer.update();
    }

    private startRenderLoop() {
        this.app.ticker.add(() => {
            const state = useBoneStore.getState();

            if (state.isBound) {
                this.updateDeformation();
            }

            this.boneRenderer.draw(
                state.bones,
                (id) => state.getWorldTransform(id),
                state.activeBoneId,
            );
        });
    }

    async exportSprite(): Promise<string | null> {
        if (!this.currentMesh) {
            console.warn('exportSprite: No mesh found');
            return null;
        }

        const frame = new Rectangle(0, 0, this.canvasSize, this.canvasSize);
        const sourceCanvas = this.app.renderer.extract.canvas({
            target: this.spriteContainer,
            frame,
            clearColor: [0, 0, 0, 0],
        }) as HTMLCanvasElement;

        if (!sourceCanvas) return null;

        if (this.virtualResolution && this.virtualResolution !== this.canvasSize) {
            const outCanvas = document.createElement('canvas');
            outCanvas.width = this.virtualResolution;
            outCanvas.height = this.virtualResolution;
            const ctx = outCanvas.getContext('2d');
            if (!ctx) return null;
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, outCanvas.width, outCanvas.height);
            ctx.drawImage(sourceCanvas, 0, 0, outCanvas.width, outCanvas.height);
            return outCanvas.toDataURL('image/png');
        }

        return sourceCanvas.toDataURL('image/png');
    }

    private createPlaneGeometry(width: number, height: number, segX: number, segY: number): MeshGeometry {
        console.log('SceneManager: Creating MeshGeometry (auto-bounds)');
        const totalVerts = (segX + 1) * (segY + 1);

        const positions = new Float32Array(totalVerts * 2);
        const uvs = new Float32Array(totalVerts * 2);
        const indices: number[] = [];

        for (let y = 0; y <= segY; y++) {
            for (let x = 0; x <= segX; x++) {
                const i = y * (segX + 1) + x;

                // Position (0..width, 0..height)
                positions[i * 2] = (x / segX) * width;
                positions[i * 2 + 1] = (y / segY) * height;

                // UV (0..1)
                uvs[i * 2] = x / segX;
                uvs[i * 2 + 1] = y / segY;

                // Indices
                if (x < segX && y < segY) {
                    const topLeft = y * (segX + 1) + x;
                    const topRight = topLeft + 1;
                    const bottomLeft = (y + 1) * (segX + 1) + x;
                    const bottomRight = bottomLeft + 1;

                    indices.push(topLeft, topRight, bottomLeft);
                    indices.push(topRight, bottomRight, bottomLeft);
                }
            }
        }

        const geometry = new MeshGeometry({
            positions,
            uvs,
            indices: new Uint32Array(indices)
        });

        return geometry;
    }

    destroy() {
        this.app.destroy(true, { children: true, texture: true });
    }
}
