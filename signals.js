(function () {
  var sourceData = null;
  var state = { playing: true, speed: 1, elapsed: 10, lastFrame: 0 };
  var palette = { bioz: "#6fe1c1", ppg: "#73aaf5", radar: "#f1b35b", ecg: "#ff7777" };
  var canvases = {};
  var valueNodes = {};

  function byId(id) { return document.getElementById(id); }
  function each(selector, callback) { Array.prototype.forEach.call(document.querySelectorAll(selector), callback); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function formatValue(key, value) {
    if (key === "bioz") return value.toFixed(1);
    if (key === "radar") return value.toFixed(4);
    return value.toFixed(3);
  }
  function getVisibleRange(values) {
    var end = Math.max(20, Math.round(state.elapsed / sourceData.windowSeconds * values.length));
    end = clamp(end, 20, values.length);
    var start = Math.max(0, end - Math.min(values.length, 600));
    return { start: start, end: end };
  }
  function formatClock(seconds) {
    var minutes = Math.floor(seconds / 60);
    var remainder = (seconds % 60).toFixed(1).padStart(4, "0");
    return String(minutes).padStart(2, "0") + ":" + remainder;
  }
  function normalize(values, start, end) {
    var min = Infinity;
    var max = -Infinity;
    for (var i = start; i < end; i += 1) {
      min = Math.min(min, values[i]);
      max = Math.max(max, values[i]);
    }
    if (!isFinite(min) || !isFinite(max)) return { min: -1, max: 1 };
    var pad = Math.max((max - min) * 0.12, 0.000001);
    return { min: min - pad, max: max + pad };
  }
  function resizeCanvas(canvas) {
    var ratio = window.devicePixelRatio || 1;
    var width = Math.max(canvas.clientWidth, 260);
    var height = Math.max(canvas.clientHeight, 140);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    return { width: width, height: height, ratio: ratio };
  }
  function drawGrid(ctx, width, height, ratio) {
    ctx.save();
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = "rgba(91,121,153,.18)";
    ctx.lineWidth = 1;
    for (var y = 1; y < 4; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(height * y / 4) + .5);
      ctx.lineTo(width, Math.round(height * y / 4) + .5);
      ctx.stroke();
    }
    for (var x = 1; x < 8; x += 1) {
      ctx.beginPath();
      ctx.moveTo(Math.round(width * x / 8) + .5, 0);
      ctx.lineTo(Math.round(width * x / 8) + .5, height);
      ctx.stroke();
    }
    ctx.restore();
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
  function drawChannel(key, channel) {
    var canvas = canvases[key];
    if (!canvas) return;
    var size = resizeCanvas(canvas);
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, size.width, size.height, size.ratio);
    var values = channel.values.slice();
    if (!values.length) return;
    var range = getVisibleRange(values);
    var plotted = values.slice(range.start, range.end);
    var displayValues = key === "bioz" ? smoothBioz(plotted) : plotted;
    if (!plotted.length) return;
    var bounds = normalize(displayValues, 0, displayValues.length);
    ctx.save();
    ctx.scale(size.ratio, size.ratio);
    var points = [];
    for (var i = 0; i < displayValues.length; i += 1) {
      var x = i / Math.max(displayValues.length - 1, 1) * size.width;
      var y = size.height - ((displayValues[i] - bounds.min) / (bounds.max - bounds.min)) * (size.height - 18) - 9;
      points.push({ x: x, y: y });
    }
    ctx.beginPath();
    if (key === "bioz") {
      drawSmoothPath(ctx, points);
    } else if (points.length) {
      ctx.moveTo(points[0].x, points[0].y);
      for (var linePoint = 1; linePoint < points.length; linePoint += 1) ctx.lineTo(points[linePoint].x, points[linePoint].y);
    }
    ctx.strokeStyle = palette[key];
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = palette[key];
    ctx.shadowBlur = 5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    var last = displayValues[displayValues.length - 1];
    var lastX = size.width;
    var lastY = size.height - ((last - bounds.min) / (bounds.max - bounds.min)) * (size.height - 18) - 9;
    ctx.fillStyle = palette[key];
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (valueNodes[key]) valueNodes[key].textContent = formatValue(key, last);
  }
  function drawAll() {
    if (!sourceData) return;
    Object.keys(sourceData.channels).forEach(function (key) { drawChannel(key, sourceData.channels[key]); });
    var clock = byId("wave-clock");
    if (clock) clock.textContent = formatClock(state.elapsed) + " / " + formatClock(sourceData.windowSeconds);
  }
  function frame(timestamp) {
    if (!state.lastFrame) state.lastFrame = timestamp;
    if (state.playing && sourceData) {
      state.elapsed += (timestamp - state.lastFrame) / 1000 * state.speed;
      if (state.elapsed >= sourceData.windowSeconds) state.elapsed = 0;
    }
    state.lastFrame = timestamp;
    drawAll();
    window.requestAnimationFrame(frame);
  }
  function setPlaying(playing) {
    state.playing = playing;
    var button = byId("wave-play");
    if (button) button.textContent = playing ? "Ⅱ 暂停" : "▶ 播放";
    var status = byId("wave-status");
    if (status) status.textContent = playing ? "真实样本回放" : "回放已暂停";
  }
  function init() {
    each(".signal-canvas", function (canvas) { canvases[canvas.dataset.signal] = canvas; });
    Object.keys(canvases).forEach(function (key) { valueNodes[key] = byId("wave-value-" + key); });
    var radarMeta = document.querySelector('.signal-canvas[data-signal="radar"]');
    if (radarMeta) radarMeta.closest(".signal-card").querySelector(".signal-meta span:last-child").textContent = "距离 bin 24 · 胸部运动相位";
    var windowLabel = document.querySelector(".wave-window-label");
    if (windowLabel) windowLabel.textContent = "时间窗 1 分钟";
    byId("wave-play").addEventListener("click", function () { setPlaying(!state.playing); });
    byId("wave-reset").addEventListener("click", function () { state.elapsed = 0; state.lastFrame = 0; setPlaying(true); drawAll(); });
    each(".wave-speed", function (button) {
      button.addEventListener("click", function () {
        state.speed = Number(button.dataset.speed) || 1;
        each(".wave-speed", function (item) { item.classList.toggle("active", item === button); });
      });
    });
    window.addEventListener("resize", drawAll);
    fetch("data/sensor-sample.json")
      .then(function (response) { if (!response.ok) throw new Error("signal data unavailable"); return response.json(); })
      .then(function (payload) {
        sourceData = payload;
        drawAll();
        window.requestAnimationFrame(frame);
      })
      .catch(function () {
        var status = byId("wave-status");
        if (status) status.textContent = "样本加载失败";
      });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
}());
