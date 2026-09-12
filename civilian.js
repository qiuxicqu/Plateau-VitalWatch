(function () {
  "use strict";

  var replacements = [
    ["工作台", "项目工作台"],
    ["实时掌握高原环境与人员健康状态，快速定位需要处置的风险。", "面向高原医学研究，实时掌握环境与参与者生命体征变化。"],
    ["当前高原环境", "当前高原环境"],
    ["昆仑北坡", "高原医学研究场景"],
    ["昆仑训练基地", "高原医学研究场景"],
    ["训练区 03", "监测点 03"],
    ["训练风险", "环境适应风险"],
    ["值班席位", "医护研究席位"],
    ["辅助救治", "辅助照护"],
    ["救治方案", "照护建议"],
    ["救治方案库", "照护建议库"],
    ["危重伤员档案", "重点病例档案"],
    ["危重伤员数据规模", "历史病例数据规模"],
    ["伤员数据库", "病例库"],
    ["治疗 / 照护建议", "诊疗支持方案"],
    ["伤员", "参与者"],
    ["登山突击组", "高原低氧适应队列"],
    ["通信保障组", "高原低氧适应队列"],
    ["工程保障组", "高原呼吸循环监测队列"],
    ["运输保障组", "高原呼吸循环监测队列"],
    ["医疗保障组", "高原临床症状观察队列"],
    ["火力支援组", "高原呼吸循环监测队列"],
    ["卫生员", "研究协调员"],
    ["驾驶员", "研究参与者"],
    ["通信员", "研究参与者"],
    ["工程师", "研究参与者"],
    ["组长", "研究参与者"],
    ["队员", "研究参与者"],
    ["操作员", "研究参与者"],
    ["护士", "研究参与者"],
    ["海拔暴露", "监测时长"],
    ["暴露时间", "监测时长"],
    ["医疗保障人员", "医护研究人员"],
    ["系统管理", "平台设置"],
    ["内部演示", "联合研究演示"]
  ];

  function patchText(root) {
    var walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue.trim()) continue;
      var value = node.nodeValue;
      replacements.forEach(function (pair) {
        if (pair[0] === "工作台") {
          value = value.replace(/(?:项目)+工作台/g, "项目工作台");
          value = value.replace(/(^|[^项目])工作台/g, "$1项目工作台");
        } else {
          value = value.split(pair[0]).join(pair[1]);
        }
      });
      if (value !== node.nodeValue) node.nodeValue = value;
    }
  }

  function patchAttrs() {
    document.title = "高原生命守望 · 综合监测平台";
    var modalRole = document.getElementById("modal-role");
    if (modalRole && modalRole.textContent.indexOf("研究参与者") < 0) modalRole.textContent = "高原低氧适应队列 · 研究参与者";
  }

  function apply() {
    patchText(document.body);
    patchAttrs();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
  window.setTimeout(apply, 300);
  window.setTimeout(apply, 1000);
  if (window.MutationObserver) {
    new MutationObserver(function (records) {
      records.forEach(function (record) {
        Array.prototype.forEach.call(record.addedNodes, function (node) {
          if (node.nodeType === 1) patchText(node);
        });
      });
      patchAttrs();
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
