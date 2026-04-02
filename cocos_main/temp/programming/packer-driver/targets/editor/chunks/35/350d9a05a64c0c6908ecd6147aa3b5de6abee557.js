System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, clientEvent, CardInfo, _dec, _class, _class2, _crd, ccclass, property, CardManager;

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
    }, function (_unresolved_2) {
      clientEvent = _unresolved_2.clientEvent;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "fb37en0eJtIvLnjOfnFVg5N", "CardManager", undefined);

      __checkObsolete__(['_decorator', 'find', 'instantiate', 'Prefab', 'resources']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("CardManager", CardManager = (_dec = ccclass("CardManager"), _dec(_class = (_class2 = class CardManager {
        constructor() {
          this.dicPanel = {};
          this.cardArray = [];
          this.chooseCards = [];
        }

        static get instance() {
          if (this._instance) {
            return this._instance;
          }

          this._instance = new CardManager();
          return this._instance;
        }

        initCardArray() {
          this.cardArray = []; //起手5张

          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).dispatchEvent("InitCardInfo");
        }

        creatCardInfo(arr) {
          if (arr.length < CardManager.maxCardCount) {
            let cardInfo = new CardInfo();
            cardInfo.type = 2;
            cardInfo.uid = Date.now() + "" + Math.random() * 100000000;
            arr.push(cardInfo);
            (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
              error: Error()
            }), clientEvent) : clientEvent).dispatchEvent("UpdateCard");
          }
        }

        updateChooseCard(cardInfo, isChoose) {
          if (isChoose) {
            this.chooseCards.push(cardInfo);
          } else {
            for (let i = 0; i < this.chooseCards.length; i++) {
              let item = this.chooseCards[i];

              if (item.uid == cardInfo.uid) {
                this.chooseCards.splice(i);
                return;
              }
            }
          }
        }

        updateCard(cardArray, haveCardArr) {
          for (let i = 0; i < cardArray.length; i++) {
            let info = cardArray[i];

            for (let j = 0; j < haveCardArr.length; j++) {
              let haveCardInfo = haveCardArr[j];

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

      }, _class2._instance = void 0, _class2.maxCardCount = 7, _class2)) || _class));

      _export("CardInfo", CardInfo = class CardInfo {
        constructor() {
          this.type = 0;
          this.uid = "";
        } //唯一id


      });

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=350d9a05a64c0c6908ecd6147aa3b5de6abee557.js.map