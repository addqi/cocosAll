import { BoardRuntimeContext } from '../game/BoardRuntimeContext';
import { StorageService } from './StorageService';

/**
 * 冷启动恢复：读取本地存档，重建 paintMap + 像素缓冲 + 进度计数。
 *
 * 调用时机：BoardBootstrap.run() 创建 ctx 之后、refreshDetailVisibility 之前。
 */
export class PaintRestore {
    static restore(ctx: BoardRuntimeContext): void {
        const sm = ctx.saveManager;
        const history = StorageService.loadPaintRecord(sm.levelId);
        if (!history.length) return;

        const { boardData, brushLayer, digitLayer } = ctx;
        const cols = boardData.gridCols;
        const total = cols * boardData.gridRows;
        const palette = boardData.palette;
        const brushBuf = brushLayer.pixelBuffer;
        const digitBuf = digitLayer.pixelBuffer;

        for (let i = 0; i < history.length; i++) {
            const { row, col, brushIndex } = history[i];
            const idx = row * cols + col;
            if (idx < 0 || idx >= total) continue;
            if (brushIndex < 0 || brushIndex >= palette.length) continue;

            sm.paintMap[idx] = brushIndex;
            sm.record.record(row, col, brushIndex);

            const hex = parseInt(palette[brushIndex].slice(1), 16);
            brushBuf.setPixel(row, col, (hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff, 255);
            digitBuf.setPixel(row, col, 0, 0, 0, 0);

            if (sm.brushFilledCounts[brushIndex] < sm.brushTotalCounts[brushIndex]) {
                sm.brushFilledCounts[brushIndex]++;
            }
        }

        brushLayer.flush();
        digitLayer.flush();
    }
}
