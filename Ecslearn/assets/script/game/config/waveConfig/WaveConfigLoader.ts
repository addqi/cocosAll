/**
 * 波次配置加载器
 *
 * 职责：
 *   - 启动时读取 waves.json，做全量结构校验
 *   - 任一字段缺失 / enemyId 非法 → 立即抛错，错误定位到波次号
 *   - 校验通过后缓存为只读数组，运行期零 IO
 *
 * Linus 原则：
 *   数据错误必须在加载时暴露，不能拖到运行时变成"怪没刷出来但没人报错"。
 */
import { EMinionType } from '../../enemy/minion/behaviors';
import type {
    WaveConfig,
    SpawnerRule,
    SpawnTiming,
    SpawnPattern,
    EnemyBuffEntry,
} from './types';
import wavesRaw from './waves.json';

/** 合法 enemyId 集合（从 EMinionType 导出，单一事实来源）*/
const VALID_ENEMY_IDS: ReadonlySet<string> = new Set(
    Object.values(EMinionType) as string[],
);

const VALID_TIMINGS: ReadonlySet<SpawnTiming> = new Set<SpawnTiming>(['burst', 'over-time']);
const VALID_PATTERNS: ReadonlySet<SpawnPattern> = new Set<SpawnPattern>(['ring', 'random']);

let _cached: readonly WaveConfig[] | null = null;

/**
 * 读取并校验全部波次配置。
 * 首次调用做校验，后续调用直接返回缓存。
 * 校验失败抛错，不返回半成品。
 */
export function loadAllWaves(): readonly WaveConfig[] {
    if (_cached) return _cached;

    if (!Array.isArray(wavesRaw)) {
        throw new Error('[WaveConfigLoader] waves.json 根节点必须是数组');
    }
    if (wavesRaw.length === 0) {
        throw new Error('[WaveConfigLoader] waves.json 至少需要 1 条波次');
    }

    const result: WaveConfig[] = [];
    for (let i = 0; i < wavesRaw.length; i++) {
        result.push(_validateWave(wavesRaw[i], i));
    }

    // 校验 index 连续升序（从 1 开始）
    for (let i = 0; i < result.length; i++) {
        if (result[i].index !== i + 1) {
            throw new Error(
                `[WaveConfigLoader] wave[${i}].index=${result[i].index}，期望 ${i + 1}（波次必须从 1 开始连续升序）`,
            );
        }
    }

    _cached = result;
    return _cached;
}

/** 清空缓存 —— 只给测试用 */
export function _resetWaveCache(): void {
    _cached = null;
}

// ─── 校验工具：每一条失败都带波次号与字段路径 ───────────

function _validateWave(raw: unknown, i: number): WaveConfig {
    if (!raw || typeof raw !== 'object') {
        throw new Error(`[WaveConfigLoader] wave[${i}] 不是对象`);
    }
    const r = raw as Record<string, unknown>;

    _requireNumber(r, 'index', `wave[${i}]`);
    _requireNumber(r, 'duration', `wave[${i}]`);
    if ((r.duration as number) <= 0) {
        throw new Error(`[WaveConfigLoader] wave[${i}].duration 必须 > 0，当前 ${r.duration}`);
    }
    if (!Array.isArray(r.spawners) || r.spawners.length === 0) {
        throw new Error(`[WaveConfigLoader] wave[${i}].spawners 必须是非空数组`);
    }

    const spawners: SpawnerRule[] = r.spawners.map((raw, j) => _validateSpawner(raw, i, j));
    const enemyBuffs = r.enemyBuffs !== undefined
        ? _validateEnemyBuffs(r.enemyBuffs, i)
        : undefined;

    return {
        index: r.index as number,
        duration: r.duration as number,
        spawners,
        enemyBuffs,
    };
}

function _validateSpawner(raw: unknown, wi: number, si: number): SpawnerRule {
    if (!raw || typeof raw !== 'object') {
        throw new Error(`[WaveConfigLoader] wave[${wi}].spawners[${si}] 不是对象`);
    }
    const r = raw as Record<string, unknown>;
    const path = `wave[${wi}].spawners[${si}]`;

    _requireString(r, 'enemyId', path);
    _requireNumber(r, 'count', path);
    _requireString(r, 'timing', path);
    _requireString(r, 'pattern', path);

    const enemyId = r.enemyId as string;
    if (!VALID_ENEMY_IDS.has(enemyId)) {
        throw new Error(
            `[WaveConfigLoader] ${path}.enemyId "${enemyId}" 未在 EMinionType 注册。合法值: [${[...VALID_ENEMY_IDS].join(', ')}]`,
        );
    }

    const count = r.count as number;
    if (count <= 0 || !Number.isFinite(count)) {
        throw new Error(`[WaveConfigLoader] ${path}.count 必须是正数，当前 ${count}`);
    }

    const timing = r.timing as SpawnTiming;
    if (!VALID_TIMINGS.has(timing)) {
        throw new Error(
            `[WaveConfigLoader] ${path}.timing "${timing}" 非法。合法值: [${[...VALID_TIMINGS].join(', ')}]`,
        );
    }

    const pattern = r.pattern as SpawnPattern;
    if (!VALID_PATTERNS.has(pattern)) {
        throw new Error(
            `[WaveConfigLoader] ${path}.pattern "${pattern}" 非法。合法值: [${[...VALID_PATTERNS].join(', ')}]`,
        );
    }

    let ringRadius: number | undefined;
    if (pattern === 'ring') {
        if (typeof r.ringRadius !== 'number' || r.ringRadius <= 0) {
            throw new Error(
                `[WaveConfigLoader] ${path}.ringRadius 在 pattern=ring 时必填且必须 > 0，当前 ${r.ringRadius}`,
            );
        }
        ringRadius = r.ringRadius;
    }

    return { enemyId, count, timing, pattern, ringRadius };
}

function _validateEnemyBuffs(raw: unknown, wi: number): readonly EnemyBuffEntry[] {
    if (!Array.isArray(raw)) {
        throw new Error(`[WaveConfigLoader] wave[${wi}].enemyBuffs 必须是数组`);
    }
    return raw.map((r, j) => {
        if (!r || typeof r !== 'object') {
            throw new Error(`[WaveConfigLoader] wave[${wi}].enemyBuffs[${j}] 不是对象`);
        }
        const o = r as Record<string, unknown>;
        _requireNumber(o, 'buffId', `wave[${wi}].enemyBuffs[${j}]`);
        return {
            buffId: o.buffId as number,
            stack: typeof o.stack === 'number' ? o.stack : undefined,
        };
    });
}

function _requireNumber(o: Record<string, unknown>, key: string, path: string): void {
    if (typeof o[key] !== 'number' || !Number.isFinite(o[key] as number)) {
        throw new Error(`[WaveConfigLoader] ${path} missing required field: ${key} (number)`);
    }
}

function _requireString(o: Record<string, unknown>, key: string, path: string): void {
    if (typeof o[key] !== 'string' || (o[key] as string).length === 0) {
        throw new Error(`[WaveConfigLoader] ${path} missing required field: ${key} (string)`);
    }
}

// ─── 测试专用：从任意对象做校验（不走 json 单例缓存）────
/** @internal 只给单测用 */
export function _validateWaveRawForTest(raw: unknown, i: number): WaveConfig {
    return _validateWave(raw, i);
}
