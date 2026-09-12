(function () {
  "use strict";

  function start() {
    var canvas = document.getElementById("human-3d-canvas");
    if (!canvas) return;

    if (!window.THREE) {
      drawFallback(canvas);
      return;
    }

    var THREE = window.THREE;
    var stage = canvas.parentElement;
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (error) {
      drawFallback(canvas);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x0b1220, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(27, 1, 0.1, 100);
    camera.position.set(3.8, 1.5, 7.3);
    camera.lookAt(0, 1.55, 0);

    scene.add(new THREE.HemisphereLight(0x9ec9ff, 0x0b1220, 1.5));
    var keyLight = new THREE.DirectionalLight(0xb9e7ff, 2.4);
    keyLight.position.set(3.5, 5, 5);
    scene.add(keyLight);
    var rimLight = new THREE.PointLight(0x53dfc0, 2.2, 7);
    rimLight.position.set(-3, 2.6, 2.8);
    scene.add(rimLight);

    var subject = new THREE.Group();
    subject.position.y = 0.08;
    scene.add(subject);

    var bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x284766, roughness: 0.52, metalness: 0.18 });
    var bodyAccent = new THREE.MeshStandardMaterial({ color: 0x397189, roughness: 0.42, metalness: 0.22 });
    var skinMaterial = new THREE.MeshStandardMaterial({ color: 0xb87969, roughness: 0.72, metalness: 0.02 });
    var darkMaterial = new THREE.MeshStandardMaterial({ color: 0x182a42, roughness: 0.68, metalness: 0.08 });

    function mesh(geometry, material, position) {
      var item = new THREE.Mesh(geometry, material);
      item.position.set(position[0], position[1], position[2]);
      subject.add(item);
      return item;
    }

    function segment(from, to, radius, material) {
      var start = new THREE.Vector3(from[0], from[1], from[2]);
      var end = new THREE.Vector3(to[0], to[1], to[2]);
      var direction = new THREE.Vector3().subVectors(end, start);
      var item = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.92, direction.length(), 16), material);
      item.position.copy(start).add(end).multiplyScalar(0.5);
      item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      subject.add(item);
      return item;
    }

    mesh(new THREE.CapsuleGeometry(0.56, 1.18, 8, 20), bodyMaterial, [0, 2.15, 0]);
    mesh(new THREE.CapsuleGeometry(0.45, 0.26, 8, 16), darkMaterial, [0, 1.28, 0]);
    mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.25, 16), skinMaterial, [0, 3.02, 0]);
    mesh(new THREE.SphereGeometry(0.36, 24, 18), skinMaterial, [0, 3.42, 0]);

    segment([-0.58, 2.65, 0], [-0.96, 2.12, 0.02], 0.16, bodyAccent);
    segment([-0.96, 2.12, 0.02], [-1.22, 1.54, 0.04], 0.13, bodyAccent);
    segment([0.58, 2.65, 0], [0.96, 2.12, 0.02], 0.16, bodyAccent);
    segment([0.96, 2.12, 0.02], [1.22, 1.54, 0.04], 0.13, bodyAccent);
    mesh(new THREE.SphereGeometry(0.17, 16, 12), skinMaterial, [-1.27, 1.48, 0.04]);
    mesh(new THREE.SphereGeometry(0.17, 16, 12), skinMaterial, [1.27, 1.48, 0.04]);

    segment([-0.28, 1.25, 0], [-0.39, 0.47, 0.01], 0.2, darkMaterial);
    segment([-0.39, 0.47, 0.01], [-0.43, -0.28, 0.03], 0.16, bodyMaterial);
    segment([0.28, 1.25, 0], [0.39, 0.47, 0.01], 0.2, darkMaterial);
    segment([0.39, 0.47, 0.01], [0.43, -0.28, 0.03], 0.16, bodyMaterial);
    mesh(new THREE.BoxGeometry(0.34, 0.14, 0.55), darkMaterial, [-0.43, -0.38, 0.1]);
    mesh(new THREE.BoxGeometry(0.34, 0.14, 0.55), darkMaterial, [0.43, -0.38, 0.1]);

    var chestLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.3, 2.48, 0.53),
        new THREE.Vector3(0, 2.35, 0.58),
        new THREE.Vector3(0.3, 2.48, 0.53)
      ]),
      new THREE.LineBasicMaterial({ color: 0x5ccbbb, transparent: true, opacity: 0.7 })
    );
    subject.add(chestLine);

    function sensorMarker(color, position, size) {
      var marker = new THREE.Group();
      marker.position.set(position[0], position[1], position[2]);
      var point = new THREE.Mesh(
        new THREE.SphereGeometry(size || 0.1, 16, 12),
        new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 1.8, roughness: 0.28, metalness: 0.25 })
      );
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry((size || 0.1) * 1.75, 0.018, 8, 24),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.82 })
      );
      marker.add(point);
      marker.add(ring);
      subject.add(marker);
      marker.userData.phase = Math.random() * Math.PI * 2;
      return marker;
    }

    var sensors = [
      sensorMarker(0x63e2c3, [1.31, 1.53, 0.16], 0.1),
      sensorMarker(0x73aaf5, [-1.31, 1.53, 0.16], 0.1),
      sensorMarker(0xf1b35b, [0, 2.36, 0.62], 0.12),
      sensorMarker(0xff6f6f, [-0.26, 2.24, 0.58], 0.09)
    ];

    var floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.8, 64),
      new THREE.MeshBasicMaterial({ color: 0x102239, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.46;
    subject.add(floor);

    var floorRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.65, 0.012, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x386078, transparent: true, opacity: 0.72 })
    );
    floorRing.rotation.x = Math.PI / 2;
    floorRing.position.y = -0.44;
    subject.add(floorRing);

    function resize() {
      var rect = stage.getBoundingClientRect();
      var width = Math.max(1, rect.width);
      var height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    window.addEventListener("resize", resize);

    var last = performance.now();
    function animate(now) {
      var delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      subject.rotation.y += delta * 0.42;
      sensors.forEach(function (marker, index) {
        var pulse = 1 + Math.sin(now * 0.0032 + marker.userData.phase + index) * 0.08;
        marker.scale.setScalar(pulse);
      });
      renderer.render(scene, camera);
      window.requestAnimationFrame(animate);
    }
    window.requestAnimationFrame(animate);
    window.__human3d = { scene: scene, subject: subject, sensors: sensors, renderer: renderer, canvas: canvas, resize: resize };
  }

  function drawFallback(canvas) {
    canvas.classList.add("human-3d-fallback");
    var context = canvas.getContext("2d");
    if (!context) return;
    var start = performance.now();
    function draw(now) {
      var rect = canvas.getBoundingClientRect();
      var scale = Math.min(window.devicePixelRatio || 1, 2);
      var width = Math.max(1, Math.floor(rect.width * scale));
      var height = Math.max(1, Math.floor(rect.height * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      var cx = rect.width * 0.5;
      var cy = rect.height * 0.52;
      var sway = Math.sin((now - start) * 0.001) * 7;
      context.strokeStyle = "#397189";
      context.lineWidth = 16;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(cx, cy - 100);
      context.lineTo(cx, cy + 58);
      context.moveTo(cx - 4, cy + 48);
      context.lineTo(cx - 35 + sway, cy + 160);
      context.moveTo(cx + 4, cy + 48);
      context.lineTo(cx + 35 + sway, cy + 160);
      context.moveTo(cx - 38, cy - 74);
      context.lineTo(cx - 88 + sway, cy + 30);
      context.moveTo(cx + 38, cy - 74);
      context.lineTo(cx + 88 + sway, cy + 30);
      context.stroke();
      context.fillStyle = "#b87969";
      context.beginPath();
      context.arc(cx, cy - 140, 27, 0, Math.PI * 2);
      context.fill();
      [[cx - 92 + sway, cy + 30, "#73aaf5"], [cx + 92 + sway, cy + 30, "#63e2c3"], [cx, cy - 52, "#f1b35b"], [cx - 22, cy - 68, "#ff6f6f"]].forEach(function (point) {
        context.fillStyle = point[2];
        context.beginPath();
        context.arc(point[0], point[1], 8, 0, Math.PI * 2);
        context.fill();
      });
      window.requestAnimationFrame(draw);
    }
    window.requestAnimationFrame(draw);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
