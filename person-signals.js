(function () {
  var sourceData = null;
  var activePerson = null;
  var pendingPerson = null;
  var playback = { elapsed: 0, lastFrame: 0 };
  var palette = { bioz: "#6fe1c1", ppg: "#73aaf5", radar: "#f1b35b", ecg: "#ff7777" };
  var descriptors = [
    { key: "bioz", shortLabel: "腕部阻抗", kicker: "WRIST BIO-Z", label: "腕部阻抗脉搏波", unit: "波形在线", value: function () { return "在线"; } },
    { key: "ppg", shortLabel: "PPG", kicker: "PPG", label: "光电容积脉搏波", unit: "SpO₂", value: function (person) { return person.spo2 + "%"; } },
    { key: "radar", shortLabel: "毫米波雷达", kicker: "MMWAVE RADAR", label: "毫米波雷达胸部呼吸", unit: "呼吸 /min", value: function (person) { return person.rr; } },
    { key: "ecg", shortLabel: "ECG", kicker: "ECG LEAD II", label: "心电 ECG 导联 II", unit: "HR bpm", value: function (person) { return person.hr; } }
  ];
  var statusByRisk = {
    green: { label: "Ⅰ级正常", hint: "指标稳定，波形规则" },
    blue: { label: "Ⅱ级注意", hint: "血氧轻微波动，建议复评" },
    amber: { label: "Ⅲ级预警", hint: "血氧下降，心率需要观察" },
    red: { label: "Ⅳ级危险", hint: "持续低氧伴心动过速" }
  };
  var wearIssues = {
    "P-008": { ppg: { state: "detached", score: 18, reason: "PPG 传感器疑似脱落" } },
    "P-012": { bioz: { state: "deviation", score: 54, reason: "腕带接触阻抗异常，疑似佩戴偏差" } },
    "P-006": { radar: { state: "deviation", score: 57, reason: "毫米波雷达胸部朝向偏移" } },
    "P-011": { ecg: { state: "detached", score: 22, reason: "ECG 电极接触中断" } }
  };
  var baseReliability = { bioz: 96, ppg: 98, radar: 94, ecg: 97 };

  function byId(id) { return document.getElementById(id); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function statusFor(person) { return statusByRisk[person.risk] || statusByRisk.green; }
  function severityFor(person) { return ({ green: 0, blue: 0.16, amber: 0.38, red: 0.72 })[person.risk] || 0; }
  function assessReliability(person, descriptor) {
    var issue = wearIssues[person.id] && wearIssues[person.id][descriptor.key];
    if (issue) return { key: descriptor.key, score: issue.score, state: issue.state, reason: issue.reason };
    var numericId = Number(String(person.id).replace(/\D/g, "")) || 1;
    var score = clamp(baseReliability[descriptor.key] + ((numericId * 7 + descriptor.key.length) % 5) - 2, 0, 100);
    return { key: descriptor.key, score: score, state: score < 85 ? "attention" : "good", reason: score < 85 ? "波形噪声偏高，已降低权重" : "波形稳定，可用于风险判断" };
  }
  function reliabilityLabel(assessment) {
    return assessment.state === "detached" ? "已脱落" : assessment.state === "deviation" ? "佩戴偏差" : assessment.state === "attention" ? "需关注" : "可靠";
  }
  function resizeCanvas(canvas) {
    var ratio = window.devicePixelRatio || 1;
    var width = Math.max(canvas.clientWidth, 240);
    var height = Math.max(canvas.clientHeight, 104);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    return { width: width, height: height, ratio: ratio };
  }
  function smoothBioz(values) {
    return values.map(function (value, index) {
      var previous = values[index > 0 ? index - 1 : index];
      var next = values[index < values.length - 1 ? index + 1 : index];
      return (previous + 4 * value + next) / 6;
    });
  }
  function drawSmoothPath(ctx, points) {
    if (!points.length) return;
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 0; i < points.length - 1; i += 1) {
      var previous = points[i - 1] || points[i];
      var current = points[i];
      var next = points[i + 1];
      var following = points[i + 2] || next;
      var controlOne = { x: current.x + (next.x - previous.x) / 6, y: current.y + (next.y - previous.y) / 6 };
      var controlTwo = { x: next.x - (following.x - current.x) / 6, y: next.y - (following.y - current.y) / 6 };
      ctx.bezierCurveTo(controlOne.x, controlOne.y, controlTwo.x, controlTwo.y, next.x, next.y);
    }
  }
  function drawGrid(ctx, width, height, ratio) {
    ctx.save();
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = "rgba(91,121,153,.2)";
    ctx.lineWidth = 1;
    for (var y = 1; y < 4; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(height * y / 4) + 0.5);
      ctx.lineTo(width, Math.round(height * y / 4) + 0.5);
      ctx.stroke();
    }
    for (var x = 1; x < 6; x += 1) {
      ctx.beginPath();
      ctx.moveTo(Math.round(width * x / 6) + 0.5, 0);
      ctx.lineTo(Math.round(width * x / 6) + 0.5, height);
      ctx.stroke();
    }
    ctx.restore();
  }
  function personSeries(values) {
    return values.slice();
  }
  function drawCard(card, descriptor) {
    if (!sourceData || !activePerson) return;
    var channel = sourceData.channels[descriptor.key];
    var canvas = card.querySelector("canvas");
    if (!channel || !canvas) return;
    var values = personSeries(channel.values, activePerson, descriptor.key);
    if (!values.length) return;
    var end = clamp(Math.max(20, Math.round(playback.elapsed / sourceData.windowSeconds * values.length)), 20, values.length);
    var start = Math.max(0, end - Math.min(values.length, 600));
    var plotted = values.slice(start, end);
    var displayValues = descriptor.key === "bioz" ? smoothBioz(plotted) : plotted;
    if (!plotted.length) return;
    var min = Infinity;
    var max = -Infinity;
    displayValues.forEach(function (value) { min = Math.min(min, value); max = Math.max(max, value); });
    var pad = Math.max((max - min) * 0.14, 0.000001);
    min -= pad;
    max += pad;
    var size = resizeCanvas(canvas);
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, size.width, size.height, size.ratio);
    ctx.save();
    ctx.scale(size.ratio, size.ratio);
    var points = [];
    for (var point = 0; point < displayValues.length; point += 1) {
      var px = point / Math.max(displayValues.length - 1, 1) * size.width;
      var py = size.height - ((displayValues[point] - min) / (max - min)) * (size.height - 14) - 7;
      points.push({ x: px, y: py });
    }
    ctx.beginPath();
    if (descriptor.key === "bioz") {
      drawSmoothPath(ctx, points);
    } else if (points.length) {
      ctx.moveTo(points[0].x, points[0].y);
      for (var linePoint = 1; linePoint < points.length; linePoint += 1) ctx.lineTo(points[linePoint].x, points[linePoint].y);
    }
    ctx.strokeStyle = palette[descriptor.key];
    ctx.lineWidth = 1.8;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = palette[descriptor.key];
    ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.restore();
  }
  function drawAll() {
    var host = byId("modal-signal-grid");
    if (!host || !activePerson) return;
    Array.prototype.forEach.call(host.querySelectorAll(".person-signal-card"), function (card) {
      var descriptor = descriptors.find(function (item) { return item.key === card.getAttribute("data-signal"); });
      if (descriptor) drawCard(card, descriptor);
    });
  }
  function renderPersonSignals(person) {
    pendingPerson = person;
    activePerson = person;
    var host = byId("modal-signal-grid");
    if (!host || !sourceData) return;
    var status = statusFor(person);
    var assessments = descriptors.map(function (descriptor) {
      return { descriptor: descriptor, assessment: assessReliability(person, descriptor) };
    });
    var reliable = assessments.filter(function (entry) { return entry.assessment.state === "good" || entry.assessment.state === "attention"; });
    var removed = assessments.filter(function (entry) { return entry.assessment.state === "detached" || entry.assessment.state === "deviation"; });
    var quality = Math.round(assessments.reduce(function (sum, entry) { return sum + entry.assessment.score; }, 0) / Math.max(assessments.length, 1));
    var qualityNode = byId("modal-signal-quality");
    if (qualityNode) qualityNode.textContent = "可靠性 " + quality + "%";
    var summary = byId("modal-signal-reliability");
    if (summary) {
      summary.innerHTML = '<div class="reliability-top"><strong>信号可靠性评估</strong><span>保留 ' + reliable.length + '/' + assessments.length + ' 路</span><b>' + quality + '%</b></div>' +
        '<div class="reliability-list">' + assessments.map(function (entry) {
          var assessment = entry.assessment;
          return '<span class="reliability-chip ' + assessment.state + '"><b>' + entry.descriptor.shortLabel + '</b><em>' + reliabilityLabel(assessment) + '</em><small>' + assessment.score + '%</small></span>';
        }).join("") + '</div><div class="signal-processing-note"><b>原始信号回放</b><span>PPG、毫米波、ECG 直接绘制原始采样点；BioZ 仅做轻量显示平滑</span></div>';
    }
    var warning = byId("modal-signal-warning");
    if (warning) {
      if (removed.length) {
        var removedNames = removed.map(function (entry) { return entry.descriptor.shortLabel; }).join("、");
        var removedReasons = removed.map(function (entry) {
          var action = entry.assessment.state === "detached" ? "请重新佩戴并确认贴合度" : "请调整传感器位置后重试";
          return entry.descriptor.shortLabel + "：" + entry.assessment.reason + "，" + action;
        }).join("；");
        warning.className = "signal-reliability-warning visible";
        warning.innerHTML = '<span class="warning-icon">!</span><div><strong>已过滤 ' + removedNames + ' 不可靠信号</strong><p>' + removedReasons + '。过滤通道不会参与风险判断，恢复可靠后将自动重新接入。</p></div>';
      } else {
        warning.className = "signal-reliability-warning";
        warning.innerHTML = "";
      }
    }
    host.innerHTML = reliable.map(function (entry) {
      var descriptor = entry.descriptor;
      var assessment = entry.assessment;
      return '<article class="person-signal-card ' + person.risk + ' ' + assessment.state + '" data-signal="' + descriptor.key + '">' +
        '<div class="person-signal-head"><div><span class="signal-kicker">' + descriptor.kicker + '</span><strong>' + descriptor.label + '</strong></div>' +
        '<div class="person-signal-reading"><b>' + descriptor.value(person) + '</b><span>' + descriptor.unit + '</span></div></div>' +
        '<div class="person-signal-status"><i></i><b>' + reliabilityLabel(assessment) + ' ' + assessment.score + '%</b><span>' + assessment.reason + ' · ' + status.label + '</span></div>' +
        '<canvas aria-label="' + descriptor.label + '动态曲线"></canvas></article>';
    }).join("");
    if (!reliable.length) host.innerHTML = '<div class="signal-empty-state">暂无可靠波形，待传感器恢复后自动接入</div>';
    playback.elapsed = 0;
    playback.lastFrame = 0;
    drawAll();
  }
  function frame(timestamp) {
    if (!playback.lastFrame) playback.lastFrame = timestamp;
    if (activePerson && sourceData && byId("person-modal") && byId("person-modal").classList.contains("open")) {
      playback.elapsed += (timestamp - playback.lastFrame) / 1000;
      if (playback.elapsed >= sourceData.windowSeconds) playback.elapsed = 0;
      drawAll();
    }
    playback.lastFrame = timestamp;
    window.requestAnimationFrame(frame);
  }

  window.renderPersonSignals = renderPersonSignals;
  fetch("data/sensor-sample.json")
    .then(function (response) { if (!response.ok) throw new Error("signal data unavailable"); return response.json(); })
    .then(function (payload) {
      sourceData = payload;
      if (pendingPerson) renderPersonSignals(pendingPerson);
      window.requestAnimationFrame(frame);
    })
    .catch(function () { /* The person detail remains usable when samples are unavailable. */ });
}());
