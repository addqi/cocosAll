System.register(["__unresolved_0", "cc"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Material, SkeletalAnimation, SkinnedMeshRenderer, AnimationClip, _dec, _dec2, _dec3, _dec4, _class, _class2, _descriptor, _descriptor2, _descriptor3, _crd, ccclass, property, SoliderModel;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfSolider(extras) {
    _reporterNs.report("Solider", "../Solider", _context.meta, extras);
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
      Material = _cc.Material;
      SkeletalAnimation = _cc.SkeletalAnimation;
      SkinnedMeshRenderer = _cc.SkinnedMeshRenderer;
      AnimationClip = _cc.AnimationClip;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "1d3469ErItAj6S3cbxgIl8x", "SoliderModel", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Material', 'Node', 'SkeletalAnimation', 'SkeletalAnimationState', 'SkinnedMeshRenderer', 'AnimationClip']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("SoliderModel", SoliderModel = (_dec = ccclass('SoliderModel'), _dec2 = property(SkinnedMeshRenderer), _dec3 = property([Material]), _dec4 = property(SkeletalAnimation), _dec(_class = (_class2 = class SoliderModel extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "model", _descriptor, this);

          _initializerDefineProperty(this, "skin", _descriptor2, this);

          _initializerDefineProperty(this, "ani", _descriptor3, this);

          this.solider = void 0;
          this._currentAni = void 0;
          this._aniState = null;
        }

        updateInfo(solider) {
          this.solider = solider;
          this.updateModel(solider.team);
          this.ani.play("idle");
        }

        updateModel(team) {
          // console.log("更新小兵皮肤");
          if (team == 1) {
            this.model[0].material = this.skin[0];
          } else if (team == 2) {
            this.model[0].material = this.skin[1];
          }
        }

        playAni(aniName, isLoop, callback) {
          if (isLoop === void 0) {
            isLoop = false;
          }

          if (aniName == this._currentAni) {
            console.log("当前播放的动画是" + this._currentAni);
            return;
          }

          this._currentAni = aniName;

          if (!this.ani) {
            this.ani = this.node.getComponent(SkeletalAnimation);
            console.error("没有找到动画组件");
          }

          this.ani.play(aniName);
          this._aniState = this.ani.getState(aniName);

          if (this._aniState) {
            if (isLoop) {
              this._aniState.wrapMode = AnimationClip.WrapMode.Loop;
              console.log("循环播放");
            } else {
              this._aniState.wrapMode = AnimationClip.WrapMode.Normal;
              console.log("播放一次");
              this.ani.once(SkeletalAnimation.EventType.FINISHED, () => {
                this._currentAni = "";
                callback && callback();
              });
            }
          }
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "model", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "skin", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return [];
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "ani", [_dec4], {
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
//# sourceMappingURL=18bff13ee40b76b01c397fba55c998fc713e8c54.js.map