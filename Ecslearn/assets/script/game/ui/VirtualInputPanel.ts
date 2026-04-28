import {
    _decorator, Component, Node, Color, Label, Sprite, SpriteFrame, Texture2D,
    UITransform, UIOpacity, Widget, Vec2, Vec3, Canvas, view,
    input, Input, EventTouch, EventMouse,
} from 'cc';
import { ResourceMgr } from '../../baseSystem/resource';
import { PlayerControl } from '../player/PlayerControl';

// 鼠标作为"虚拟触摸"的 ID（不会与 Cocos 真实 touch.getID 冲突，触摸 ID >= 0）
const MOUSE_POINTER_ID = -1;

const { ccclass } = _decorator;

// ─── 布局常数 ─────────────────────────────────────────
const JOYSTICK_BG_SIZE   = 200;
const JOYSTICK_KNOB_SIZE = 100;
const ATTACK_BTN_SIZE    = 200;
const ATTACK_LABEL_SIZE  = 56;
const ELEMENT_ALPHA      = 76;          // 0.3 × 255 ≈ 76
const ATTACK_LABEL_ALPHA = 230;         // 文字基本不透明，便于看清

// 位置策略：摇杆中心在屏幕 (W/4, H/4)，攻击按钮中心在 (3W/4, H/4)
const POS_X_FACTOR_LEFT  = 0.25;
const POS_Y_FACTOR       = 0.25;

// ─── 行为参数 ─────────────────────────────────────────
const JOYSTICK_DEAD_ZONE   = 20;        // px (节点本地坐标，节点中心为原点)
const JOYSTICK_MAX_RADIUS  = 100;       // px = 底盘半径

// ─── 资源 ────────────────────────────────────────────
const COLOR_DI_TEX_PATH = 'gameplay_pic_colordi/texture';

/** 摇杆输入结果 */
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
    return { x: dx / dist, y: dy / dist, active: true };
}

/** 摇杆头节点本地坐标偏移 */
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
 * 监听架构（方案 C：混合）：
 *   攻击按钮：
 *     - 节点级 TOUCH_START / TOUCH_END
 *     - Cocos 自动按节点矩形做命中检测，不需要手写 hitTest
 *     - PC 鼠标点击：Cocos 节点级 TOUCH 在 PC 端会被鼠标自动触发，零额外代码
 *
 *   摇杆：
 *     - 节点级 TOUCH_START（命中由节点矩形决定）
 *     - 全局 TOUCH_MOVE / TOUCH_END / TOUCH_CANCEL（解决"手指拖出底盘"问题）
 *     - 全局 MOUSE_MOVE / MOUSE_UP（PC 鼠标按住后拖出底盘也能跟随）
 *
 * 数据出口（写到 PlayerControl.rawInput）：
 *   - 摇杆：virtualMoveX / virtualMoveY / virtualMoveActive
 *   - 攻击：mouseDown / mouseHeld / mouseUp（前提 RawInputSystem.disableMouseClick=true，
 *           否则会被每帧覆盖）
 *
 * Linus 式好品味：
 *   - "需要拖出范围"用全局监听，"不需要拖出"用节点监听 —— 按需选择，不一刀切
 *   - 摇杆数学抽为纯函数（computeJoystickOutput / computeKnobLocalPos），可单测
 *   - 没有自己的 hitTest —— Cocos 节点系统已经做完
 */
@ccclass('VirtualInputPanel')
export class VirtualInputPanel extends Component {

    private _joystickAreaNode!: Node;
    private _joystickKnob!: Node;
    private _attackAreaNode!: Node;

    /** 摇杆当前 pointer id（触摸 id 或 MOUSE_POINTER_ID）；null = 未按下 */
    private _joystickTouchId: number | null = null;

    onLoad(): void {
        this._build();

        // 攻击按钮：节点级 TOUCH + 节点级 MOUSE 双重保险
        // (Cocos 3.x 节点级 TOUCH 在 PC 上"通常"会被鼠标自动触发，但版本不确定 → 显式加 MOUSE)
        this._attackAreaNode.on(Node.EventType.TOUCH_START,  this._onAttackStart, this);
        this._attackAreaNode.on(Node.EventType.TOUCH_END,    this._onAttackEnd,   this);
        this._attackAreaNode.on(Node.EventType.TOUCH_CANCEL, this._onAttackEnd,   this);
        this._attackAreaNode.on(Node.EventType.MOUSE_DOWN,   this._onAttackMouseDown, this);
        this._attackAreaNode.on(Node.EventType.MOUSE_UP,     this._onAttackMouseUp,   this);

        // 摇杆 START：节点级 TOUCH + 节点级 MOUSE_DOWN
        this._joystickAreaNode.on(Node.EventType.TOUCH_START, this._onJoystickStart, this);
        this._joystickAreaNode.on(Node.EventType.MOUSE_DOWN,  this._onJoystickMouseDown, this);

        // 摇杆 END：节点级 + 全局 双保险
        // - 节点矩形内松手：触发节点级 TOUCH_END（全局 TOUCH_END 不一定触发）
        // - 节点矩形外松手（拖出后）：触发全局 TOUCH_END
        // 两条路径都调同一个 handler，幂等（_releaseJoystick 内部置 null 后重复调无害）
        this._joystickAreaNode.on(Node.EventType.TOUCH_END,    this._onGlobalTouchEnd, this);
        this._joystickAreaNode.on(Node.EventType.TOUCH_CANCEL, this._onGlobalTouchEnd, this);
        this._joystickAreaNode.on(Node.EventType.MOUSE_UP,     this._onGlobalMouseUp,  this);

        // 摇杆 MOVE：全局（拖出底盘后跟随）
        input.on(Input.EventType.TOUCH_MOVE,   this._onGlobalTouchMove, this);
        input.on(Input.EventType.TOUCH_END,    this._onGlobalTouchEnd,  this);
        input.on(Input.EventType.TOUCH_CANCEL, this._onGlobalTouchEnd,  this);
        input.on(Input.EventType.MOUSE_MOVE,   this._onGlobalMouseMove, this);
        input.on(Input.EventType.MOUSE_UP,     this._onGlobalMouseUp,   this);
    }

