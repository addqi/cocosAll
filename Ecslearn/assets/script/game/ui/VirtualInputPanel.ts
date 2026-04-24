import {
    _decorator, Component, Node, Color, Label, Sprite, SpriteFrame, Texture2D,
    UITransform, UIOpacity, Widget, Size, Vec2, view,
    input, Input, EventTouch,
} from 'cc';
import { ResourceMgr } from '../../baseSystem/resource';
import { PlayerControl } from '../player/PlayerControl';

const { ccclass } = _decorator;

// ─── 布局常数 ─────────────────────────────────────────
const JOYSTICK_BG_SIZE   = 200;
const JOYSTICK_KNOB_SIZE = 100;
const ATTACK_BTN_SIZE    = 200;
const ATTACK_LABEL_SIZE  = 56;
const ELEMENT_ALPHA      = 76;          // 0.3 × 255 ≈ 76
const ATTACK_LABEL_ALPHA = 230;         // 文字基本不透明，便于看清

// 位置策略：摇杆中心在屏幕 (W/4, H/4)，攻击按钮中心在 (3W/4, H/4)
// 即左右下角各离屏中心 1/4 屏宽，高度为屏幕 1/4 高 —— 比贴边 80px 更人体工程
const POS_X_FACTOR_LEFT  = 0.25;        // 摇杆中心 X = W * 0.25
const POS_X_FACTOR_RIGHT = 0.75;        // 攻击按钮中心 X = W * 0.75
const POS_Y_FACTOR       = 0.25;        // 两者中心 Y = H * 0.25

// ─── 行为参数 ─────────────────────────────────────────
const JOYSTICK_DEAD_ZONE   = 20;        // px
const JOYSTICK_MAX_RADIUS  = 100;       // px = 底盘半径
const JOYSTICK_TOUCH_SCOPE = 160;       // px，触摸落点距摇杆中心多远算"摇杆"（比图大一圈）
const ATTACK_TOUCH_SCOPE   = 160;       // 攻击按钮触发响应半径

// ─── 资源 ────────────────────────────────────────────
const COLOR_DI_TEX_PATH = 'gameplay_pic_colordi/texture';

/**
 * 摇杆输入结果
 */
export interface JoystickOutput {
    /** 归一化 X，[-1, 1] */
    x: number;
    /** 归一化 Y，[-1, 1] */
    y: number;
    /** 是否产生有效输入（死区内 = false）*/
    active: boolean;
}

/**
 * 纯函数 —— 给定触摸点和摇杆中心，输出归一化方向。
 *
 * 规则：
 *   1. 距离 < deadZone：返 (0, 0, false)
 *   2. 距离 ≥ deadZone：归一化为 (dx/maxRadius, dy/maxRadius)
 *   3. 超出 maxRadius：按方向 clamp 到 1.0（绝对值）
 *
 * 单测覆盖：testStep2_12_VirtualInput.ts A 组
 */
export function computeJoystickOutput(
    touchX: number, touchY: number,
    centerX: number, centerY: number,
    deadZone: number, maxRadius: number,
): JoystickOutput {
    const dx = touchX - centerX;
    const dy = touchY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < deadZone) return { x: 0, y: 0, active: false };

    if (dist <= maxRadius) {
        return { x: dx / maxRadius, y: dy / maxRadius, active: true };
    }
    // 超出最大半径：方向不变，幅值 clamp 到 1
    return { x: dx / dist, y: dy / dist, active: true };
}

/**
 * 计算摇杆头节点的本地坐标偏移（基于触摸点 + 摇杆中心）。
 * 与 computeJoystickOutput 共用一套数学，但返回的是"要把 knob 放在哪"。
 *
 * 节点本地坐标 = 触摸偏移 clamp 在 maxRadius 内（视觉上 knob 不出底盘）
 */
