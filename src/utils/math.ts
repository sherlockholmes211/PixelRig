import type { Bone } from '../types';

/**
 * Applies FK (Forward Kinematics) rotation propagation.
 * When a bone rotates by `deltaRotation`, all descendants inherit
 * the rotation so the skeleton moves as a rigid hierarchy.
 *
 * @returns Updated bone array with rotations applied.
 */
export function applyFKRotation(
    bones: Bone[],
    boneId: string,
    deltaRotation: number,
): Bone[] {
    const updated = bones.map((b) => ({ ...b }));

    // Find the target bone and apply direct rotation
    const target = updated.find((b) => b.id === boneId);
    if (!target) return updated;
    target.rotation += deltaRotation;

    // Recursively propagate to children
    // Walk the hierarchy so downstream bones inherit parent rotation in world space.
    const propagate = (parentId: string) => {
        for (const child of updated.filter((b) => b.parentId === parentId)) {
            // Children inherit the delta but don't add it to their own rotation
            // FK means the child's world transform inherits the parent's rotation
            // The world transform calculation in the store handles this automatically
            propagate(child.id);
        }
    };
    propagate(boneId);

    return updated;
}

/**
 * Normalizes an angle to the range [-PI, PI].
 */
export function normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

/**
 * Calculates the angle from point (x1, y1) to point (x2, y2).
 */
export function angleBetween(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
): number {
    return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * Calculates the distance between two points.
 */
export function distance(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}