    onDestroy(): void {
        this._attackAreaNode?.off(Node.EventType.TOUCH_START,  this._onAttackStart, this);
        this._attackAreaNode?.off(Node.EventType.TOUCH_END,    this._onAttackEnd,   this);
        this._attackAreaNode?.off(Node.EventType.TOUCH_CANCEL, this._onAttackEnd,   this);
        this._attackAreaNode?.off(Node.EventType.MOUSE_DOWN,   this._onAttackMouseDown, this);
        this._attackAreaNode?.off(Node.EventType.MOUSE_UP,     this._onAttackMouseUp,   this);
        this._joystickAreaNode?.off(Node.EventType.TOUCH_START, this._onJoystickStart, this);
        this._joystickAreaNode?.off(Node.EventType.TOUCH_END,    this._onGlobalTouchEnd, this);
        this._joystickAreaNode?.off(Node.EventType.TOUCH_CANCEL, this._onGlobalTouchEnd, this);
        this._joystickAreaNode?.off(Node.EventType.MOUSE_DOWN,   this._onJoystickMouseDown, this);
        this._joystickAreaNode?.off(Node.EventType.MOUSE_UP,     this._onGlobalMouseUp, this);
        input.off(Input.EventType.TOUCH_MOVE,   this._onGlobalTouchMove, this);
        input.off(Input.EventType.TOUCH_END,    this._onGlobalTouchEnd,  this);
        input.off(Input.EventType.TOUCH_CANCEL, this._onGlobalTouchEnd,  this);
        input.off(Input.EventType.MOUSE_MOVE,   this._onGlobalMouseMove, this);
        input.off(Input.EventType.MOUSE_UP,     this._onGlobalMouseUp,   this);
        this._releaseJoystick();
        this._releaseAttack();
    }

    /**
     * Cocos 每帧 Component.update 自动调用 —— 单帧脉冲清理。
     *
     * 因为虚拟攻击按钮直接写 RawInputComp.mouseDown/mouseUp（在 RawInputSystem.disableMouseClick=true 时
     * 这些字段不再被 RawInputSystem 覆盖），需要我们自己负责"单帧脉冲下一帧自动清"。
     *
     * mouseHeld 持久状态由 _pressAttack/_releaseAttack 显式 true/false，不在这里清。
     */
    update(_dt: number): void {
        const raw = PlayerControl.instance?.rawInput;
        if (!raw) return;
        if (raw.mouseDown) raw.mouseDown = false;
        if (raw.mouseUp)   raw.mouseUp   = false;
    }

    // ─── 攻击按钮事件（节点级 TOUCH + MOUSE 双重保险）──

    private _onAttackStart = (_e: EventTouch): void => {
        this._pressAttack();
    };
    private _onAttackEnd = (_e: EventTouch): void => {
        this._releaseAttack();
    };
    private _onAttackMouseDown = (e: EventMouse): void => {
        if (e.getButton() !== EventMouse.BUTTON_LEFT) return;
        this._pressAttack();   // 调多次幂等：写 true 即可，下一帧 update 自动清
    };
    private _onAttackMouseUp = (e: EventMouse): void => {
        if (e.getButton() !== EventMouse.BUTTON_LEFT) return;
        this._releaseAttack();
    };

    // ─── 摇杆事件（节点级 START + 全局 MOVE/END）─────

    private _onJoystickStart = (e: EventTouch): void => {
        if (this._joystickTouchId !== null) return;   // 防 TOUCH_START 与 MOUSE_DOWN 双触发
        const t = e.touch;
        if (!t) return;
        this._joystickTouchId = t.getID();
        this._updateJoystickByTouch(t.getLocation());
    };

