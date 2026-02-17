import { useBoneStore } from '../store/useBoneStore';

/**
 * Sidebar — left panel showing bone hierarchy and properties.
 */
export function Sidebar() {
    const bones = useBoneStore((s) => s.bones);
    const activeBoneId = useBoneStore((s) => s.activeBoneId);
    const setActiveBone = useBoneStore((s) => s.setActiveBone);
    const updateBone = useBoneStore((s) => s.updateBone);
    const activeBone = bones.find((b) => b.id === activeBoneId);
    const rootBones = bones.filter((b) => b.parentId === null);

    const renderBoneTree = (parentId: string | null, depth: number = 0) => {
        const children = parentId === null
            ? rootBones
            : bones.filter((b) => b.parentId === parentId);

        return children.map((bone) => (
            <div key={bone.id}>
                <button
                    className={`bone-tree-item ${bone.id === activeBoneId ? 'active' : ''}`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                    onClick={() => setActiveBone(bone.id)}
                >
                    <span className="bone-tree-dot" />
                    <span className="bone-tree-name">{bone.name}</span>
                    {bone.length === 0 && <span className="bone-tree-tag">joint</span>}
                </button>
                {renderBoneTree(bone.id, depth + 1)}
            </div>
        ));
    };

    const toDeg = (rad: number) => ((rad * 180) / Math.PI).toFixed(1);
    const toRad = (deg: string) => (parseFloat(deg) * Math.PI) / 180;

    return (
        <aside className="sidebar">
            <div className="sidebar-section">
                <h3 className="sidebar-heading">Bone Hierarchy</h3>
                <div className="bone-tree">
                    {bones.length === 0 ? (
                        <p className="sidebar-empty">
                            No bones yet. Use the<br />
                            <strong>Add Joint</strong> tool to start.
                        </p>
                    ) : (
                        renderBoneTree(null)
                    )}
                </div>
            </div>

            {activeBone && (
                <div className="sidebar-section">
                    <h3 className="sidebar-heading">Properties</h3>
                    <div className="properties-grid">
                        <label className="prop-label">Name</label>
                        <input
                            className="prop-input"
                            value={activeBone.name}
                            onChange={(e) => updateBone(activeBone.id, { name: e.target.value })}
                        />

                        <label className="prop-label">Position X</label>
                        <input
                            className="prop-input"
                            type="number"
                            value={activeBone.position.x.toFixed(1)}
                            onChange={(e) =>
                                updateBone(activeBone.id, {
                                    position: { ...activeBone.position, x: parseFloat(e.target.value) || 0 },
                                })
                            }
                        />

                        <label className="prop-label">Position Y</label>
                        <input
                            className="prop-input"
                            type="number"
                            value={activeBone.position.y.toFixed(1)}
                            onChange={(e) =>
                                updateBone(activeBone.id, {
                                    position: { ...activeBone.position, y: parseFloat(e.target.value) || 0 },
                                })
                            }
                        />

                        <label className="prop-label">Rotation (°)</label>
                        <input
                            className="prop-input"
                            type="number"
                            step="0.5"
                            value={toDeg(activeBone.rotation)}
                            onChange={(e) =>
                                updateBone(activeBone.id, { rotation: toRad(e.target.value) })
                            }
                        />

                        <label className="prop-label">Length</label>
                        <input
                            className="prop-input"
                            type="number"
                            value={activeBone.length.toFixed(1)}
                            onChange={(e) =>
                                updateBone(activeBone.id, { length: parseFloat(e.target.value) || 0 })
                            }
                        />
                    </div>
                </div>
            )}

            <div className="sidebar-footer">
                <div className="sidebar-stat">
                    <span className="stat-label">Bones</span>
                    <span className="stat-value">{bones.filter((b) => b.length > 0).length}</span>
                </div>
                <div className="sidebar-stat">
                    <span className="stat-label">Joints</span>
                    <span className="stat-value">{bones.filter((b) => b.length === 0).length}</span>
                </div>
            </div>
        </aside>
    );
}
