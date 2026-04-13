/**
 * Terrain tileset: 4-direction bitmask auto-tiling.
 *
 * Tileset grid: 9 cols × 6 rows, each cell 64×64.
 *   Left block  (cols 0-3): grass surface (3×3 outer + inner corners)
 *   Right block (cols 5-8): grass surface + cliff side
 *   Col 4: separator (empty)
 *
 * Bitmask bits: UP=1  RIGHT=2  DOWN=4  LEFT=8
 */

export const TILE_SIZE = 64;
export const TILE_DIR = 'terrain_tiles';

/* ── direction flags ── */

export const DIR_UP    = 0b0001;
export const DIR_RIGHT = 0b0010;
export const DIR_DOWN  = 0b0100;
export const DIR_LEFT  = 0b1000;

/* ── grass surface: bitmask (0-15) → [row, col] ── */

export const SURFACE_MAP: readonly (readonly [number, number])[] = [
    /* 0  0b0000 isolated   */ [3, 3],
    /* 1  0b0001 U          */ [2, 1],
    /* 2  0b0010 R          */ [1, 0],
    /* 3  0b0011 U+R  → BL  */ [2, 0],
    /* 4  0b0100 D          */ [0, 1],
    /* 5  0b0101 U+D  pipe  */ [1, 1],
    /* 6  0b0110 R+D  → TL  */ [0, 0],
    /* 7  0b0111 U+R+D → L  */ [1, 0],
    /* 8  0b1000 L          */ [1, 3],
    /* 9  0b1001 U+L  → BR  */ [2, 3],
    /* 10 0b1010 R+L  pipe  */ [1, 1],
    /* 11 0b1011 U+R+L → B  */ [2, 1],
    /* 12 0b1100 D+L  → TR  */ [0, 3],
    /* 13 0b1101 U+D+L → R  */ [1, 3],
    /* 14 0b1110 R+D+L → T  */ [0, 1],
    /* 15 0b1111 center     */ [1, 1],
];

/* ── cliff side (right block, cols 5-8) ── */

export const CLIFF_DEPTH = 4;

const CLIFF_COL_L = 5;
const CLIFF_COL_CA = 6;
const CLIFF_COL_CB = 7;
const CLIFF_COL_R = 8;
const CLIFF_ROW_START = 2;

export function cliffTile(
    depth: number,
    hasLeft: boolean,
    hasRight: boolean,
    posHash: number,
): [number, number] {
    const row = CLIFF_ROW_START + Math.min(depth, CLIFF_DEPTH - 1);
    let col: number;
    if (!hasLeft && hasRight)       col = CLIFF_COL_L;
    else if (hasLeft && !hasRight)  col = CLIFF_COL_R;
    else                            col = (posHash & 1) ? CLIFF_COL_CA : CLIFF_COL_CB;
    return [row, col];
}

export function tileName(row: number, col: number): string {
    return `tile_${row}_${col}`;
}
