import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { EditorState, Bone } from '../types';

export const useBoneStore = create<EditorState>((set, get) => ({
    bones: [],
    activeBoneId: null,
    activeTool: 'select',
    isBound: false,
    spriteDataUrl: null,
    generatedSpriteUrl: null,
    generationError: null,
    isGenerating: false,
    generationRequestId: 0,
    bindPose: null,
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
    setBound: (bound) =>
        set((state) => {
            if (bound) {
                const bindPose = state.bones.reduce<Record<string, { position: { x: number; y: number }; rotation: number }>>(
                    (acc, bone) => {
                        acc[bone.id] = {
                            position: { ...bone.position },
                            rotation: bone.rotation,
                        };
                        return acc;
                    },
                    {},
                );
                return {
                    isBound: true,
                    activeTool: 'select',
                    bindPose,
                };
            }

            return {
                isBound: false,
                bindPose: null,
            };
        }),
    setSpriteDataUrl: (url) =>
        set(() => ({
            spriteDataUrl: url,
            isBound: false,
            generatedSpriteUrl: null,
            generationError: null,
            isGenerating: false,
            bindPose: null,
        })),
    requestGenerate: () =>
        set((state) => ({
            generationRequestId: state.generationRequestId + 1,
            isGenerating: true,
            generationError: null,
        })),
    setGeneratedSpriteUrl: (url) => set({ generatedSpriteUrl: url }),
    setGenerationError: (error) => set({ generationError: error }),
    setIsGenerating: (isGenerating) => set({ isGenerating }),
    resetPose: () =>
        set((state) => {
            if (!state.bindPose) return {};
            return {
                bones: state.bones.map((bone) => {
                    const pose = state.bindPose?.[bone.id];
                    if (!pose) return bone;
                    return {
                        ...bone,
                        position: { ...pose.position },
                        rotation: pose.rotation,
                    };
                }),
            };
        }),

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
