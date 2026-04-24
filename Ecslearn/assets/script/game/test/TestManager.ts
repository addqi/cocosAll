import { _decorator, Component } from 'cc';
import { TestRegistry } from './TestRegistry';
import './allTests';

const { ccclass } = _decorator;

/**
 * 场景挂一次即可。
 * 新增测试：写文件 → TestRegistry.register → allTests.ts 加 import。
 * 不需要新建节点或挂新组件。
 */
@ccclass('TestManager')
export class TestManager extends Component {
    start() {
        // this._runAll();
    }

    private _runAll() {
        const cases = TestRegistry.all;
        if (cases.length === 0) {
            console.warn('[TestManager] 无注册的测试用例');
            return;
        }

        let pass = 0;
        let fail = 0;
        const results: string[] = [];

        console.log(
            `%c[TestManager] ══════ ${cases.length} 个测试开始 ══════`,
            'color:#4FC3F7;font-weight:bold',
        );

        for (const tc of cases) {
            try {
                tc.run();
                pass++;
                results.push(`  ✅ ${tc.name}`);
            } catch (e: any) {
                fail++;
                results.push(`  ❌ ${tc.name} — ${e?.message ?? e}`);
            }
        }

        for (const r of results) console.log(r);

        const summary = fail === 0
            ? `全部通过 ${pass}/${pass}`
            : `${pass} 通过, ${fail} 失败`;
        const color = fail === 0 ? 'color:#66BB6A' : 'color:#EF5350';
        console.log(`%c[TestManager] ══════ ${summary} ══════`, `${color};font-weight:bold`);
    }
}