export function computeKnobLocalPos(
    touchX: number, touchY: number,
    centerX: number, centerY: number,
    maxRadius: number,
): { x: number; y: number } {
    const dx = touchX - centerX;
    const dy = touchY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= maxRadius) return { x: dx, y: dy };
    return { x: (dx / dist) * maxRadius, y: (dy / dist) * maxRadius };
}

/**
 * 手机虚拟输入面板（摇杆 + 攻击按钮）。
 *
 * 设计：
 *   - 摇杆固定左下，攻击按钮固定右下；始终显示
 *   - 全局 input 事件 + touchId 路由：天然支持多点（边走边打）
 *   - 数据出口：写到 PlayerControl.rawInput 的 virtualMoveX/Y/Active 和
 *     mouseDown/Held/Up（与现有键鼠走同一管线，上层零感知）
 *
 * Linus 式好品味：
 *   - 不新建 ECS 系统，复用现有 RawInputComp/ActionMapSystem
 *   - 摇杆数学抽为纯函数 computeJoystickOutput / computeKnobLocalPos，可单测
 *   - 多点用 touchId Map，不维护"谁先按"的状态机
 */
@ccclass('VirtualInputPanel')
export class VirtualInputPanel extends Component {

    private _joystickAreaNode!: Node;     // 容器节点（Widget 锚定左下）
    private _joystickBg!: Node;
    private _joystickKnob!: Node;

    private _attackAreaNode!: Node;       // 容器节点（Widget 锚定右下）
    private _attackBtn!: Node;

    private _joystickTouchId: number | null = null;
    private _attackTouchId: number | null = null;

    onLoad(): void {
        this._build();
        input.on(Input.EventType.TOUCH_START,  this._onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE,   this._onTouchMove,  this);
        input.on(Input.EventType.TOUCH_END,    this._onTouchEnd,   this);
        input.on(Input.EventType.TOUCH_CANCEL, this._onTouchEnd,   this);
    }

    onDestroy(): void {
        input.off(Input.EventType.TOUCH_START,  this._onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE,   this._onTouchMove,  this);
        input.off(Input.EventType.TOUCH_END,    this._onTouchEnd,   this);
        input.off(Input.EventType.TOUCH_CANCEL, this._onTouchEnd,   this);
        this._releaseJoystick();
        this._releaseAttack();
    }

    // ─── 触摸事件路由 ─────────────────────────────────

    private _onTouchStart = (e: EventTouch): void => {
        const t = e.touch;
        if (!t) return;
        const tid = t.getID();
        const loc = t.getLocation();   // 屏幕坐标，左下原点

        // 摇杆区
        if (this._joystickTouchId === null) {
            const c = this._getJoystickCenterScreen();
            if (this._inRange(loc, c, JOYSTICK_TOUCH_SCOPE)) {
                this._joystickTouchId = tid;
                this._updateJoystickByTouch(loc);
                return;
            }
        }
        // 攻击按钮
        if (this._attackTouchId === null) {
            const c = this._getAttackCenterScreen();
            if (this._inRange(loc, c, ATTACK_TOUCH_SCOPE)) {
                this._attackTouchId = tid;
                this._pressAttack();
            }
        }
    };

    private _onTouchMove = (e: EventTouch): void => {
        const t = e.touch;
        if (!t) return;
        const tid = t.getID();
        if (tid === this._joystickTouchId) {
            this._updateJoystickByTouch(t.getLocation());
        }
        // 攻击按钮 MOVE 不需处理（mouseHeld 一直 true 直到 END）
    };

    private _onTouchEnd = (e: EventTouch): void => {
        const t = e.touch;
        if (!t) return;
        const tid = t.getID();
        if (tid === this._joystickTouchId) {
            this._joystickTouchId = null;
            this._releaseJoystick();
        }
        if (tid === this._attackTouchId) {
            this._attackTouchId = null;
            this._releaseAttack();
        }
    };

    // ─── 摇杆状态写入 ────────────────────────────────

