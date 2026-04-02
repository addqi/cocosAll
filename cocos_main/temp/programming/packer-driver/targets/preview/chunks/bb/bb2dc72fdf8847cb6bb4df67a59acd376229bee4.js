System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, resources, CSVManager, _dec, _class, _class2, _crd, ccclass, property, ConfigManager;

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
      Component = _cc.Component;
      resources = _cc.resources;
    }, function (_unresolved_2) {
      CSVManager = _unresolved_2.CSVManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "a22b8GYxgZISoy0KO4UlKFy", "ConfigManager", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'resources', 'TiledObjectGroup', 'toDegree']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("ConfigManager", ConfigManager = (_dec = ccclass('ConfigManager'), _dec(_class = (_class2 = class ConfigManager extends Component {
        constructor() {
          super(...arguments);
          this.csvManager = new (_crd && CSVManager === void 0 ? (_reportPossibleCrUseOfCSVManager({
            error: Error()
          }), CSVManager) : CSVManager)();
          //加载表的总数
          this.csvCount = 0;
          this.currentLoadCount = 0;
        }

        static get instance() {
          // if(this._instance){
          //     return
          // }
          // this._instance = new ConfigManager();
          // return this._instance;
          if (!ConfigManager._instance) {
            // 检查是否已初始化
            ConfigManager._instance = new ConfigManager(); // 可选：在此处初始化必要数据（如加载 CSV）

            ConfigManager._instance.loadCsv();
          }

          return ConfigManager._instance; // 确保返回实例
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
//# sourceMappingURL=bb2dc72fdf8847cb6bb4df67a59acd376229bee4.js.map