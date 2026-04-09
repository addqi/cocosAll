export enum ToolType {
    None = 0,
    MagicWand = 1,
    Bomb = 2,
    Magnifier = 3,
}

export enum ToolTriggerMode {
    ClickToolThenCell = 0,
    ClickTool = 1,
}

export interface ToolDef {
    type: ToolType;
    name: string;
    triggerMode: ToolTriggerMode;
    initCount: number;
}

export const ToolDefs: readonly ToolDef[] = [
    { type: ToolType.MagicWand, name: '魔术棒', triggerMode: ToolTriggerMode.ClickToolThenCell, initCount: 5 },
    { type: ToolType.Bomb,      name: '炸弹',   triggerMode: ToolTriggerMode.ClickToolThenCell, initCount: 5 },
    { type: ToolType.Magnifier, name: '放大镜', triggerMode: ToolTriggerMode.ClickTool,         initCount: 5 },
];

export const ToolParams = {
    bombDiameter: 11,
    magnifierZoomDuration: 0.4,
    magnifierBlinkCount: 3,
    magnifierBlinkInterval: 0.2,
} as const;
