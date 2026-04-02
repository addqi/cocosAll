System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2", "__unresolved_3", "__unresolved_4", "__unresolved_5"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, instantiate, Label, Node, ProgressBar, clientEvent, BattleManager, CardManager, Card, FigthManager, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _descriptor6, _crd, ccclass, property, GamePanel;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfclientEvent(extras) {
    _reporterNs.report("clientEvent", "../utils/clientEvent", _context.meta, extras);
  }

  function _reportPossibleCrUseOfBattleManager(extras) {
    _reporterNs.report("BattleManager", "../manager/BattleManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfCardManager(extras) {
    _reporterNs.report("CardManager", "../manager/CardManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfCard(extras) {
    _reporterNs.report("Card", "./Card", _context.meta, extras);
  }

  function _reportPossibleCrUseOfFigthManager(extras) {
    _reporterNs.report("FigthManager", "../manager/FigthManager", _context.meta, extras);
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
      instantiate = _cc.instantiate;
      Label = _cc.Label;
      Node = _cc.Node;
      ProgressBar = _cc.ProgressBar;
    }, function (_unresolved_2) {
      clientEvent = _unresolved_2.clientEvent;
    }, function (_unresolved_3) {
      BattleManager = _unresolved_3.BattleManager;
    }, function (_unresolved_4) {
      CardManager = _unresolved_4.CardManager;
    }, function (_unresolved_5) {
      Card = _unresolved_5.Card;
    }, function (_unresolved_6) {
      FigthManager = _unresolved_6.FigthManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "df340BNOvZIN46WkQVGaI+J", "GamePanel", undefined);

      __checkObsolete__(['_decorator', 'Component', 'EventTouch', 'instantiate', 'Label', 'Node', 'ProgressBar']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("GamePanel", GamePanel = (_dec = ccclass('GamePanel'), _dec2 = property(Label), _dec3 = property(ProgressBar), _dec4 = property(Label), _dec5 = property(ProgressBar), _dec6 = property(Node), _dec7 = property(Node), _dec(_class = (_class2 = class GamePanel extends Component {
        constructor(...args) {
          super(...args);

          //敌方信息
          _initializerDefineProperty(this, "txtDfHp", _descriptor, this);

          _initializerDefineProperty(this, "dfHpPro", _descriptor2, this);

          _initializerDefineProperty(this, "txtMyHp", _descriptor3, this);

          _initializerDefineProperty(this, "myHpPro", _descriptor4, this);

          _initializerDefineProperty(this, "cardList", _descriptor5, this);

          _initializerDefineProperty(this, "card", _descriptor6, this);

          this.cardNodeList = [];
        }

        onEnable() {
          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).on("InitBattleInfo", this.initBattleInfo, this);
          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).on("InitCardInfo", this.initCardInfo, this);
          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).on("UpdateCard", this.updateCard, this);
          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).on("UpdateEnemyHp", this.updateEnemyInfo, this);
          this.node.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
          this.node.on(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
          this.node.on(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
          this.node.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        }

        _onTouchStart(event) {
          console.log("鼠标点击");

          if ((_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
            error: Error()
          }), CardManager) : CardManager).instance.chooseCards.length > 0) {
            (_crd && FigthManager === void 0 ? (_reportPossibleCrUseOfFigthManager({
              error: Error()
            }), FigthManager) : FigthManager).instance.touchStart(event);
          }
        }

        _onTouchMove(event) {
          console.log("鼠标移动");

          if ((_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
            error: Error()
          }), CardManager) : CardManager).instance.chooseCards.length > 0) {
            (_crd && FigthManager === void 0 ? (_reportPossibleCrUseOfFigthManager({
              error: Error()
            }), FigthManager) : FigthManager).instance.touchMove(event);
          }
        }

        _onTouchCancel(event) {
          console.log("鼠标结束");

          if ((_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
            error: Error()
          }), CardManager) : CardManager).instance.chooseCards.length > 0) {
            (_crd && FigthManager === void 0 ? (_reportPossibleCrUseOfFigthManager({
              error: Error()
            }), FigthManager) : FigthManager).instance.touchEnd(event);
          }
        }

        _onTouchEnd(event) {
          if ((_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
            error: Error()
          }), CardManager) : CardManager).instance.chooseCards.length > 0) {
            (_crd && FigthManager === void 0 ? (_reportPossibleCrUseOfFigthManager({
              error: Error()
            }), FigthManager) : FigthManager).instance.touchEnd(event);
          }
        }

        onDisable() {
          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).off("InitCardInfo", this.initCardInfo, this);
          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).off("InitBattleInfo", this.initBattleInfo, this);
          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).off("UpdateCard", this.updateCard, this);
          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).off("UpdateEnemyHp", this.updateEnemyInfo, this);
          this.node.off(Node.EventType.TOUCH_START, this._onTouchStart, this);
          this.node.off(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
          this.node.off(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
          this.node.off(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        }

        initBattleInfo() {
          this.updateEnemyInfo();
          this.updateRoleinfo();
        }

        updateRoleinfo() {
          let battleInfo = (_crd && BattleManager === void 0 ? (_reportPossibleCrUseOfBattleManager({
            error: Error()
          }), BattleManager) : BattleManager).instance.battleInfo;
          let curreentHp = battleInfo.curreentHp;
          let maxHp = battleInfo.hp;
          this.txtMyHp.string = curreentHp.toString();
          let por = curreentHp / maxHp;
          this.myHpPro.progress = por;
        }

        updateEnemyInfo() {
          let enemyBattleInfo = (_crd && BattleManager === void 0 ? (_reportPossibleCrUseOfBattleManager({
            error: Error()
          }), BattleManager) : BattleManager).instance.enemyBattleInfo;
          let curreentHp = enemyBattleInfo.curreentHp;
          let maxHp = enemyBattleInfo.hp;
          this.txtDfHp.string = curreentHp.toString();
          this.dfHpPro.progress = curreentHp / maxHp;
        }

        updateCard() {
          let cardArray = (_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
            error: Error()
          }), CardManager) : CardManager).instance.cardArray;

          for (let i = 0; i < this.cardNodeList.length; i++) {
            let card = this.cardNodeList[i];
            let cardinfo = cardArray[i];

            if (card.cardInfo == null || cardinfo == null) {
              card.updatteData(cardinfo);
            }

            if (i == this.cardNodeList.length - 1) {
              this.checkCardinfo();
            }
          }
        }

        initCardInfo() {
          let cardInfo = (_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
            error: Error()
          }), CardManager) : CardManager).instance.cardArray;

          for (let i = 0; i < cardInfo.length; i++) {
            let info = cardInfo[i];
            this.cardNodeList[i].initData(i, info);
          }

          this.checkCardinfo();
        }

        checkCardinfo() {
          for (let i = 0; i < this.cardNodeList.length; i++) {
            let card = this.cardNodeList[i];

            if (card) {
              if (!card.cardInfo) {
                card.creatCard(i);
                return;
              }
            }
          }
        }

        init() {
          this.initCardView();
        }

        initCardView() {
          this.cardNodeList = [];
          let maxCount = (_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
            error: Error()
          }), CardManager) : CardManager).maxCardCount;
          this.cardList.removeAllChildren();

          for (let i = 0; i < maxCount; i++) {
            let node = instantiate(this.card);
            let card = node.getComponent(_crd && Card === void 0 ? (_reportPossibleCrUseOfCard({
              error: Error()
            }), Card) : Card);
            card.init();
            card.setIndex(i);
            this.cardList.addChild(node);
            this.cardNodeList.push(card);
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "txtDfHp", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "dfHpPro", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "txtMyHp", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "myHpPro", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "cardList", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor6 = _applyDecoratedDescriptor(_class2.prototype, "card", [_dec7], {
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
//# sourceMappingURL=cc7c33045a95598c9083b688f91dc5ecdef6faa3.js.map