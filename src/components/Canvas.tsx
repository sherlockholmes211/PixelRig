import { useEffect, useRef, useCallback, useState } from 'react';
import { useBoneStore } from '../store/useBoneStore';

// Lazy import to prevent PixiJS from initializing during component module load
let SceneManagerModule: typeof import('../pixi/SceneManager') | null = null;

/**
 * Canvas component — mounts the PixiJS application and handles
 * sprite loading reactively from the Zustand store.
 */
export function Canvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sceneRef = useRef<any>(null);
    const spriteDataUrl = useBoneStore((s) => s.spriteDataUrl);
    const generationRequestId = useBoneStore((s) => s.generationRequestId);
    const setGeneratedSpriteUrl = useBoneStore((s) => s.setGeneratedSpriteUrl);
    const setGenerationError = useBoneStore((s) => s.setGenerationError);
    const setIsGenerating = useBoneStore((s) => s.setIsGenerating);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize the Pixi scene once the canvas is mounted.
    useEffect(() => {
        if (!canvasRef.current) return;

        let destroyed = false;

        // Initialize Pixi scene lazily to avoid blocking React load.
        const initScene = async () => {
            try {
                // Dynamically import to ensure it doesn't block React rendering
                if (!SceneManagerModule) {
                    SceneManagerModule = await import('../pixi/SceneManager');
                }
                const scene = new SceneManagerModule.SceneManager();
                sceneRef.current = scene;
                await scene.init(canvasRef.current!);
                if (!destroyed) {
                    setIsReady(true);
                }
            } catch (err) {
                console.error('Failed to initialize PixiJS:', err);
                if (!destroyed) {
                    setError(String(err));
                }
            }
        };

        initScene();

        return () => {
            destroyed = true;
            if (sceneRef.current) {
                sceneRef.current.destroy();
                sceneRef.current = null;
            }
            setIsReady(false);
        };
    }, []);

    // Load sprite when dataUrl changes
    useEffect(() => {
        if (spriteDataUrl && sceneRef.current && isReady) {
            sceneRef.current.loadSprite(spriteDataUrl);
        }
    }, [spriteDataUrl, isReady]);

    // Run sprite generation whenever a new request id is issued.
    useEffect(() => {
        if (!generationRequestId || !sceneRef.current || !isReady) return;

        let cancelled = false;

        // Export the posed sprite and push result into the store.
        const run = async () => {
            const state = useBoneStore.getState();
            if (!state.spriteDataUrl) {
                setGenerationError('Upload a sprite before generating.');
                setIsGenerating(false);
                return;
            }
            if (!state.isBound) {
                setGenerationError('Bind the skeleton before generating.');
                setIsGenerating(false);
                return;
            }

            try {
                const dataUrl = await sceneRef.current.exportSprite();
                if (cancelled) return;
                if (dataUrl) {
                    setGeneratedSpriteUrl(dataUrl);
                    setGenerationError(null);
                } else {
                    setGenerationError('Failed to export sprite.');
                }
            } catch (err) {
                if (!cancelled) {
                    setGenerationError(String(err));
                }
            } finally {
                if (!cancelled) {
                    setIsGenerating(false);
                }
            }
        };

        run();

        return () => {
            cancelled = true;
        };
    }, [generationRequestId, isReady, setGeneratedSpriteUrl, setGenerationError, setIsGenerating]);

    // Handle drag-and-drop sprite uploads on the canvas.
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target?.result as string;
                useBoneStore.getState().setSpriteDataUrl(dataUrl);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    // Prevent default to allow drop.
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    return (
        <div
            className="canvas-wrapper"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <canvas
                ref={canvasRef}
                id="pixelrig-canvas"
                className="canvas-element"
            />
            {error && (
                <div className="canvas-placeholder">
                    <div className="placeholder-content">
                        <p className="placeholder-title" style={{ color: '#ef4444' }}>Failed to initialize</p>
                        <p className="placeholder-subtitle">{error}</p>
                    </div>
                </div>
            )}
            {!spriteDataUrl && !error && (
                <div className="canvas-placeholder">
                    <div className="placeholder-content">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                        </svg>
                        <p className="placeholder-title">Drop your sprite here</p>
                        <p className="placeholder-subtitle">or use the upload button in the toolbar</p>
                    </div>
                </div>
            )}
        </div>
    );
}