    private _updateJoystickByTouch(touchLoc: Vec2): void {
        const center = this._getJoystickCenterScreen();
        const out = computeJoystickOutput(
            touchLoc.x, touchLoc.y, center.x, center.y,
            JOYSTICK_DEAD_ZONE, JOYSTICK_MAX_RADIUS,
        );
        const knobLocal = computeKnobLocalPos(
            touchLoc.x, touchLoc.y, center.x, center.y, JOYSTICK_MAX_RADIUS,
        );
        this._joystickKnob.setPosition(knobLocal.x, knobLocal.y, 0);

        const raw = PlayerControl.instance?.rawInput;
        if (!raw) return;
        raw.virtualMoveX = out.x;
        raw.virtualMoveY = out.y;
        raw.virtualMoveActive = out.active;
    }

    private _releaseJoystick(): void {
        if (this._joystickKnob) this._joystickKnob.setPosition(0, 0, 0);
        const raw = PlayerControl.instance?.rawInput;
        if (!raw) return;
        raw.virtualMoveX = 0;
        raw.virtualMoveY = 0;
        raw.virtualMoveActive = false;
    }

    private _pressAttack(): void {
        const raw = PlayerControl.instance?.rawInput;
        if (!raw) return;
        // 与鼠标语义对齐：mouseDown 是单帧脉冲，下一帧由 RawInputSystem.update 自动清；
        // 我们这里直接置 true，由 RawInputSystem 把它传到 mouseDown/Held。
        // 但 RawInputSystem 是从其内部 frameMouseDown 写入的——所以最简方案是手动 set
        // 三个字段，虚拟输入路径完全覆盖（RawInputSystem 的鼠标也会在 update 时写，二者 OR）。
        // 这里直接置 true，下一帧若仍按住，AttackButton 不会再触发 _pressAttack，
        // 但 mouseDown 会被 RawInputSystem.update 重置 —— 所以我们靠 mouseHeld 保持按住状态。
        raw.mouseDown = true;
        raw.mouseHeld = true;
    }

    private _releaseAttack(): void {
        const raw = PlayerControl.instance?.rawInput;
        if (!raw) return;
        raw.mouseHeld = false;
        raw.mouseUp = true;
    }

    // ─── 工具 ──────────────────────────────────────────

    private _inRange(p: Vec2, c: Vec2, radius: number): boolean {
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        return dx * dx + dy * dy <= radius * radius;
    }

    /** 摇杆中心的屏幕坐标（左下角原点）—— 屏幕宽 1/4、高 1/4 处 */
    private _getJoystickCenterScreen(): Vec2 {
        const v = view.getVisibleSize();
        return new Vec2(v.width * POS_X_FACTOR_LEFT, v.height * POS_Y_FACTOR);
    }

    /** 攻击按钮中心屏幕坐标（左下原点）—— 屏幕宽 3/4、高 1/4 处 */
    private _getAttackCenterScreen(): Vec2 {
        const v = view.getVisibleSize();
        return new Vec2(v.width * POS_X_FACTOR_RIGHT, v.height * POS_Y_FACTOR);
    }

    // ─── 节点构建 ─────────────────────────────────────

    private _build(): void {
        // 自身做全屏 root
        const widget = this.node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = true;
        widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        const sf = this._getColorDiSpriteFrame();

        this._buildJoystick(sf);
        this._buildAttackButton(sf);
    }

