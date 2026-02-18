import { Graphics, Container } from 'pixi.js';

/**
 * Renders a pixel grid overlay on the canvas.
 * Shows the virtual pixel boundaries so the artist can see
 * exactly where each "virtual pixel" falls.
 */
export class GridRenderer {
    public container: Container;
    private graphics: Graphics;

    /** Build the grid container and draw the initial lines. */
    constructor(
        private canvasSize: number,
        private virtualResolution: number,
    ) {
        this.container = new Container();
        this.container.label = 'GridOverlay';
        this.graphics = new Graphics();
        this.container.addChild(this.graphics);
        this.draw();
    }

    /** Draw the grid lines and border at the current resolution. */
    draw() {
        const g = this.graphics;
        g.clear();

        const cellSize = this.canvasSize / this.virtualResolution;

        // Draw grid lines
        g.setStrokeStyle({
            width: 0.5,
            color: 0xffffff,
            alpha: 0.08,
        });

        // Vertical lines
        for (let i = 0; i <= this.virtualResolution; i++) {
            const x = i * cellSize;
            g.moveTo(x, 0);
            g.lineTo(x, this.canvasSize);
        }

        // Horizontal lines
        for (let j = 0; j <= this.virtualResolution; j++) {
            const y = j * cellSize;
            g.moveTo(0, y);
            g.lineTo(this.canvasSize, y);
        }

        g.stroke();

        // Draw border
        g.setStrokeStyle({
            width: 1,
            color: 0x6366f1,
            alpha: 0.3,
        });
        g.rect(0, 0, this.canvasSize, this.canvasSize);
        g.stroke();
    }

    /** Update the grid resolution and redraw. */
    updateResolution(virtualResolution: number) {
        this.virtualResolution = virtualResolution;
        this.draw();
    }

    /** Dispose of grid rendering resources. */
    destroy() {
        this.container.destroy({ children: true });
    }
}
