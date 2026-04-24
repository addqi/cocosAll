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

// ── 阶段 2 / 06 Step 2.10：流派选择 + 蓄力 + classIds 过滤 ──
import './testStep2_10_Input';
import './testStep2_10_ChargeCurve';
import './testStep2_10_ClassAndUpgrades';

// ── 阶段 2 / Step 2.11：升级钩子基础设施（onShoot / onTakenDamage / ProbCD / ComboCounter）──
import './testStep2_11_Hooks';

// ── 阶段 2 / Step 2.12：虚拟输入系统（手机摇杆 + 攻击按钮）──
import './testStep2_12_VirtualInput';
