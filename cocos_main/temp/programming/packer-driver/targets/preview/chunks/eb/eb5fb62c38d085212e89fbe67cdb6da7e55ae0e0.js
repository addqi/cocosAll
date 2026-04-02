System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, resources, CSVManager, _dec, _class, _class2, _crd, ccclass, property, ConfigManager;

  function _reportPossibleCrUseOfCSVManager(extras) {
    _reporterNs.report("CSVManager", "../utils/csvManager", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      resources = _cc.resources;
    }, function (_unresolved_2) {
      CSVManager = _unresolved_2.CSVManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "326eflXCmFA5bB6+yzQ6fsP", "ConfigManager", undefined);

      __checkObsolete__(['_decorator', 'find', 'instantiate', 'Prefab', 'resources']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("ConfigManager", ConfigManager = (_dec = ccclass("ConfigManager"), _dec(_class = (_class2 = class ConfigManager {
        constructor() {
          this.csvManager = new (_crd && CSVManager === void 0 ? (_reportPossibleCrUseOfCSVManager({
            error: Error()
          }), CSVManager) : CSVManager)();
          //加载表的总数
          this.csvCount = 0;
          this.currentLoadCount = 0;
        }

        static get instance() {
          if (this._instance) {
            return this._instance;
          }

          this._instance = new ConfigManager();
          return this._instance;
        }

        loadCsv() {
          resources.loadDir("datas", (err, assets) => {
            if (err) {
              return;
            }

            this.csvCount = assets.length;
            assets.forEach(item => {
              resources.load("datas/" + item.name, (err, asset) => {
                if (err) {
                  console.log(err.message || err);
                  return;
                }

                var text = asset.text;

                if (text) {
                  this.csvManager.addTable(item.name, text);
                  this.checkLoadCsvFinish();
                }
              });
            });
          });
        }

        checkLoadCsvFinish() {
          this.currentLoadCount++;

          if (this.currentLoadCount >= this.csvCount) {
            console.log("表格加载完成");
          }
        }

        queryAll(tableName, key, value) {
          return this.csvManager.queryAll(tableName, key, value);
        }

      }, _class2._instance = void 0, _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=eb5fb62c38d085212e89fbe67cdb6da7e55ae0e0.js.map