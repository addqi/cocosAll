import { IRed } from './IRed';
import { Signal } from './Signal';

export abstract class RedGroup implements IRed {
    protected abstract children: IRed[];
    /**判断是否 */
    calcRed(): boolean {
        for (let i = this.children.length - 1; i >= 0; --i) {
            if (this.children[i].calcRed()) return true;
        }
        return false;
    }
    calcNumber(): number {
        let number = 0;
        for (let i = this.children.length - 1; i >= 0; --i) {
            number += this.children[i].calcRed()?1:0;
        }
        return number;
    }
    getSignals(out: Signal<any>[]): void {
        for (let i = this.children.length - 1; i >= 0; --i) {
            this.children[i].getSignals(out);
        }
    }
}