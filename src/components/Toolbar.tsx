import { useRef } from 'react';
import { MousePointer2, Plus, Link, Upload, Trash2 } from 'lucide-react';
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
                            onClick={() => setActiveTool(tool.id)}
                            title={tool.label}
                        >
                            <Icon size={18} />
                            <span className="toolbar-btn-label">{tool.label}</span>
                        </button>
                    );
                })}
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
