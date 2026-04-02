System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, SkeletalAnimation, Vec3, _dec, _dec2, _dec3, _class, _class2, _descriptor, _descriptor2, _crd, ccclass, property, Solider;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      Node = _cc.Node;
      SkeletalAnimation = _cc.SkeletalAnimation;
      Vec3 = _cc.Vec3;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "ad1fby91fVLHaF7CkqI7q/q", "Solider", undefined);

      __checkObsolete__(['_decorator', 'animation', 'Component', 'Node', 'SkeletalAnimation', 'Vec3', 'Vec4']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("Solider", Solider = (_dec = ccclass('Solider'), _dec2 = property(Node), _dec3 = property(SkeletalAnimation), _dec(_class = (_class2 = class Solider extends Component {
        constructor() {
          super(...arguments);
          this._index = 0;
          //小兵编号
          this._team = 0;
          //小兵队伍
          this._cardInfo = {};
          //
          this._startPos = new Vec3();

          //小兵初始位置
          _initializerDefineProperty(this, "model", _descriptor, this);

          _initializerDefineProperty(this, "animation", _descriptor2, this);
        }

        start() {}

        update(deltaTime) {} // 初始化


        init(index, team, pos, cardInfo) {
          this.node.setPosition(pos);
          this._startPos = pos;
          this._index = index;
          this._team = team;
          this._cardInfo = cardInfo; //获取卡牌信息 
          // 小兵队伍

          if (team == 1) {
            this.node.eulerAngles = new Vec3(0, 180, 0);
          } else if (team == 2) {}
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "model", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "animation", [_dec3], {
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
//# sourceMappingURL=ab0d81e7e2b13cda1b13eab554155776248ac3ed.js.map