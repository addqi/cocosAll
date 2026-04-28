import { ImageAsset, SpriteFrame, Texture2D } from 'cc';

let _cached: SpriteFrame | null = null;

/**
 * 2×2 纯白 SpriteFrame（单例缓存）。
 *
 * 用途：纯色矩形（按钮底、进度条、卡片背景等）。配合 sizeMode=CUSTOM + color 控制外观，
 * 避免每个纯色块都要在编辑器里拖一张图集。
 */
export function getWhitePixelSF(): SpriteFrame {
    if (_cached) return _cached;

    const pixels = new Uint8Array(2 * 2 * 4).fill(255);
    const tex = new Texture2D();
    tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
    tex.image = new ImageAsset({
        _data: pixels,
        _compressed: false,
        width: 2,
        height: 2,
        format: Texture2D.PixelFormat.RGBA8888,
    });

    const sf = new SpriteFrame();
    sf.texture = tex;
    _cached = sf;
    return sf;
}
