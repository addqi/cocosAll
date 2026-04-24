/**
 * 单测入口：只保留当前阶段需要跑的用例。
 *
 * 历史测试（阶段 1 / Step 1-5 / 金币系统 04）在通过后已删除源码，
 * 不再打进 bundle，避免污染本阶段的测试报告。
 *
 * 新增测试：
 *   1. 在 game/test/ 下写 testStepX_Y.ts，内部 TestRegistry.register(...)
 *   2. 在本文件加一行 import（Cocos 会把 ./test/ 下所有 .ts 扫进 bundle，
 *      但只有被 import 的才执行其顶层副作用）
 *   3. 过期测试请"删源码"而非"注释 import"—— Cocos 的副作用扫描会把文件
 *      存在就执行，注释 import 挡不住（TestRegistry 会被填垃圾用例）
 */

// ── 阶段 2 / 05 Step 2.1: 波次配置 schema 与 loader ──
import './testStep2_1_WaveConfig';

// ── 阶段 2 / 05 Step 2.1c: 图片资源 JSON 配置 ──
import './testStep2_1c_SpriteAssetConfig';

// ── 阶段 2 / 05 Step 2.2: LevelRun 本局状态容器 ──
import './testStep2_2_LevelRun';

// ── 阶段 2 / 05 Step 2.3: WaveScheduler 刷怪调度（纯逻辑） ──
import './testStep2_3_WaveDirector';

// ── 阶段 2 / 05 Step 2.4: LevelPhaseTransition 清场判定（纯函数） ──
import './testStep2_4_PhaseTransition';
