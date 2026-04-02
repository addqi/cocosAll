System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, clientEvent, CardManager, BattleInfoData, _dec, _class, _class2, _crd, ccclass, property, BattleManager;

  function _reportPossibleCrUseOfclientEvent(extras) {
    _reporterNs.report("clientEvent", "../utils/clientEvent", _context.meta, extras);
  }

  function _reportPossibleCrUseOfCardManager(extras) {
    _reporterNs.report("CardManager", "./CardManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameManager(extras) {
    _reporterNs.report("GameManager", "./GameManager", _context.meta, extras);
  }

  _export("BattleInfoData", void 0);

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
    }, function (_unresolved_3) {
      CardManager = _unresolved_3.CardManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "cc7acID76VHQqGlF7+gllLM", "BattleManager", undefined);

      __checkObsolete__(['_decorator', 'find', 'instantiate', 'Prefab', 'resources']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("BattleManager", BattleManager = (_dec = ccclass("BattleManager"), _dec(_class = (_class2 = class BattleManager {
        constructor() {
          this.dicPanel = {};
          this.chooseCards = [];
          this._gameManager = void 0;
          this.isGameOver = false;
          this.battleInfo = null;
          this.enemyBattleInfo = null;
        }

        static get instance() {
          if (this._instance) {
            return this._instance;
          }

          this._instance = new BattleManager();
          return this._instance;
        }

        initBattleInfo(gameManger) {
          this.isGameOver = false;
          this._gameManager = gameManger;
          this.createrBattleInfo();
          this.createrEnemyBattleInfo();
          (_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
            error: Error()
          }), CardManager) : CardManager).instance.initCardArray();
          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).dispatchEvent("InitBattleInfo");
        }

        //初始化自己信息
        createrBattleInfo() {
          this.battleInfo = new BattleInfoData();
          this.battleInfo.hp = 500;
          this.battleInfo.attack = 10;
          this.battleInfo.curreentHp = this.battleInfo.hp;
        }

        createrEnemyBattleInfo() {
          this.enemyBattleInfo = new BattleInfoData();
          this.enemyBattleInfo.hp = 1000;
          this.enemyBattleInfo.attack = 10;
          this.enemyBattleInfo.curreentHp = this.enemyBattleInfo.hp;
        }

        onDamage(damage) {
          this.enemyBattleInfo.curreentHp -= damage;

          if (this.enemyBattleInfo.curreentHp <= 0) {
            this.enemyBattleInfo.curreentHp = 0;
            console.log("游戏结束");
            this.isGameOver = true;
          }

          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).dispatchEvent("UpdateEnemyHp");
        }

        get gameManager() {
          return this._gameManager;
        }

      }, _class2._instance = void 0, _class2)) || _class));

      _export("BattleInfoData", BattleInfoData = class BattleInfoData {
        constructor() {
          this.hp = 0;
          //血量
          this.attack = 0;
          //攻击
          this.curreentHp = 0;
        } //当前血量


      });

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=acd3303e63037ff55164004b3e6c8d5775333097.js.map