import { Vec3 } from 'cc';

/**
 * 二次贝塞尔曲线  B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
 */
export class QuadBezier {
    constructor(
        public readonly p0: Readonly<Vec3>,
        public readonly p1: Readonly<Vec3>,
        public readonly p2: Readonly<Vec3>,
    ) {}

    getPoint(t: number, out: Vec3): Vec3 {
        const u = 1 - t;
        out.x = u * u * this.p0.x + 2 * u * t * this.p1.x + t * t * this.p2.x;
        out.y = u * u * this.p0.y + 2 * u * t * this.p1.y + t * t * this.p2.y;
        out.z = u * u * this.p0.z + 2 * u * t * this.p1.z + t * t * this.p2.z;
        return out;
    }

    getTangent(t: number, out: Vec3): Vec3 {
        const u = 1 - t;
        out.x = 2 * (u * (this.p1.x - this.p0.x) + t * (this.p2.x - this.p1.x));
        out.y = 2 * (u * (this.p1.y - this.p0.y) + t * (this.p2.y - this.p1.y));
        out.z = 2 * (u * (this.p1.z - this.p0.z) + t * (this.p2.z - this.p1.z));
        return out;
    }

    /**
     * 两端点 + 拱高 → 二次贝塞尔弧线
     *
     * arcHeight 沿 start→end 方向的 2D 左法线（CCW 90°）偏移控制点。
     * 实用规则：传 `arcHeight * facing` 可保证弧线始终向上拱起。
     */
    static createArc(start: Readonly<Vec3>, end: Readonly<Vec3>, arcHeight: number): QuadBezier {
        const mx = (start.x + end.x) * 0.5;
        const my = (start.y + end.y) * 0.5;
        const mz = (start.z + end.z) * 0.5;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;

        return new QuadBezier(
            new Vec3(start.x, start.y, start.z),
            new Vec3(mx + (-dy / len) * arcHeight, my + (dx / len) * arcHeight, mz),
            new Vec3(end.x, end.y, end.z),
        );
    }
}

/**
 * 三次贝塞尔曲线  B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
 */
export class CubicBezier {
    constructor(
        public readonly p0: Readonly<Vec3>,
        public readonly p1: Readonly<Vec3>,
        public readonly p2: Readonly<Vec3>,
        public readonly p3: Readonly<Vec3>,
    ) {}

    getPoint(t: number, out: Vec3): Vec3 {
        const u = 1 - t;
        const uu = u * u;
        const tt = t * t;
        out.x = uu * u * this.p0.x + 3 * uu * t * this.p1.x + 3 * u * tt * this.p2.x + tt * t * this.p3.x;
        out.y = uu * u * this.p0.y + 3 * uu * t * this.p1.y + 3 * u * tt * this.p2.y + tt * t * this.p3.y;
        out.z = uu * u * this.p0.z + 3 * uu * t * this.p1.z + 3 * u * tt * this.p2.z + tt * t * this.p3.z;
        return out;
    }

    getTangent(t: number, out: Vec3): Vec3 {
        const u = 1 - t;
        const uu = u * u;
        const tt = t * t;
        out.x = 3 * (uu * (this.p1.x - this.p0.x) + 2 * u * t * (this.p2.x - this.p1.x) + tt * (this.p3.x - this.p2.x));
        out.y = 3 * (uu * (this.p1.y - this.p0.y) + 2 * u * t * (this.p2.y - this.p1.y) + tt * (this.p3.y - this.p2.y));
        out.z = 3 * (uu * (this.p1.z - this.p0.z) + 2 * u * t * (this.p2.z - this.p1.z) + tt * (this.p3.z - this.p2.z));
        return out;
    }
}
