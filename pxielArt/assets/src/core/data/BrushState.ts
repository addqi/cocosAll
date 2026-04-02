/**
 * 画笔状态
 */
export class BrushState {
    /** 当前选中的颜色编号（对应 palette 数组下标） */
    currentIndex: number = 0;

    /** 调色板引用（初始化时设置） */
    palette: string[] = [];

    /** 当前颜色的 hex 字符串，如 '#ff0000' */
    get currentColor(): string {
        return this.palette[this.currentIndex] ?? '#000000';
    }
    // BrushState.ts 加一个方法
getRGB(index: number): [number, number, number] {
    const hexStr = this.palette[index] ?? '#000000';
    const hex = parseInt(hexStr.slice(1), 16);
    return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

    /** 当前颜色的 RGB 数值，如 [255, 0, 0] */
    get currentRGB(): [number, number, number] {
        return this.getRGB(this.currentIndex);
    }
}