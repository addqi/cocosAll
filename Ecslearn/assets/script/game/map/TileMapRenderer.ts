import { _decorator, Component, Node, Sprite, SpriteFrame, Texture2D, UITransform, Size } from 'cc';
import { ResourceMgr } from '../../baseSystem/resource';
import { MapGenerator } from './MapGenerator';
import {
    TILE_SIZE, TILE_DIR,
    SURFACE_MAP, CLIFF_DEPTH,
    cliffTile, tileName,
} from './terrainTileConfig';

const { ccclass, property } = _decorator;

const TILESET_ROWS = 6;
const TILESET_COLS = 9;

@ccclass('TileMapRenderer')
export class TileMapRenderer extends Component {

    @property({ tooltip: '地图列数' })
    mapCols = 24;

    @property({ tooltip: '地图行数（含上下各 1 行空白边框）' })
    mapRows = 18;

    private _grid: number[][] = [];
    private _frames = new Map<string, SpriteFrame>();
    private _surfaceLayer!: Node;
    private _cliffLayer!: Node;

    get grid(): number[][] { return this._grid; }
    get tileSize(): number { return TILE_SIZE; }
    get worldWidth(): number  { return this.mapCols * TILE_SIZE; }
    get worldHeight(): number { return (this.mapRows + CLIFF_DEPTH) * TILE_SIZE; }

    start() {
        this._buildTileFrames();

        this._grid = MapGenerator.generateArena(this.mapCols, this.mapRows);

        this._cliffLayer = new Node('CliffLayer');
        this._surfaceLayer = new Node('SurfaceLayer');
        this.node.addChild(this._cliffLayer);
        this.node.addChild(this._surfaceLayer);

        this._renderCliffs();
        this._renderSurface();
    }

    gridToWorld(row: number, col: number): { x: number; y: number } {
        const halfW = this.mapCols * TILE_SIZE * 0.5;
        const halfH = (this.mapRows + CLIFF_DEPTH) * TILE_SIZE * 0.5;
        return {
            x: col * TILE_SIZE + TILE_SIZE * 0.5 - halfW,
            y: -(row * TILE_SIZE + TILE_SIZE * 0.5 - halfH),
        };
    }

    worldToGrid(wx: number, wy: number): { row: number; col: number } {
        const halfW = this.mapCols * TILE_SIZE * 0.5;
        const halfH = (this.mapRows + CLIFF_DEPTH) * TILE_SIZE * 0.5;
        return {
            col: Math.floor((wx + halfW) / TILE_SIZE),
            row: Math.floor((-wy + halfH) / TILE_SIZE),
        };
    }

    isWalkable(row: number, col: number): boolean {
        if (row < 0 || row >= this.mapRows || col < 0 || col >= this.mapCols) return false;
        return this._grid[row][col] === 1;
    }

    /* ── tile loading ── */

    /**
     * 从已预加载的 Texture 缓存同步建 SpriteFrame。
     * 纹理由 ResourcePreloader 统一加载（collectTerrainTiles），本处只做转换。
     */
    private _buildTileFrames(): void {
        let missing = 0;
        for (let r = 0; r < TILESET_ROWS; r++) {
            for (let c = 0; c < TILESET_COLS; c++) {
                const name = tileName(r, c);
                const tex = ResourceMgr.inst.get<Texture2D>(`${TILE_DIR}/${name}/texture`);
                if (!tex) { missing++; continue; }
                const sf = new SpriteFrame();
                sf.texture = tex;
                this._frames.set(name, sf);
            }
        }
        if (missing > 0) {
            console.error(
                `[TileMapRenderer] ${missing} 张瓦片纹理未预加载。请确认 ResourcePreloader.collectTerrainTiles 登记了 ${TILE_DIR}/`,
            );
        }
    }

    /* ── rendering ── */

    private _renderSurface(): void {
        const g = this._grid;
        for (let r = 0; r < g.length; r++) {
            for (let c = 0; c < g[0].length; c++) {
                if (!g[r][c]) continue;
                const mask = MapGenerator.calcBitmask(g, r, c);
                const [tr, tc] = SURFACE_MAP[mask];
                this._placeTile(this._surfaceLayer, r, c, tileName(tr, tc));
            }
        }
    }

    private _renderCliffs(): void {
        const g = this._grid;
        const rows = g.length, cols = g[0].length;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!g[r][c]) continue;
                if (r < rows - 1 && g[r + 1][c]) continue;

                const hasL = c > 0 && g[r][c - 1] === 1;
                const hasR = c < cols - 1 && g[r][c + 1] === 1;

                for (let d = 0; d < CLIFF_DEPTH; d++) {
                    const cr = r + 1 + d;
                    if (cr < rows && g[cr][c]) break;

                    const [tr, tc] = cliffTile(d, hasL, hasR, r * cols + c + d);
                    this._placeTile(this._cliffLayer, cr, c, tileName(tr, tc));
                }
            }
        }
    }

    private _placeTile(parent: Node, row: number, col: number, name: string): void {
        const frame = this._frames.get(name);
        if (!frame) return;

        const nd = new Node(name);
        const sp = nd.addComponent(Sprite);
        sp.spriteFrame = frame;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;

        nd.getComponent(UITransform)!.setContentSize(new Size(TILE_SIZE, TILE_SIZE));

        const pos = this.gridToWorld(row, col);
        nd.setPosition(pos.x, pos.y, 0);

        parent.addChild(nd);
    }
}
