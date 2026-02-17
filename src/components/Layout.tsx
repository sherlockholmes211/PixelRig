import { Toolbar } from './Toolbar';
import { Canvas } from './Canvas';
import { Sidebar } from './Sidebar';

/**
 * Layout — the main editor shell with dark-mode styling.
 * Three regions: top toolbar, left sidebar, center canvas.
 */
export function Layout() {
    return (
        <div className="editor-layout">
            <Toolbar />
            <div className="editor-body">
                <Sidebar />
                <main className="editor-canvas-area">
                    <Canvas />
                </main>
            </div>
        </div>
    );
}