    private _onJoystickMouseDown = (e: EventMouse): void => {
        if (this._joystickTouchId !== null) return;   // 已被 TOUCH_START 锁，忽略
        if (e.getButton() !== EventMouse.BUTTON_LEFT) return;
        this._joystickTouchId = MOUSE_POINTER_ID;
        const loc = new Vec2(e.getLocationX(), e.getLocationY());
        this._updateJoystickByTouch(loc);
    };

    private _onGlobalTouchMove = (e: EventTouch): void => {
        if (this._joystickTouchId === null) return;
        const t = e.touch;
        if (!t) return;
        // PC 上 Cocos 把鼠标转 touch（id=0），可能与摇杆 START 锁的 id 一致；
        // 手机上多点触摸要严格匹配 id
        if (t.getID() !== this._joystickTouchId) return;
        this._updateJoystickByTouch(t.getLocation());
    };

    private _onGlobalTouchEnd = (e: EventTouch): void => {
        if (this._joystickTouchId === null) return;
        const t = e.touch;
        if (!t) return;
        if (t.getID() !== this._joystickTouchId) return;
        this._joystickTouchId = null;
        this._releaseJoystick();
    };

    private _onGlobalMouseMove = (e: EventMouse): void => {
        // 鼠标 MOVE 仅在摇杆已被鼠标"按下"过且仍在跟踪时处理
        // PC 上 Cocos 节点级 TOUCH_START 通常自动转 touch.id=0；但如果 Cocos 不转，
        // 这里也覆盖 MOUSE_POINTER_ID 路径。运行时只要 _joystickTouchId 非 null 就处理
        if (this._joystickTouchId === null) return;
        const loc = new Vec2(e.getLocationX(), e.getLocationY());
        this._updateJoystickByTouch(loc);
    };

    private _onGlobalMouseUp = (e: EventMouse): void => {
        if (e.getButton() !== EventMouse.BUTTON_LEFT) return;
        if (this._joystickTouchId === null) return;
        this._joystickTouchId = null;
        this._releaseJoystick();
    };

    // ─── 摇杆状态写入 ────────────────────────────────

    /**
     * 触摸点（屏幕坐标）→ 摇杆容器节点本地坐标（中心为原点）→ 归一化输出。
     */
    private _updateJoystickByTouch(screenLoc: Vec2): void {
        const local = this._screenToLocal(screenLoc, this._joystickAreaNode);
        if (!local) return;

        const out = computeJoystickOutput(
            local.x, local.y, 0, 0,
            JOYSTICK_DEAD_ZONE, JOYSTICK_MAX_RADIUS,
        );
        const knobLocal = computeKnobLocalPos(
            local.x, local.y, 0, 0, JOYSTICK_MAX_RADIUS,
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

    /**
     * 攻击按钮按下：写 RawInputComp.mouseDown=true（单帧脉冲）+ mouseHeld=true（持久）。
     * 前提：RawInputSystem.disableMouseClick=true，否则会被覆盖。
     */
    private _pressAttack(): void {
        const raw = PlayerControl.instance?.rawInput;
        if (!raw) return;
        raw.mouseDown = true;
        raw.mouseHeld = true;
    }

    /** 攻击按钮抬起：mouseHeld → false（持久）+ mouseUp=true（单帧脉冲）*/
    private _releaseAttack(): void {
        const raw = PlayerControl.instance?.rawInput;
        if (!raw) return;
        raw.mouseHeld = false;
        raw.mouseUp = true;
    }

    // ─── 工具：屏幕坐标 → 节点本地坐标 ──────────────

    /**
     * 屏幕坐标 → 节点本地坐标（节点中心为原点）。
     * 用 Camera.screenToWorld + UITransform.convertToNodeSpaceAR 处理 Canvas + Camera 适配。
     */
    private _screenToLocal(screen: Vec2, node: Node): Vec2 | null {
        const ut = node.getComponent(UITransform);
        if (!ut) return null;
        const cam = this._uiCanvasOf(node)?.cameraComponent;
        if (!cam) return null;
        const screen3 = new Vec3(screen.x, screen.y, 0);
        const world = new Vec3();
        cam.screenToWorld(screen3, world);
        const local = new Vec3();
        ut.convertToNodeSpaceAR(world, local);
        return new Vec2(local.x, local.y);
    }

    /** 从节点向上找最近的 Canvas 组件 —— 触摸坐标转换需要 Canvas 绑定的 Camera */
    private _uiCanvasOf(node: Node): Canvas | null {
        let cur: Node | null = node;
        while (cur) {
            const c = cur.getComponent(Canvas);
            if (c) return c;
            cur = cur.parent;
        }
        return null;
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
        const v = view.getVisibleSize();
        const w = area.addComponent(Widget);
        w.isAlignRight  = true;
        w.isAlignBottom = true;
        // 中心在 (3W/4, H/4) → 距右 = W * 0.25 - sz/2
        w.right  = v.width  * POS_X_FACTOR_LEFT - ATTACK_BTN_SIZE / 2;
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
     * 资源在 assets/resources/gameplay_pic_colordi.png；ResourcePreloader 已预加载。
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
