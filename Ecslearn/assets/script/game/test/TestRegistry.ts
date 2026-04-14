export interface ITestCase {
    name: string;
    run: () => void;
}

export class TestRegistry {
    private static _cases: ITestCase[] = [];

    static register(name: string, run: () => void): void {
        this._cases.push({ name, run });
    }

    static get all(): readonly ITestCase[] {
        return this._cases;
    }
}
