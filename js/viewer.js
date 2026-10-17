// 3D 화면 공통 틀 (카메라, 조명, 마우스로 돌려보기)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Viewer {
  constructor({ grid = 400, shadows = true, background = '#e9f3ff' } = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.dom = this.renderer.domElement;
    this.dom.classList.add('three');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);
    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 30000);
    this.camera.position.set(160, 140, 200);
    this.controls = new OrbitControls(this.camera, this.dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.target.set(0, 20, 0);
    this.controls.maxPolarAngle = Math.PI * 0.495;

    const hemi = new THREE.HemisphereLight('#ffffff', '#b9c7d8', 1.4);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#ffffff', 2.0);
    sun.position.set(300, 600, 250);
    sun.castShadow = shadows;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -grid; sc.right = grid; sc.top = grid; sc.bottom = -grid; sc.near = 10; sc.far = 3000;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._onFrame = [];
    this.clock = new THREE.Clock();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      if (!this.dom.isConnected) return;
      this._resize();
      for (const f of this._onFrame) f(dt);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(loop);
  }

  onFrame(f) { this._onFrame.push(f); }

  mount(el) { el.append(this.dom); this._resize(true); }

  _resize(force) {
    const p = this.dom.parentElement;
    if (!p) return;
    const w = p.clientWidth, hgt = p.clientHeight;
    if (!w || !hgt) return;
    if (force || w !== this._w || hgt !== this._h) {
      this._w = w; this._h = hgt;
      this.renderer.setSize(w, hgt, false);
      this.dom.style.width = w + 'px';
      this.dom.style.height = hgt + 'px';
      this.camera.aspect = w / hgt;
      this.camera.updateProjectionMatrix();
    }
  }

  setPointer(e) {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster;
  }

  hits(e, objects, recursive = true) {
    this.setPointer(e);
    return this.raycaster.intersectObjects(objects, recursive);
  }

  // 물체가 화면에 꽉 차게 카메라 맞추기
  fit(obj, { pad = 1.4, dir = new THREE.Vector3(0.9, 0.75, 1.15) } = {}) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(30, box.getSize(new THREE.Vector3()).length() / 2);
    const dist = (r * pad) / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.controls.target.copy(c);
    this.camera.position.copy(c).add(dir.normalize().multiplyScalar(dist));
    this.camera.near = Math.max(0.5, dist / 200);
    this.camera.updateProjectionMatrix();
  }

  snapshot(w = 240, hgt = 180) {
    this.renderer.render(this.scene, this.camera);
    const c = document.createElement('canvas');
    c.width = w; c.height = hgt;
    c.getContext('2d').drawImage(this.dom, 0, 0, w, hgt);
    return c.toDataURL('image/jpeg', 0.8);
  }
}

export function makeGrid(size = 400, step = 10, color = '#c7d6ea', major = '#9fb4d1') {
  const g = new THREE.Group();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color: '#f8fbff', roughness: 1 }));
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  plane.name = 'ground';
  g.add(plane);
  const minor = new THREE.GridHelper(size, size / step, color, color);
  minor.position.y = 0.05;
  const big = new THREE.GridHelper(size, size / (step * 5), major, major);
  big.position.y = 0.1;
  g.add(minor, big);
  return g;
}
