export interface Bone {
    id: string;
    name: string;
    parentId: string | null;
    position: { x: number; y: number };
    rotation: number; // radians
    length: number;
    // Influence radius for auto-weighting (simple skinning)
    radius: number;
}

export interface WorldTransform {
    x: number;
    y: number;
    rotation: number;
}

export type Tool = 'select' | 'addJoint' | 'addBone';

export interface EditorState {
    // Bone hierarchy
    bones: Bone[];
    activeBoneId: string | null;
    activeTool: Tool;
    isBound: boolean;
    spriteDataUrl: string | null;
    generatedSpriteUrl: string | null;
    generationError: string | null;
    isGenerating: boolean;
    generationRequestId: number;
    bindPose: Record<string, { position: { x: number; y: number }; rotation: number }> | null;

    // Virtual resolution (pixel art size)
    virtualResolution: number;
    // Display canvas size
    canvasSize: number;

    // Actions
    addBone: (bone: Omit<Bone, 'id' | 'name'>) => void;
    removeBone: (id: string) => void;
    updateBone: (id: string, updates: Partial<Bone>) => void;
    setActiveBone: (id: string | null) => void;
    setActiveTool: (tool: Tool) => void;
    setBound: (bound: boolean) => void;
    setSpriteDataUrl: (url: string | null) => void;
    requestGenerate: () => void;
    setGeneratedSpriteUrl: (url: string | null) => void;
    setGenerationError: (error: string | null) => void;
    setIsGenerating: (isGenerating: boolean) => void;
    resetPose: () => void;

    // Derived
    getChildren: (boneId: string) => Bone[];
    getRootBones: () => Bone[];
    getWorldTransform: (boneId: string) => WorldTransform;
}
