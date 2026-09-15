import { useEffect, useRef } from "react";
import * as THREE from "three";

// Rough relative India layout (not literal lat/lon projection — scaled so
// the network reads correctly: Delhi north, Chennai/Bengaluru south,
// Kolkata east, Mumbai/Goa/Ahmedabad west).
const CITIES = [
  { code: "DEL", x: -0.15, z: -3.2 },
  { code: "AMD", x: -2.6, z: -1.1 },
  { code: "BOM", x: -2.3, z: 0.6 },
  { code: "PNQ", x: -1.9, z: 1.3 },
  { code: "GOI", x: -2.0, z: 2.4 },
  { code: "HYD", x: -0.3, z: 1.0 },
  { code: "BLR", x: -0.6, z: 2.7 },
  { code: "MAA", x: 0.9, z: 2.9 },
  { code: "CCU", x: 2.9, z: -0.6 },
];

const ROUTES = [
  ["DEL", "BOM"], ["DEL", "BLR"], ["DEL", "HYD"], ["DEL", "CCU"], ["DEL", "AMD"],
  ["BOM", "BLR"], ["BOM", "GOI"], ["BOM", "PNQ"], ["BOM", "HYD"],
  ["BLR", "HYD"], ["BLR", "MAA"], ["BLR", "CCU"],
  ["MAA", "CCU"], ["MAA", "HYD"], ["AMD", "BOM"],
];

const cityMap = Object.fromEntries(CITIES.map((c) => [c.code, c]));

export default function FlightNetwork3D({ className = "" }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth;
    let height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 4.2, 6.4);
    camera.lookAt(0, 0, 0);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // no WebGL — leave the panel empty rather than crash
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // --- Ground grid (radar-table feel) ---
    const grid = new THREE.GridHelper(9, 24, 0x38bdf8, 0x1a2235);
    grid.position.y = -0.02;
    grid.material.transparent = true;
    grid.material.opacity = 0.25;
    group.add(grid);

    // --- Starfield particles ---
    const starCount = 260;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 24;
      starPos[i * 3 + 1] = Math.random() * 8 + 0.5;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.025, transparent: true, opacity: 0.5 });
    scene.add(new THREE.Points(starGeo, starMat));

    // --- City nodes ---
    const nodeGeo = new THREE.SphereGeometry(0.045, 12, 12);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    Object.values(cityMap).forEach((c) => {
      const node = new THREE.Mesh(nodeGeo, nodeMat);
      node.position.set(c.x, 0.02, c.z);
      group.add(node);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.1, 24), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(c.x, 0.025, c.z);
      group.add(ring);
    });

    // --- Arcs between routes, plus a traveling pulse per arc ---
    const pulses = [];
    ROUTES.forEach(([a, b]) => {
      const from = cityMap[a];
      const to = cityMap[b];
      if (!from || !to) return;
      const start = new THREE.Vector3(from.x, 0.02, from.z);
      const end = new THREE.Vector3(to.x, 0.02, to.z);
      const mid = start.clone().lerp(end, 0.5);
      mid.y += start.distanceTo(end) * 0.35;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(40);
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 });
      group.add(new THREE.Line(geo, mat));

      const pulseGeo = new THREE.SphereGeometry(0.035, 8, 8);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
      const pulse = new THREE.Mesh(pulseGeo, pulseMat);
      group.add(pulse);
      pulses.push({ curve, mesh: pulse, t: Math.random(), speed: 0.08 + Math.random() * 0.06 });
    });

    group.rotation.x = -0.15;

    // --- Pointer parallax (no dependency needed) ---
    let targetRotY = 0.4;
    let targetRotX = -0.15;
    function onPointerMove(e) {
      const rect = mount.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      targetRotY = 0.4 + nx * 0.5;
      targetRotX = -0.15 + ny * 0.15;
    }
    mount.addEventListener("pointermove", onPointerMove);

    let frameId;
    const clock = new THREE.Clock();
    function animate() {
      const dt = clock.getDelta();
      group.rotation.y += (targetRotY - group.rotation.y) * 0.03;
      group.rotation.x += (targetRotX - group.rotation.x) * 0.03;

      pulses.forEach((p) => {
        p.t += dt * p.speed;
        if (p.t > 1) p.t = 0;
        const pos = p.curve.getPoint(p.t);
        p.mesh.position.copy(pos);
      });

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }
    animate();

    function onResize() {
      width = mount.clientWidth;
      height = mount.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className={className} />;
}
