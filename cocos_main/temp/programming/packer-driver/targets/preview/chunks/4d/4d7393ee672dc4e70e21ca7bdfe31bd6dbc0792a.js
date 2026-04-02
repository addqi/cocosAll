System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, ProgressBar, tween, CardManager, _dec, _dec2, _dec3, _dec4, _dec5, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _crd, ccclass, property, Card;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfCardManager(extras) {
    _reporterNs.report("CardManager", "../manager/CardManager", _context.meta, extras);
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
      Node = _cc.Node;
      ProgressBar = _cc.ProgressBar;
      tween = _cc.tween;
    }, function (_unresolved_2) {
      CardManager = _unresolved_2.CardManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "380bbRumSRL5JkcsuKmOB8o", "Card", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'ProgressBar', 'TiledObjectGroup', 'tween']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("Card", Card = (_dec = ccclass('Card'), _dec2 = property(Node), _dec3 = property(ProgressBar), _dec4 = property(Node), _dec5 = property(Node), _dec(_class = (_class2 = class Card extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "icon", _descriptor, this);

          _initializerDefineProperty(this, "progressBar", _descriptor2, this);

          _initializerDefineProperty(this, "ndProgress", _descriptor3, this);

          _initializerDefineProperty(this, "ndChoose", _descriptor4, this);

          this.isChoose = false;
          this.index = -1;
          this.cardInfo = null;
          this.creatCardTime = 3;
        }

        //创建卡牌时间
        //初始化
        init() {
          this.index = -1;
          this.icon.active = false; // this.progressBar.node.active = true;

          this.ndChoose.active = false; //初始化 隐藏图案

          this.ndProgress.active = false;
          this.isChoose = false; // this.carInfo = null;
        }

        setIndex(index) {
          this.index = index;
        }

        updateData(cardData) {
          this.cardInfo = cardData;
          this.progressBar.progress = 0;

          if (cardData) {
            this.icon.active = true;
            this.ndProgress.active = false;
          } else {
            this.icon.active = false;
            this.ndProgress.active = false;
          }

          this.isChoose = false;
          this.ndChoose.active = false;
          this.node.setPosition(this.node.position.x, 0);
        }

        initData(index, cardDate) {
          if (this.index == index) {
            this.cardInfo = cardDate;
            this.icon.active = true;
          }
        }

        creatCard(index) {
          if (this.index == index && !this.cardInfo) {
            this.ndProgress.active = true;
            this.progressBar.progress = 0;
            var creatCardTime = this.creatCardTime;
            tween(this.progressBar).to(creatCardTime, {
              progress: 1
            }).call(() => {
              this.ndProgress.active = false;
              this.progressBar.progress = 0;
              this.cardInfo = (_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
                error: Error()
              }), CardManager) : CardManager).instance.creatCardInfo(index);
              this.icon.active = true;
            }).start();
          }
        }

        onCardClick() {
          if (this.cardInfo == null) {
            return;
          }

          this.isChoose = !this.isChoose;
          (_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
            error: Error()
          }), CardManager) : CardManager).instance.updateChooseCard(this.cardInfo, this.isChoose);
          this.updateChoose();
        }

        updateChoose() {
          this.ndChoose.active = this.isChoose;

          if (this.isChoose) {
            this.node.setPosition(this.node.position.x, 20);
          } else {
            this.node.setPosition(this.node.position.x, 0);
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "icon", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "progressBar", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "ndProgress", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "ndChoose", [_dec5], {
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
//# sourceMappingURL=4d7393ee672dc4e70e21ca7bdfe31bd6dbc0792a.js.map