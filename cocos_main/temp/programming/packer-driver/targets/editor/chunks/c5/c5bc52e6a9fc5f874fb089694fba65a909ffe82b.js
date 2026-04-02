System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, ProgressBar, Sprite, tween, Tween, v3, CardManager, _dec, _dec2, _dec3, _dec4, _dec5, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _crd, ccclass, property, Card;

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
      Sprite = _cc.Sprite;
      tween = _cc.tween;
      Tween = _cc.Tween;
      v3 = _cc.v3;
    }, function (_unresolved_2) {
      CardManager = _unresolved_2.CardManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "0d500+320VL96E87eRMo8Sm", "Card", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'ProgressBar', 'Sprite', 'tween', 'Tween', 'v3']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("Card", Card = (_dec = ccclass('Card'), _dec2 = property(Sprite), _dec3 = property(ProgressBar), _dec4 = property(Node), _dec5 = property(Node), _dec(_class = (_class2 = class Card extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "icon", _descriptor, this);

          _initializerDefineProperty(this, "progressBar", _descriptor2, this);

          _initializerDefineProperty(this, "ndProgress", _descriptor3, this);

          _initializerDefineProperty(this, "ndChoose", _descriptor4, this);

          this.index = -1;
          this.cardInfo = null;
          this.isChoose = false;
        }

        init() {
          this.index = -1;
          this.icon.node.active = false;
          this.ndProgress.active = false;
          this.cardInfo = null;
          this.ndChoose.active = false;
          this.isChoose = false;
        }

        setIndex(index) {
          this.index = index;
        }

        updatteData(cardData) {
          this.cardInfo = cardData;
          this.progressBar.progress = 0;

          if (cardData) {
            this.icon.node.active = true;
            this.ndProgress.active = false;
          } else {
            this.icon.node.active = false;
            this.ndProgress.active = false;
          }

          this.isChoose = false;
          this.updateChoose();
        }

        initData(index, cardData) {
          if (this.index == index) {
            this.cardInfo = cardData;
            this.icon.node.active = true;
            this.ndProgress.active = false;
          }
        }

        creatCard(index) {
          if (!this.cardInfo && this.index == index) {
            this.ndProgress.active = true;
            this.progressBar.progress = 0;
            let creatCardTime = 3;
            Tween.stopAllByTarget(this.progressBar);
            tween(this.progressBar).to(creatCardTime, {
              progress: 1
            }).call(() => {
              this.progressBar.progress = 0;
              (_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
                error: Error()
              }), CardManager) : CardManager).instance.creatCardInfo((_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
                error: Error()
              }), CardManager) : CardManager).instance.cardArray);
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
          if (this.isChoose) {
            this.ndChoose.active = true;
            this.node.position = v3(this.node.position.x, 20, this.node.position.z);
          } else {
            this.ndChoose.active = false;
            this.node.position = v3(this.node.position.x, 0, this.node.position.z);
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "icon", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "progressBar", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "ndProgress", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "ndChoose", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=c5bc52e6a9fc5f874fb089694fba65a909ffe82b.js.map