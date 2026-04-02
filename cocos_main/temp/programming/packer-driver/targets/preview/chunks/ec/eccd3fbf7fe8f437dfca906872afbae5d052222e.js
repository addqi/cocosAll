System.register(["__unresolved_0", "cc", "__unresolved_1", "__unresolved_2"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, clientEvent, CardManager, BattleInfoDate, _dec, _class, _class2, _crd, ccclass, property, BattleManager;

  function _reportPossibleCrUseOfclientEvent(extras) {
    _reporterNs.report("clientEvent", "../utils/clientEvent", _context.meta, extras);
  }

  function _reportPossibleCrUseOfCardManager(extras) {
    _reporterNs.report("CardManager", "./CardManager", _context.meta, extras);
  }

  function _reportPossibleCrUseOfGameManager(extras) {
    _reporterNs.report("GameManager", "./GameManager", _context.meta, extras);
  }

  _export("BattleInfoDate", void 0);

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
    }, function (_unresolved_3) {
      CardManager = _unresolved_3.CardManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "f772aohuBdE8r+7y3+tn03l", "BattleManager", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'TiledObjectGroup']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("BattleManager", BattleManager = (_dec = ccclass('BattleManager'), _dec(_class = (_class2 = class BattleManager extends Component {
        constructor() {
          super(...arguments);
          this._dicPanel = {};
          //初始化自己信息
          this.battleInfo = new BattleInfoDate();
          this.enemyBattleInfo = new BattleInfoDate();
          this._gameManger = void 0;
        }

        static get instance() {
          if (!this._instance) {
            this._instance = new BattleManager();
          }

          return this._instance;
        } //初始化战斗信息


        initBattleInfo(gameManger) {
          this._gameManger = gameManger;
          this.creatBattleInfo();
          this.creatEnemyBattleInfo();
          (_crd && CardManager === void 0 ? (_reportPossibleCrUseOfCardManager({
            error: Error()
          }), CardManager) : CardManager).instance.initCardArray();
          (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
            error: Error()
          }), clientEvent) : clientEvent).dispatchEvent("InitBattleInfo");
        } //初始化玩家战斗信息


        creatBattleInfo() {
          this.battleInfo.hp = 500;
          this.battleInfo.attack = 10;
          this.battleInfo.curreentHp = this.battleInfo.hp;
        } //初始化敌人战斗信息


        creatEnemyBattleInfo() {
          this.enemyBattleInfo.hp = 500;
          this.enemyBattleInfo.attack = 10;
          this.enemyBattleInfo.curreentHp = this.enemyBattleInfo.hp;
        }

        onDamege(damage, team) {
          if (team == 1) {
            this.enemyBattleInfo.curreentHp -= damage;

            if (this.enemyBattleInfo.curreentHp <= 0) {
              (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
                error: Error()
              }), clientEvent) : clientEvent).dispatchEvent("GameOver");
              this.enemyBattleInfo.curreentHp = 0;
            }

            (_crd && clientEvent === void 0 ? (_reportPossibleCrUseOfclientEvent({
              error: Error()
            }), clientEvent) : clientEvent).dispatchEvent("UpdateEnemyHp");
          }
        }

      }, _class2._instance = null, _class2)) || _class));

      _export("BattleInfoDate", BattleInfoDate = class BattleInfoDate {
        constructor() {
          this.hp = void 0;
          //当前血量
          this.attack = void 0;
          //当前攻击力
          this.curreentHp = void 0;
        } //当前血量


      });

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=eccd3fbf7fe8f437dfca906872afbae5d052222e.js.map