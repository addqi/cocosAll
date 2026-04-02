/** 像素缓冲区封装：统一管理 PixelBuffer 数据 */

export class PixelBuffer {
    private readonly _data: Uint8Array;
    readonly _width: number;
    readonly _height: number;

    constructor(width: number, height: number) {
        this._data = new Uint8Array(width * height * 4);
        this._width = width;
        this._height = height;
    }

    /** 填充所有像素为指定颜色 */
    fill(r: number, g: number, b: number, a: number): void {
        for (let i = 0; i < this._data.length; i += 4) {
            this._data[i] = r;
            this._data[i + 1] = g;
            this._data[i + 2] = b;
            this._data[i + 3] = a;
        }
    }
    /** 设置单个像素的 RGBA */
    setPixel(row: number, col: number, r: number, g: number, b: number, a: number): void {
        const idx = this._index(row, col);
        this._data[idx] = r;
        this._data[idx + 1] = g;
        this._data[idx + 2] = b;
        this._data[idx + 3] = a;
    }

    /** 获取单个像素的 RGBA */
    getPixel(row: number, col: number): { r: number; g: number; b: number; a: number } {
        const idx = this._index(row, col);
        return { r: this._data[idx], g: this._data[idx + 1], b: this._data[idx + 2], a: this._data[idx + 3] };
    }

    /** 获取单个像素的 alpha 值 */
    getAlpha(row: number, col: number): number {
        const idx = this._index(row, col) + 3;
        return this._data[idx];
    }

    /** 获取单个像素的 R 值 */
    getR(row: number, col: number): number {
        const idx = this._index(row, col);
        return this._data[idx];
    }

    /** 行列 → 字节偏移量：逻辑 row0 = 图像顶部 */
    private _index(row: number, col: number): number {
        return (row * this._width + col) * 4;
    }

    /**
     * 行序翻转后的副本，供 Texture2D.uploadData。
     * OpenGL 纹理首行在底部；逻辑数据 row0 在顶部，上传前需翻转一次。
     */
    getFlippedData(): Uint8Array {
        const flipped = new Uint8Array(this._data.length);
        const rowBytes = this._width * 4;
        for (let r = 0; r < this._height; r++) {
            const src = r * rowBytes;
            const dst = (this._height - 1 - r) * rowBytes;
            flipped.set(this._data.subarray(src, src + rowBytes), dst);
        }
        return flipped;
    }

    /** 逻辑行主序原始数据（row0=顶部）；上传 GPU 请用 getFlippedData() */
    get data(): Uint8Array {
        return this._data;
    }
}