    private _buildJoystick(sf: SpriteFrame | null): void {
        const area = new Node('JoystickArea');
        this.node.addChild(area);
        const ut = area.addComponent(UITransform);
        ut.setContentSize(JOYSTICK_BG_SIZE, JOYSTICK_BG_SIZE);
        // Widget 距左/下：让节点中心落在 (W/4, H/4)；中心点 = left + size/2，所以 left = W/4 - size/2
        const v = view.getVisibleSize();
        const w = area.addComponent(Widget);
        w.isAlignLeft   = true;
        w.isAlignBottom = true;
        w.left   = v.width  * POS_X_FACTOR_LEFT - JOYSTICK_BG_SIZE / 2;
        w.bottom = v.height * POS_Y_FACTOR     - JOYSTICK_BG_SIZE / 2;
        this._joystickAreaNode = area;

        const bg = new Node('Bg');
        area.addChild(bg);
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(JOYSTICK_BG_SIZE, JOYSTICK_BG_SIZE);
        const bgSp = bg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        if (sf) bgSp.spriteFrame = sf;
        const bgOpa = bg.addComponent(UIOpacity);
        bgOpa.opacity = ELEMENT_ALPHA;
        this._joystickBg = bg;

        const knob = new Node('Knob');
        area.addChild(knob);
        const knobUt = knob.addComponent(UITransform);
        knobUt.setContentSize(JOYSTICK_KNOB_SIZE, JOYSTICK_KNOB_SIZE);
        const knobSp = knob.addComponent(Sprite);
        knobSp.sizeMode = Sprite.SizeMode.CUSTOM;
        if (sf) knobSp.spriteFrame = sf;
        const knobOpa = knob.addComponent(UIOpacity);
        knobOpa.opacity = ELEMENT_ALPHA;
        this._joystickKnob = knob;
    }

    private _buildAttackButton(sf: SpriteFrame | null): void {
        const area = new Node('AttackArea');
        this.node.addChild(area);
        const ut = area.addComponent(UITransform);
        ut.setContentSize(ATTACK_BTN_SIZE, ATTACK_BTN_SIZE);
        // Widget 距右/下：让节点中心落在 (3W/4, H/4)；右距 = W - 3W/4 - size/2 = W/4 - size/2
        const v = view.getVisibleSize();
        const w = area.addComponent(Widget);
        w.isAlignRight  = true;
        w.isAlignBottom = true;
        w.right  = v.width  * POS_X_FACTOR_LEFT - ATTACK_BTN_SIZE / 2;  // = W * 0.25 - sz/2
        w.bottom = v.height * POS_Y_FACTOR      - ATTACK_BTN_SIZE / 2;
        this._attackAreaNode = area;

        const bg = new Node('Bg');
        area.addChild(bg);
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(ATTACK_BTN_SIZE, ATTACK_BTN_SIZE);
        const bgSp = bg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        if (sf) bgSp.spriteFrame = sf;
        const bgOpa = bg.addComponent(UIOpacity);
        bgOpa.opacity = ELEMENT_ALPHA;
        this._attackBtn = bg;

        const labelNode = new Node('Label');
        area.addChild(labelNode);
        const lblUt = labelNode.addComponent(UITransform);
        lblUt.setContentSize(ATTACK_BTN_SIZE, ATTACK_BTN_SIZE);
        const lbl = labelNode.addComponent(Label);
        lbl.fontSize = ATTACK_LABEL_SIZE;
        lbl.lineHeight = ATTACK_BTN_SIZE;
        lbl.color = new Color(255, 255, 255, 255);
        lbl.string = '攻击';
        const lblOpa = labelNode.addComponent(UIOpacity);
        lblOpa.opacity = ATTACK_LABEL_ALPHA;
    }

    /**
     * 加载 gameplay_pic_colordi 这张白色圆图。
     *
     * 资源在 assets/resources/gameplay_pic_colordi.png；ResourceMgr 已预加载（如未预加载，
     * 这里会返回 null，构建时跳过 spriteFrame 设置 —— 不至于崩溃）。
     */
    private _getColorDiSpriteFrame(): SpriteFrame | null {
        const tex = ResourceMgr.inst.get<Texture2D>(COLOR_DI_TEX_PATH);
        if (!tex) {
            console.warn(`[VirtualInputPanel] texture "${COLOR_DI_TEX_PATH}" 未预加载，按钮无背景图`);
            return null;
        }
        const sf = new SpriteFrame();
        sf.texture = tex;
        return sf;
    }
}
