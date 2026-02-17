import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { EditorState, Bone, WorldTransform } from '../types';

export const useBoneStore = create<EditorState>((set, get) => ({
    bones: [],
    activeBoneId: null,
    activeTool: 'select',
    spriteDataUrl: null,
    virtualResolution: 64,
    canvasSize: 1024,

    addBone: (boneData) => {
        const boneCount = get().bones.length;
        const bone: Bone = {
            ...boneData,
            id: uuidv4(),
            name: `Bone_${boneCount + 1}`,
        };
        set((state) => ({ bones: [...state.bones, bone] }));
    },

    removeBone: (id) => {
        set((state) => {
            // Recursively remove children
            const toRemove = new Set<string>();
            const collectChildren = (parentId: string) => {
                toRemove.add(parentId);
                state.bones
                    .filter((b) => b.parentId === parentId)
                    .forEach((child) => collectChildren(child.id));
            };
            collectChildren(id);
            return {
                bones: state.bones.filter((b) => !toRemove.has(b.id)),
                activeBoneId:
                    state.activeBoneId && toRemove.has(state.activeBoneId)
                        ? null
                        : state.activeBoneId,
            };
        });
    },

    updateBone: (id, updates) => {
        set((state) => ({
            bones: state.bones.map((b) => (b.id === id ? { ...b, ...updates } : b)),
        }));
    },

    setActiveBone: (id) => set({ activeBoneId: id }),
    setActiveTool: (tool) => set({ activeTool: tool }),
    setSpriteDataUrl: (url) => set({ spriteDataUrl: url }),

    getChildren: (boneId) => {
        return get().bones.filter((b) => b.parentId === boneId);
    },

    getRootBones: () => {
        return get().bones.filter((b) => b.parentId === null);
    },

    getWorldTransform: (boneId) => {
        const { bones } = get();
        const bone = bones.find((b) => b.id === boneId);
        if (!bone) return { x: 0, y: 0, rotation: 0 };

        // Walk up the hierarchy accumulating transforms
        const chain: Bone[] = [];
        let current: Bone | undefined = bone;
        while (current) {
            chain.unshift(current);
            current = current.parentId
                ? bones.find((b) => b.id === current!.parentId)
                : undefined;
        }

        let worldX = 0;
        let worldY = 0;
        let worldRot = 0;

        for (const b of chain) {
            // Rotate the bone's local position by the accumulated world rotation
            const cos = Math.cos(worldRot);
            const sin = Math.sin(worldRot);
            const localX = b.position.x;
            const localY = b.position.y;
            worldX += cos * localX - sin * localY;
            worldY += sin * localX + cos * localY;
            worldRot += b.rotation;
        }

        return { x: worldX, y: worldY, rotation: worldRot };
    },
}));
