/**
 * 单测入口：只保留当前阶段需要跑的用例。
 *
 * 历史测试在通过后已删除源码（见 Linus 原则）。
 *
 * 新增测试：
 *   1. 在 game/test/ 下写 testStepX_Y.ts，内部 TestRegistry.register(...)
 *   2. 在本文件加一行 import
 *   3. 过期测试请"删源码"，Cocos 的副作用扫描会让注释 import 挡不住
 */

// ── 阶段 2 / 05 Step 2.7: UpgradeOfferSystem 抽卡器 ──
import './testStep2_7_UpgradeOffer';

// ── 阶段 2 / 05 Step 2.8 + 2.9: 升级 UI 事件流 + LevelManager 粘合 ──
import './testStep2_8_9_UpgradeFlow';
