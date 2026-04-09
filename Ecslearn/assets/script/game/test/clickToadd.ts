import { _decorator, Component, Label } from 'cc';
import { PlayerProperty } from '../player/playerProperty';
import { PlayerBuffOwner } from '../player/playerBuffperty';
import { EntityBuffMgr } from '../entity/EntityBuffMgr';
import { EPropertyAddType } from '../../baseSystem/properties';
import { EPropertyId, EPropertyConfigId } from '../config/enum/propertyEnum';
import type { ModifierHandle } from '../entity/EntityPropertyMgr';
import type { BuffData } from '../../baseSystem/buff';
import addHpBuffConfig from '../config/buffConfig/addHpBuff.json';

const { ccclass, property } = _decorator;

@ccclass('ClickToAdd')
export class ClickToAdd extends Component {
    private playerProperty: PlayerProperty;
    private playerBuffOwner: PlayerBuffOwner;
    private playerBuffMgr: EntityBuffMgr;

    @property(Label)
    private Label: Label;

    /** 用于直接修饰器操作的句柄栈（clickToAddMul / clickToRemove 使用） */
    private handleStack: ModifierHandle[] = [];

    protected onLoad(): void {
        this.playerProperty = new PlayerProperty();
        this.playerBuffOwner = new PlayerBuffOwner(this.playerProperty);
        this.playerBuffMgr = new EntityBuffMgr(this.playerProperty);
    }

    /** 通过 BuffMgr 添加生命加成 Buff（每层 +100 HP，最多 5 层） */
    clickToAdd() {
        const runtime = this.playerBuffMgr.addBuff(
            addHpBuffConfig as BuffData,
            this.playerBuffOwner
        );
        console.log(
            `[addBuff] "${addHpBuffConfig.name}" stack=${runtime.stack}/${addHpBuffConfig.maxStack}`,
            '| Hp =', this.playerProperty.getValue(EPropertyId.Hp)
        );
    }

    /** 直接修饰器：给 Hp 加乘法加成 +50% */
    clickToAddMul() {
        const handle = this.playerProperty.add(
            EPropertyId.Hp,
            EPropertyConfigId.MulBuff,
            EPropertyAddType.Mul,
            0.5
        );
        this.handleStack.push(handle);
        console.log('add MulBuff +50%, handle=', handle, '| Hp =', this.playerProperty.getValue(EPropertyId.Hp));
    }

    /** 移除上一次 clickToAddMul 添加的修饰器 */
    clickToRemove() {
        const handle = this.handleStack.pop();
        if (handle !== undefined) {
            this.playerProperty.remove(handle);
            console.log('remove handle=', handle, '| Hp =', this.playerProperty.getValue(EPropertyId.Hp));
        } else {
            console.warn('没有可移除的修饰器');
        }
    }

    /** 通过 BuffMgr 移除生命加成 Buff */
    clickToRemoveBuff() {
        const removed = this.playerBuffMgr.removeBuff(addHpBuffConfig.id);
        console.log(
            removed
                ? `[removeBuff] "${addHpBuffConfig.name}" 已移除`
                : `[removeBuff] Buff 不存在`,
            '| Hp =', this.playerProperty.getValue(EPropertyId.Hp)
        );
    }

    protected update(dt: number): void {
        this.playerBuffMgr.update(dt);
        this.Label.string = this.playerProperty.getValue(EPropertyId.Hp).toString();
    }
}
