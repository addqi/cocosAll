/** 与 G15_FBase_ZoomFadeLogic 一致：smoothstep + alpha 量化 */

export function smoothstep(edge0: number, edge1: number, x: number): number {
    if (edge1 <= edge0) return 0;
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

export function quantizeZoomFadeAlpha(rawAlpha: number, steps: number): number {
    return Math.round(rawAlpha * steps) / steps;
}

/** nonSelAlpha = 1 - (1 - α)²，再量化（盘面非选中格） */
export function nonSelectedBoardFadeAlpha(quantizedAlpha: number, steps: number): number {
    const inv = 1 - quantizedAlpha;
    return quantizeZoomFadeAlpha(1 - inv * inv, steps);
}
