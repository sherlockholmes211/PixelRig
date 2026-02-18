import { useRef } from 'react';
import { MousePointer2, Plus, Link, Upload, Trash2, Link2, Sparkles, RotateCcw } from 'lucide-react';
import { useBoneStore } from '../store/useBoneStore';
import type { Tool } from '../types';

/**
 * Toolbar — horizontal strip of tool buttons at the top of the editor.
 */
export function Toolbar() {
    const activeTool = useBoneStore((s) => s.activeTool);
    const setActiveTool = useBoneStore((s) => s.setActiveTool);
    const setSpriteDataUrl = useBoneStore((s) => s.setSpriteDataUrl);
    const activeBoneId = useBoneStore((s) => s.activeBoneId);
    const removeBone = useBoneStore((s) => s.removeBone);
    const isBound = useBoneStore((s) => s.isBound);
    const setBound = useBoneStore((s) => s.setBound);
    const bonesCount = useBoneStore((s) => s.bones.length);
    const spriteDataUrl = useBoneStore((s) => s.spriteDataUrl);
    const requestGenerate = useBoneStore((s) => s.requestGenerate);
    const isGenerating = useBoneStore((s) => s.isGenerating);
    const bindPose = useBoneStore((s) => s.bindPose);
    const resetPose = useBoneStore((s) => s.resetPose);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const tools: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
        { id: 'select', label: 'Select', icon: MousePointer2 },
        { id: 'addJoint', label: 'Add Joint', icon: Plus },
        { id: 'addBone', label: 'Add Bone', icon: Link },
    ];

    const handleUpload = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setSpriteDataUrl(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
        // Reset input value to allow selecting the same file again
        e.target.value = '';
    };

    const handleDelete = () => {
        if (activeBoneId) {
            removeBone(activeBoneId);
        }
    };

    return (
        <header className="toolbar">
            <div className="toolbar-brand">
                <div className="brand-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="2" y="2" width="6" height="6" rx="1" fill="#818cf8" />
                        <rect x="10" y="2" width="6" height="6" rx="1" fill="#6366f1" opacity="0.7" />
                        <rect x="2" y="10" width="6" height="6" rx="1" fill="#6366f1" opacity="0.7" />
                        <rect x="10" y="10" width="6" height="6" rx="1" fill="#4f46e5" opacity="0.5" />
                    </svg>
                </div>
                <span className="brand-name">PixelRig</span>
            </div>

            <div className="toolbar-separator" />

            <div className="toolbar-tools">
                {tools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                        <button
                            key={tool.id}
                            className={`toolbar-btn ${activeTool === tool.id ? 'active' : ''}`}
                            onClick={() => !isBound && setActiveTool(tool.id)}
                            disabled={isBound}
                            title={isBound ? 'Unbind to edit skeleton' : tool.label}
                        >
                            <Icon size={18} />
                            <span className="toolbar-btn-label">{tool.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="toolbar-separator" />

            <div className="toolbar-actions">
                <button
                    className="toolbar-btn"
                    onClick={() => requestGenerate()}
                    disabled={!spriteDataUrl || !isBound || isGenerating}
                    title={
                        !spriteDataUrl
                            ? 'Upload a sprite first'
                            : !isBound
                                ? 'Bind the skeleton before generating'
                                : isGenerating
                                    ? 'Generating...'
                                    : 'Generate Sprite'
                    }
                >
                    <Sparkles size={18} />
                    <span className="toolbar-btn-label">{isGenerating ? 'Generating' : 'Generate'}</span>
                </button>
                <button
                    className="toolbar-btn"
                    onClick={() => resetPose()}
                    disabled={!isBound || !bindPose || isGenerating}
                    title={!isBound ? 'Bind the skeleton to enable reset' : 'Reset pose to bind state'}
                >
                    <RotateCcw size={18} />
                    <span className="toolbar-btn-label">Reset Pose</span>
                </button>
            </div>

            <div className="toolbar-separator" />

            <div className="toolbar-actions">
                <button
                    className={`toolbar-btn ${isBound ? 'active' : ''}`}
                    onClick={() => setBound(!isBound)}
                    disabled={!isBound && (!spriteDataUrl || bonesCount === 0)}
                    title={
                        isBound
                            ? 'Unbind Skeleton'
                            : !spriteDataUrl
                                ? 'Upload a sprite first'
                                : bonesCount === 0
                                    ? 'Add at least one bone before binding'
                                    : 'Bind Skeleton'
                    }
                    style={{ color: isBound ? '#10b981' : undefined }}
                >
                    <Link2 size={18} />
                    <span className="toolbar-btn-label">{isBound ? 'Bound' : 'Bind'}</span>
                </button>
            </div>
            <div className="toolbar-separator" />

            <div className="toolbar-actions">
                <button className="toolbar-btn" onClick={handleUpload} title="Upload Sprite">
                    <Upload size={18} />
                    <span className="toolbar-btn-label">Upload</span>
                </button>
                <button
                    className="toolbar-btn danger"
                    onClick={handleDelete}
                    disabled={!activeBoneId}
                    title="Delete Bone"
                >
                    <Trash2 size={18} />
                </button>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/gif,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
        </header>
    );
}
