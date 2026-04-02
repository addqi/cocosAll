System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, clientEvent, CardInfo, _dec, _class, _class2, _crd, ccclass, property, CardManager;

  function _reportPossibleCrUseOfclientEvent(extras) {
    _reporterNs.report("clientEvent", "../utils/clientEvent", _context.meta, extras);
  }

  _export("CardInfo", void 0);

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
    }, function (_unresolved_2) {
      clientEvent = _unresolved_2.clientEvent;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "09689yBGflAxo0ooNzoAp1Z", "CardManager", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'TiledObjectGroup']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("CardManager", CardManager = (_dec = ccclass('CardManager'), _dec(_class = (_class2 = class CardManager extends Component {
        constructor() {
          super(...arguments);
          this.cardArry = [];
          //最多卡牌
          this.chooseCards = [];
        }

        static get instance() {
          if (!this._instance) {
            this._instance = new CardManager();
          }

          return this._instance;
        }

        //选中的卡牌
        initCardArray() {
          this.cardArry = []; // // 初始化卡牌
          // for (let i = 0; i < 3; i++) {
          //     let cardInfo:CardInfo=new CardInfo();
          //     cardInfo.type=i;
          //     this.cardArry.push(cardInfo);
          // }

          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).dispatchEvent("InitCardInfo");
        }

        creatCardInfo(index) {
          var cardInfo = new CardInfo();
          cardInfo.type = index;
          cardInfo.uid = Date.now() + "" + Math.random() * 100000000; //唯一id

          CardManager.instance.cardArry.push(cardInfo);
          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).dispatchEvent("UpdateCard");
          return cardInfo;
        }

        updateChooseCard(cardInfo, isChoose) {
          if (isChoose) {
            this.chooseCards.push(cardInfo);
          } else {
            for (var i = 0; i < this.chooseCards.length; i++) {
              if (this.chooseCards[i].uid == cardInfo.uid) {
                this.chooseCards.splice(i);
                return;
              }
            }
          }
        }

        updateCard(cardArry, haveCardArr) {
          for (var i = 0; i < cardArry.length; i++) {
            var info = cardArry[i];

            for (var j = 0; j < haveCardArr.length; j++) {
              var haveCardInfo = haveCardArr[j];

              if (info.uid == haveCardInfo.uid) {
                haveCardArr.splice(j, 1);
                break;
              }
            }
          }

          this.chooseCards = [];
          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).dispatchEvent("UpdateCard");
        }

      }, _class2._instance = null, _class2.maxCardCount = 7, _class2)) || _class));

      _export("CardInfo", CardInfo = class CardInfo {
        constructor() {
          this.type = 0;
          //什么兵种
          this.uid = '';
        } //唯一id


      });

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=849503f2aadce4731d729d9ecf5a08f27a0b28bd.js.map