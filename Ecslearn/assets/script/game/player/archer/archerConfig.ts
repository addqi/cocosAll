export interface ArcherConfigData {
    arrowSpeed: number;
    arrowTexture: string;
    arrowWidth: number;
    arrowHeight: number;
    arrowArcRatio: number;
    arrowNoTargetRange: number;
}

export const archerConfig: ArcherConfigData = {
    arrowSpeed: 300,
    arrowTexture: 'Archer/Arrow',
    arrowWidth: 64,
    arrowHeight: 64,
    arrowArcRatio: 0.3,
    arrowNoTargetRange: 600,
};
