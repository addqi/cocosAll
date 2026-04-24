export interface ITestCase {
    name: string;
    run: () => void;
}

export class TestRegistry {
    private static _cases: ITestCase[] = [];

    /** 单参数版：name 是完整描述字符串 */
    static register(name: string, run: () => void): void;
    /** 三维版：自动拼成 "suite / case desc" 的可读名字 */
    static register(suite: string, caseName: string, desc: string, run: () => void): void;
    static register(
        a: string,
        b: string | (() => void),
        c?: string,
        d?: () => void,
    ): void {
        if (typeof b === 'function') {
            this._cases.push({ name: a, run: b });
        } else {
            const name = c ? `${a} / ${b} ${c}` : `${a} / ${b}`;
            this._cases.push({ name, run: d! });
        }
    }

    static get all(): readonly ITestCase[] {
        return this._cases;
    }
}
