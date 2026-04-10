import { _decorator, Component, Sprite, Node, Label, Color, UITransform } from 'cc';
import { EnemyProperty } from './EnemyProperty';
import { EnemyCombat } from './EnemyCombat';
import { EnemyBuffOwner } from './EnemyBuffOwner';
import { EntityBuffMgr } from '../entity/EntityBuffMgr';
import { EnemyAnimation } from './anim/EnemyAnimation';
import { enemyConfig } from './config/enemyConfig';

const { ccclass } = _decorator;

/**
 * 节点结构：
 * Enemy (EnemyControl)
 * ├── Body (Sprite + EnemyAnimation) ← 翻转在这里
 * ├── GroundFX                       ← 脚底特效预留
 * └── UIAnchor                       ← 永不翻转
 *     └── HpLabel
 */
@ccclass('EnemyControl')
export class EnemyControl extends Component {
    private static _all: EnemyControl[] = [];
    static get allEnemies(): readonly EnemyControl[] { return this._all; }

    private _body: Node = null!;
    private _uiAnchor: Node = null!;

    private _prop!: EnemyProperty;
    private _combat!: EnemyCombat;
    private _buffOwner!: EnemyBuffOwner;
    private _buffMgr!: EntityBuffMgr;
    private _anim!: EnemyAnimation;
    private _hpLabel!: Label;

    get combat(): EnemyCombat { return this._combat; }
    get prop(): EnemyProperty { return this._prop; }
    get buffOwner(): EnemyBuffOwner { return this._buffOwner; }
    get buffMgr(): EntityBuffMgr { return this._buffMgr; }
    get anim(): EnemyAnimation { return this._anim; }
    get body(): Node { return this._body; }

    onLoad() {
        this._body = new Node('Body');
        this.node.addChild(this._body);
        this._body.addComponent(Sprite);
        this._anim = this._body.addComponent(EnemyAnimation);

        new Node('GroundFX').setParent(this.node);

        this._uiAnchor = new Node('UIAnchor');
        this.node.addChild(this._uiAnchor);

        this._prop = new EnemyProperty();
        this._combat = new EnemyCombat(this._prop);
        this._buffOwner = new EnemyBuffOwner(this._prop, `enemy-${this.node.name}`);
        this._buffMgr = new EntityBuffMgr(this._prop);

        this._createHpLabel();
        EnemyControl._all.push(this);
    }

    private _createHpLabel() {
        const labelNode = new Node('HpLabel');
        this._uiAnchor.addChild(labelNode);
        labelNode.setPosition(0, enemyConfig.displayHeight / 2 + 15, 0);

        const ut = labelNode.addComponent(UITransform);
        ut.setContentSize(200, 30);

        this._hpLabel = labelNode.addComponent(Label);
        this._hpLabel.fontSize = 22;
        this._hpLabel.lineHeight = 26;
        this._hpLabel.color = new Color(255, 60, 60, 255);
        this._hpLabel.enableOutline = true;
        this._hpLabel.outlineColor = new Color(0, 0, 0, 200);
        this._hpLabel.outlineWidth = 2;
    }

    update(dt: number) {
        this._buffMgr.update(dt);
        this._hpLabel.string = `${this._combat.currentHp} / ${this._combat.maxHp}`;
    }

    onDestroy() {
        const i = EnemyControl._all.indexOf(this);
        if (i >= 0) EnemyControl._all.splice(i, 1);
    }
}
