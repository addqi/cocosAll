System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Label, UiManager, clientEvent, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _descriptor7, _crd, ccclass, property, HomePanel;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfUiManager(extras) {
    _reporterNs.report("UiManager", "../manager/UiManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfclientEvent(extras) {
    _reporterNs.report("clientEvent", "../utils/clientEvent", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      Label = _cc.Label;
    }, function (_unresolved_2) {
      UiManager = _unresolved_2.UiManager;
    }, function (_unresolved_3) {
      clientEvent = _unresolved_3.clientEvent;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "40e85JoxO9HHLVkrSL1wMVV", "HomePanel", undefined);

      __checkObsolete__(['_decorator', 'Component', 'find', 'instantiate', 'Label', 'Node', 'Prefab', 'resources']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("HomePanel", HomePanel = (_dec = ccclass('HomePanel'), _dec2 = property(Label), _dec3 = property(Label), _dec4 = property(Label), _dec5 = property(Label), _dec6 = property(Label), _dec7 = property(Label), _dec8 = property(Label), _dec(_class = (_class2 = class HomePanel extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "txtGold", _descriptor, this);

          _initializerDefineProperty(this, "txtSoliderLv", _descriptor2, this);

          _initializerDefineProperty(this, "txtSoliderLvUpCost", _descriptor3, this);

          _initializerDefineProperty(this, "txtHpLv", _descriptor4, this);

          _initializerDefineProperty(this, "txtHpLvUpCost", _descriptor5, this);

          _initializerDefineProperty(this, "txtGoldLv", _descriptor6, this);

          _initializerDefineProperty(this, "txtGoldLvUpCost", _descriptor7, this);
        }

        start() {}

        update(deltaTime) {} // 初始化界面


        init() {
          this.txtGold.string = "0";
          this.txtGoldLv.string = "获得奖励等级:Lv.1";
          this.txtGoldLvUpCost.string = "100";
          this.txtSoliderLv.string = "兵种等级:Lv.1";
          this.txtSoliderLvUpCost.string = "100";
          this.txtHpLv.string = "血量提升等级:Lv.1";
          this.txtHpLvUpCost.string = "100";
        }

        onBtnStartClick() {
          console.log("打开游戏界面");
          this.node.active = false;
          this.showGamePanel();
        }

        onBtnSoliderUpClick() {
          console.log("点击提升兵种等级按钮");
        }

        onBtnHpUpClick() {
          console.log("点击提升血量等级按钮");
        }

        onBtnGoldUpClick() {
          console.log("点击提升获得奖励等级按钮");
        }

        showGamePanel() {
          (_crd && UiManager === void 0 ? (_reportPossibleCrUseOfUiManager({
            error: Error()
          }), UiManager) : UiManager).instance.hidePanel("HomePanel");
          (_crd && UiManager === void 0 ? (_reportPossibleCrUseOfUiManager({
            error: Error()
          }), UiManager) : UiManager).instance.showPanel("GamePanel", () => {
            (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
              error: Error()
            }), clientEvent) : clientEvent).dispatchEvent("CreaterPlayer");
          });
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "txtGold", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "txtSoliderLv", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "txtSoliderLvUpCost", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "txtHpLv", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "txtHpLvUpCost", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "txtGoldLv", [_dec7], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor7 = _applyDecoratedDescriptor(_class2.prototype, "txtGoldLvUpCost", [_dec8], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=2bafc087a16eda0b5b0f4f0f59fa04e61bc0167e.js.map