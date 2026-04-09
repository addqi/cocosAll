import { ImageAsset, SpriteFrame, Texture2D } from 'cc';

let _cached: SpriteFrame | null = null;

/**
 * 等价于 G15 whitePixel 贴图资源：2x2 纯白 Texture2D → SpriteFrame（单例缓存）。
 * 用于所有需要纯色矩形的 Sprite（设 sizeMode=CUSTOM + color 即可控制颜色/透明度）。
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
