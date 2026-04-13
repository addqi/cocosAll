/**
 * Cellular-automata terrain generator.
 *
 * Output: a plain number[][] grid (0 = empty, 1 = terrain).
 * No rendering, no Cocos dependencies — pure data.
 */

export interface MapGenConfig {
    cols: number;
    rows: number;
    fillRatio: number;
    smoothPasses: number;
    borderPad: number;
    seed?: number;
}

const DEFAULTS: MapGenConfig = {
    cols: 24,
    rows: 18,
    fillRatio: 0.52,
    smoothPasses: 5,
    borderPad: 2,
};

function mulberry32(seed: number): () => number {
    let s = seed | 0;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class MapGenerator {

    /**
     * 标准竞技场：整块矩形草地平台，外围 1 格空白留给边缘/悬崖渲染。
     */
    static generateArena(cols: number, rows: number): number[][] {
        const grid: number[][] = [];
        for (let r = 0; r < rows; r++) {
            const row: number[] = [];
            for (let c = 0; c < cols; c++) {
                const border = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
                row.push(border ? 0 : 1);
            }
            grid.push(row);
        }
        return grid;
    }

    static generate(override: Partial<MapGenConfig> = {}): number[][] {
        const cfg = { ...DEFAULTS, ...override };
        const rng = mulberry32(cfg.seed ?? (Date.now() | 0));
        const { rows, cols, borderPad } = cfg;

        const grid = this._randomFill(rows, cols, borderPad, cfg.fillRatio, rng);

        for (let i = 0; i < cfg.smoothPasses; i++) {
            this._smooth(grid, rows, cols);
        }

        this._clearBorder(grid, rows, cols, borderPad);
        this._keepLargestRegion(grid, rows, cols);

        return grid;
    }

    static calcBitmask(grid: number[][], r: number, c: number): number {
        const rows = grid.length, cols = grid[0].length;
        let m = 0;
        if (r > 0 && grid[r - 1][c])           m |= 1;
        if (c < cols - 1 && grid[r][c + 1])     m |= 2;
        if (r < rows - 1 && grid[r + 1][c])     m |= 4;
        if (c > 0 && grid[r][c - 1])            m |= 8;
        return m;
    }

    /* ── internals ── */

    private static _randomFill(
        rows: number, cols: number, pad: number, ratio: number, rng: () => number,
    ): number[][] {
        const grid: number[][] = [];
        for (let r = 0; r < rows; r++) {
            const row: number[] = [];
            for (let c = 0; c < cols; c++) {
                const inPad = r < pad || r >= rows - pad || c < pad || c >= cols - pad;
                row.push(inPad ? 0 : (rng() < ratio ? 1 : 0));
            }
            grid.push(row);
        }
        return grid;
    }

    private static _smooth(grid: number[][], rows: number, cols: number): void {
        const snap = grid.map(r => r.slice());
        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                let n = 0;
                for (let dr = -1; dr <= 1; dr++)
                    for (let dc = -1; dc <= 1; dc++)
                        n += snap[r + dr][c + dc];
                grid[r][c] = n >= 5 ? 1 : 0;
            }
        }
    }

    private static _clearBorder(
        grid: number[][], rows: number, cols: number, pad: number,
    ): void {
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++)
                if (r < pad || r >= rows - pad || c < pad || c >= cols - pad)
                    grid[r][c] = 0;
    }

    private static _keepLargestRegion(
        grid: number[][], rows: number, cols: number,
    ): void {
        const visited = Array.from({ length: rows }, () => new Uint8Array(cols));
        let bestId = 0;
        let bestSize = 0;
        const regionId: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
        let currentId = 0;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (visited[r][c] || !grid[r][c]) continue;
                currentId++;
                const size = this._flood(grid, visited, regionId, rows, cols, r, c, currentId);
                if (size > bestSize) { bestSize = size; bestId = currentId; }
            }
        }

        for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++)
                if (grid[r][c] && regionId[r][c] !== bestId)
                    grid[r][c] = 0;
    }

    private static _flood(
        grid: number[][], visited: Uint8Array[], regionId: number[][],
        rows: number, cols: number, sr: number, sc: number, id: number,
    ): number {
        const stack: number[] = [sr, sc];
        let size = 0;
        while (stack.length) {
            const c = stack.pop()!;
            const r = stack.pop()!;
            if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
            if (visited[r][c] || !grid[r][c]) continue;
            visited[r][c] = 1;
            regionId[r][c] = id;
            size++;
            stack.push(r - 1, c, r + 1, c, r, c - 1, r, c + 1);
        }
        return size;
    }
}
