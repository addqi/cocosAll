import { Color, ImageAsset, SpriteFrame, Texture2D } from 'cc';
import type { UpgradeConfig } from '../upgrade/types';

/**
 * UI 共用工具
 *
 * 职责：
 *   - `getWhiteSF()` 纯代码生成 4×4 白色 SpriteFrame，UI 画底色/条/卡背景都从这里复用
 *   - `rarityToColor(rarity)` 查表返回边框颜色，消灭 switch
 *
 * 为什么放这里：
 *   PlayerHUD 有一份重复的 getWhiteSF；UpgradeOfferPanel / Victory / GameOver 也都需要。
 *   抽到公共工具后，3+ 个 UI 文件共享一个 SpriteFrame，节省显存和重复代码。
 */

let _whiteFrame: SpriteFrame | null = null;

/** 单例返回一张 4×4 全白 SpriteFrame，可被所有 UI 复用做底色 */
export function getWhiteSF(): SpriteFrame {
    if (!_whiteFrame) {
        const size = 4;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        const tex = new Texture2D();
        tex.image = new ImageAsset(canvas as unknown as HTMLCanvasElement);

        _whiteFrame = new SpriteFrame();
        _whiteFrame.texture = tex;
        _whiteFrame.packable = false;
    }
    return _whiteFrame;
}

/** 升级稀有度 → 边框颜色（查表，不 switch）*/
const RARITY_COLORS: Readonly<Record<UpgradeConfig['rarity'], Readonly<Color>>> = {
    common:    new Color(180, 180, 180, 255),
    rare:      new Color( 80, 160, 255, 255),
    epic:      new Color(170,  80, 255, 255),
    legendary: new Color(255, 200,  80, 255),
};

export function rarityToColor(rarity: UpgradeConfig['rarity']): Color {
    return RARITY_COLORS[rarity] ?? RARITY_COLORS.common;
}
