export interface Bone {
    id: string;
    name: string;
    parentId: string | null;
    position: { x: number; y: number };
    rotation: number; // radians
    length: number;
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
    spriteDataUrl: string | null;

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
    setSpriteDataUrl: (url: string | null) => void;

    // Derived
    getChildren: (boneId: string) => Bone[];
    getRootBones: () => Bone[];
    getWorldTransform: (boneId: string) => WorldTransform;
}
