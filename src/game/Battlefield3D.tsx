import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { cardById } from "./content";
import type { BattleState, LaneIndex } from "./types";

type CameraBookmark = "near" | "design" | "far";
type DebugMode = "final" | "noPost" | "normals";
type QualityTier = "low" | "high";

const battleVisualContract = {
  subject: "竖屏三路汉末军阵沙盘",
  identity: ["三条纵深军路", "鎏金军势标记", "黑漆与朱砂阵营", "低模将魂棋子"],
  silhouette: ["敌我营帐在画面两端始终可见", "三路边界从远景到近景清晰", "将魂尺寸明显大于兵卒"],
  materialSeparation: ["宣纸地面高粗糙", "黑漆中等反射", "鎏金高金属度", "火焰为自发光粒子"],
  motion: ["棋子入阵弹性落位", "军势印沿军路推进", "火、风、旗帜持续运动"],
  cameraEnvelope: { near: 11, design: 15.5, far: 20 },
  lightingEnvelope: ["无后处理时仍可读", "暖主光和冷轮廓光分离阵营"],
  invariants: ["点击任意军路必须命中正确 laneIndex", "三路同宽", "火焰不遮挡军势印", "低档保持完整规则信号"],
  allowedDivergences: ["采用程序化低模棋子而非写实人物", "不使用 bloom 以控制 iOS 功耗"],
  frameBudgetMs: 16.7,
  memoryBudgetMB: 96
} as const;

type Props = {
  battle: BattleState;
  selectedCardId?: string;
  tutorialStep: number | null;
  reducedMotion: boolean;
  onLaneSelect: (lane: LaneIndex) => void;
  onCardDrop: (cardId: string, lane: LaneIndex) => void;
};

type SceneRuntime = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  dynamic: THREE.Group;
  laneMeshes: THREE.Mesh[];
  laneMaterials: THREE.MeshStandardMaterial[];
  momentumSeals: THREE.Group[];
  firePools: Array<{ points: THREE.Points; positions: Float32Array; seeds: Float32Array; burn: number }>;
  wetDiscs: THREE.Mesh[];
  windRibbons: THREE.Line[];
  shared: ReturnType<typeof createSharedAssets>;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  animationId: number;
  paused: boolean;
  quality: QualityTier;
  debugMode: DebugMode;
  cameraBookmark: CameraBookmark;
  startTime: number;
  lastFrame: number;
  frameAccumulator: number;
  frameCount: number;
  lastMetricsAt: number;
  pointerTarget: THREE.Vector2;
  selectedLane: number;
  reducedMotion: boolean;
};

export function Battlefield3D({ battle, selectedCardId, tutorialStep, reducedMotion, onLaneSelect, onCardDrop }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const battleRef = useRef(battle);
  const callbacksRef = useRef({ onLaneSelect, onCardDrop });
  const [metrics, setMetrics] = useState({ fps: 60, calls: 0, triangles: 0 });
  const [debugOpen, setDebugOpen] = useState(() => new URLSearchParams(window.location.search).get("debug3d") === "1");
  const [quality, setQuality] = useState<QualityTier>(() => window.devicePixelRatio > 2 ? "low" : "high");
  const [debugMode, setDebugMode] = useState<DebugMode>("final");
  const [cameraBookmark, setCameraBookmark] = useState<CameraBookmark>("design");
  const [paused, setPaused] = useState(false);
  const [visualSeed, setVisualSeed] = useState(battle.seed);
  const [vfxDebug, setVfxDebug] = useState(false);

  battleRef.current = battle;
  callbacksRef.current = { onLaneSelect, onCardDrop };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const runtime = createScene(host, visualSeed, quality, (next) => setMetrics(next));
    runtimeRef.current = runtime;
    syncBattle(runtime, battle, selectedCardId, tutorialStep, reducedMotion);

    const resizeObserver = new ResizeObserver(() => resize(runtime, host));
    resizeObserver.observe(host);
    resize(runtime, host);

    const pointerMove = (event: PointerEvent) => {
      const rect = runtime.renderer.domElement.getBoundingClientRect();
      runtime.pointerTarget.set((event.clientX - rect.left) / rect.width * 2 - 1, (event.clientY - rect.top) / rect.height * 2 - 1);
    };
    const pointerUp = (event: PointerEvent) => {
      const lane = pickLane(runtime, event.clientX, event.clientY);
      if (lane !== null) callbacksRef.current.onLaneSelect(lane);
    };
    const dragOver = (event: DragEvent) => event.preventDefault();
    const drop = (event: DragEvent) => {
      event.preventDefault();
      const cardId = event.dataTransfer?.getData("text/card");
      const lane = pickLane(runtime, event.clientX, event.clientY);
      if (cardId && lane !== null) callbacksRef.current.onCardDrop(cardId, lane);
    };
    runtime.renderer.domElement.addEventListener("pointermove", pointerMove);
    runtime.renderer.domElement.addEventListener("pointerup", pointerUp);
    runtime.renderer.domElement.addEventListener("dragover", dragOver);
    runtime.renderer.domElement.addEventListener("drop", drop);
    animate(runtime, () => battleRef.current, (next) => setMetrics(next));

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(runtime.animationId);
      runtime.renderer.domElement.removeEventListener("pointermove", pointerMove);
      runtime.renderer.domElement.removeEventListener("pointerup", pointerUp);
      runtime.renderer.domElement.removeEventListener("dragover", dragOver);
      runtime.renderer.domElement.removeEventListener("drop", drop);
      disposeScene(runtime);
      runtime.renderer.dispose();
      runtime.renderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, [visualSeed]);

  useEffect(() => {
    if (runtimeRef.current) syncBattle(runtimeRef.current, battle, selectedCardId, tutorialStep, reducedMotion);
  }, [battle, reducedMotion, selectedCardId, tutorialStep]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.quality = quality;
    runtime.renderer.setPixelRatio(quality === "high" ? Math.min(window.devicePixelRatio, 1.75) : 1);
    runtime.renderer.shadowMap.enabled = quality === "high";
    runtime.firePools.forEach((pool) => pool.points.geometry.setDrawRange(0, quality === "high" ? 54 : 24));
    resize(runtime, hostRef.current!);
  }, [quality]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.debugMode = debugMode;
    runtime.scene.overrideMaterial = debugMode === "normals" ? new THREE.MeshNormalMaterial() : null;
    runtime.renderer.toneMapping = debugMode === "noPost" ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  }, [debugMode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.cameraBookmark = cameraBookmark;
    applyCameraBookmark(runtime.camera, cameraBookmark);
  }, [cameraBookmark]);

  useEffect(() => { if (runtimeRef.current) runtimeRef.current.paused = paused; }, [paused]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (vfxDebug) {
      runtime.firePools.forEach((pool, index) => { pool.burn = 5 - index; pool.points.visible = true; });
      runtime.wetDiscs.forEach((disc, index) => { disc.visible = index === 1; });
      runtime.windRibbons.forEach((line) => { line.visible = true; });
    } else {
      syncBattle(runtime, battle, selectedCardId, tutorialStep, reducedMotion);
    }
  }, [battle, reducedMotion, selectedCardId, tutorialStep, vfxDebug, visualSeed]);

  return <div className={`battlefield-3d ${selectedCardId ? "has-selection" : ""} ${tutorialStep === 0 ? "tutorial-intent-target" : ""} ${tutorialStep === 2 ? "tutorial-lane-target" : ""}`}>
    <div ref={hostRef} className="battlefield-canvas-host" aria-label="可交互的三路 3D 战场" />
    <div className="scene-intent-strip" aria-hidden="true">{[0, 1, 2].map((lane) => { const intents = battle.intent.filter((intent) => intent.lane === lane); const power = intents.reduce((sum, intent) => sum + intent.power, 0); return <div key={lane} className={power ? "danger" : "quiet"}><span>{intents[0]?.label || "按兵"}</span><strong>{power || "—"}</strong></div>; })}</div>
    <div className="scene-lane-labels" aria-hidden="true">{battle.lanes.map((lane, index) => <span key={index}><b>{["上", "中", "下"][index]}</b><i className={lane.momentum > 0 ? "positive" : lane.momentum < 0 ? "negative" : ""}>{lane.momentum > 0 ? `+${lane.momentum}` : lane.momentum}</i></span>)}</div>
    {selectedCardId && <div className="scene-deploy-hint">点击 3D 战场的一条军路部署</div>}
    <button className="scene-debug-toggle" aria-label="3D 调试" onClick={() => setDebugOpen((value) => !value)}>3D</button>
    {debugOpen && <div className="scene-debug-panel">
      <strong>3D VISUAL DEBUG</strong>
      <span>{metrics.fps} FPS · {metrics.calls} draws · {metrics.triangles.toLocaleString()} tris</span>
      <span>Budget {battleVisualContract.frameBudgetMs} ms</span>
      <span>Seed {visualSeed}</span>
      <label>画质<select value={quality} onChange={(event) => setQuality(event.target.value as QualityTier)}><option value="low">Low</option><option value="high">High</option></select></label>
      <label>镜头<select value={cameraBookmark} onChange={(event) => setCameraBookmark(event.target.value as CameraBookmark)}><option value="near">Near</option><option value="design">Design</option><option value="far">Far</option></select></label>
      <label>诊断<select value={debugMode} onChange={(event) => setDebugMode(event.target.value as DebugMode)}><option value="final">Final</option><option value="noPost">No post</option><option value="normals">Normals</option></select></label>
      <button onClick={() => setPaused((value) => !value)}>{paused ? "Resume" : "Pause"}</button>
      <button onClick={() => setVfxDebug((value) => !value)}>{vfxDebug ? "Battle VFX" : "VFX stress"}</button>
      <div className="scene-seed-actions"><button onClick={() => setVisualSeed(battle.seed)}>Reset seed</button><button onClick={() => setVisualSeed(battle.seed ^ 0x5f3759df)}>Stress seed</button></div>
    </div>}
  </div>;
}

function createScene(host: HTMLDivElement, seed: number, quality: QualityTier, onMetrics: (metrics: { fps: number; calls: number; triangles: number }) => void): SceneRuntime {
  const renderer = new THREE.WebGLRenderer({ antialias: quality === "high", alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = quality === "high";
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(quality === "high" ? Math.min(window.devicePixelRatio, 1.75) : 1);
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", "三路军阵 3D 战场，点击军路部署选中的卡牌");
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x11100d);
  scene.fog = new THREE.FogExp2(0x17130e, 0.035);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  applyCameraBookmark(camera, "design");

  const root = new THREE.Group();
  const dynamic = new THREE.Group();
  root.add(dynamic);
  scene.add(root);
  const shared = createSharedAssets(seed);

  const ambient = new THREE.HemisphereLight(0xe9d39f, 0x151c1d, 1.6);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffd69a, 3.1);
  key.position.set(-5, 10, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 9; key.shadow.camera.bottom = -9;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6ea0b4, 1.8);
  rim.position.set(6, 5, -8);
  scene.add(rim);

  const base = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.35, 15), shared.materials.inkStone);
  base.position.y = -0.3;
  base.receiveShadow = true;
  root.add(base);
  const battlefield = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 14.6), shared.materials.paperGround);
  battlefield.rotation.x = -Math.PI / 2;
  battlefield.position.y = -0.11;
  battlefield.receiveShadow = true;
  root.add(battlefield);

  const laneMeshes: THREE.Mesh[] = [];
  const laneMaterials: THREE.MeshStandardMaterial[] = [];
  const laneXs = [-3.35, 0, 3.35];
  laneXs.forEach((x, lane) => {
    const material = shared.materials.lane.clone();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.08, 13.4), material);
    mesh.position.set(x, 0, 0);
    mesh.receiveShadow = true;
    mesh.userData.lane = lane;
    root.add(mesh);
    laneMeshes.push(mesh);
    laneMaterials.push(material);
    for (let marker = -2; marker <= 2; marker += 1) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.03, 0.035), shared.materials.goldDim);
      line.position.set(x, 0.07, marker * 2.2);
      root.add(line);
    }
  });

  root.add(createCommandGate(shared, false));
  const enemyGate = createCommandGate(shared, true);
  enemyGate.position.z = -0.2;
  root.add(enemyGate);

  const mountainMaterial = shared.materials.mountain;
  for (let index = 0; index < 9; index += 1) {
    const random = seeded(seed + index * 17);
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(1.3 + random() * 1.8, 2.5 + random() * 3, 4), mountainMaterial);
    mountain.position.set((random() - .5) * 18, 0.4, -8 - random() * 5);
    mountain.rotation.y = random() * Math.PI;
    root.add(mountain);
  }

  const momentumSeals = laneXs.map((x) => {
    const seal = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .12, 12), shared.materials.gold);
    disc.rotation.z = Math.PI / 2;
    disc.castShadow = true;
    seal.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.42, .05, 6, 16), shared.materials.goldBright);
    ring.rotation.x = Math.PI / 2;
    seal.add(ring);
    seal.position.set(x, .35, 0);
    root.add(seal);
    return seal;
  });

  const firePools = laneXs.map((x, lane) => createFirePool(root, x, lane, seed, shared));
  const wetDiscs = laneXs.map((x) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), shared.materials.wet);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, .075, 0.2);
    disc.visible = false;
    root.add(disc);
    return disc;
  });
  const windRibbons = laneXs.map((x, lane) => {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x - .8, .4, 5), new THREE.Vector3(x + .6, .8, 1), new THREE.Vector3(x - .5, 1.1, -3), new THREE.Vector3(x + .7, 1.4, -6)]);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
    const line = new THREE.Line(geometry, shared.materials.wind);
    line.visible = false;
    line.userData.phase = lane * .33;
    root.add(line);
    return line;
  });

  return {
    renderer, scene, camera, root, dynamic, laneMeshes, laneMaterials, momentumSeals, firePools, wetDiscs, windRibbons, shared,
    raycaster: new THREE.Raycaster(), pointer: new THREE.Vector2(), animationId: 0, paused: false, quality, debugMode: "final", cameraBookmark: "design",
    startTime: performance.now(), lastFrame: performance.now(), frameAccumulator: 0, frameCount: 0, lastMetricsAt: performance.now(), pointerTarget: new THREE.Vector2(), selectedLane: -1, reducedMotion: false
  };
}

function createSharedAssets(seed: number) {
  const paperTexture = createPaperTexture(seed);
  const fireTexture = createFireTexture();
  const materials = {
    paperGround: new THREE.MeshStandardMaterial({ color: 0xc7b486, map: paperTexture, roughness: .94, metalness: 0, bumpMap: paperTexture, bumpScale: .025 }),
    lane: new THREE.MeshStandardMaterial({ color: 0x3c3327, roughness: .78, metalness: .05, emissive: 0x000000, emissiveIntensity: 0 }),
    inkStone: new THREE.MeshStandardMaterial({ color: 0x161714, roughness: .66, metalness: .12 }),
    redLacquer: new THREE.MeshStandardMaterial({ color: 0x6e1715, roughness: .34, metalness: .28 }),
    blackLacquer: new THREE.MeshStandardMaterial({ color: 0x15191a, roughness: .38, metalness: .22 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xa87727, roughness: .28, metalness: .76 }),
    goldBright: new THREE.MeshStandardMaterial({ color: 0xffcb67, emissive: 0x5a2f02, emissiveIntensity: .55, roughness: .22, metalness: .72 }),
    goldDim: new THREE.MeshStandardMaterial({ color: 0x6d5833, roughness: .55, metalness: .42 }),
    player: new THREE.MeshStandardMaterial({ color: 0xc5a65c, roughness: .5, metalness: .28 }),
    playerGeneral: new THREE.MeshStandardMaterial({ color: 0xe2c26f, emissive: 0x3a2405, emissiveIntensity: .25, roughness: .32, metalness: .58 }),
    enemy: new THREE.MeshStandardMaterial({ color: 0x7f211d, roughness: .5, metalness: .2 }),
    enemyElite: new THREE.MeshStandardMaterial({ color: 0x9f3028, emissive: 0x310503, emissiveIntensity: .22, roughness: .38, metalness: .35 }),
    mountain: new THREE.MeshStandardMaterial({ color: 0x252824, roughness: 1, metalness: 0, flatShading: true }),
    wet: new THREE.MeshPhysicalMaterial({ color: 0x487a91, transparent: true, opacity: .45, roughness: .12, metalness: 0, clearcoat: .8, clearcoatRoughness: .1, depthWrite: false }),
    fire: new THREE.PointsMaterial({ color: 0xff8b32, map: fireTexture, alphaTest: .015, size: .25, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }),
    wind: new THREE.LineBasicMaterial({ color: 0x9fd7c7, transparent: true, opacity: .48, blending: THREE.AdditiveBlending, depthWrite: false })
  };
  const geometries = {
    body: new THREE.CylinderGeometry(.22, .32, .72, 6),
    head: new THREE.SphereGeometry(.19, 8, 6),
    hat: new THREE.ConeGeometry(.27, .24, 8),
    spear: new THREE.CylinderGeometry(.025, .025, 1.2, 5),
    base: new THREE.CylinderGeometry(.36, .42, .12, 12),
    generalBase: new THREE.CylinderGeometry(.46, .52, .16, 12),
    flagPole: new THREE.CylinderGeometry(.025, .025, 1.7, 5),
    flag: new THREE.PlaneGeometry(.62, .42, 2, 1),
    tacticDisc: new THREE.CylinderGeometry(.38, .38, .1, 16),
    tacticRing: new THREE.TorusGeometry(.46, .055, 6, 20)
  };
  return { materials, geometries, paperTexture, fireTexture };
}

function createPaperTexture(seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#c9b789";
  context.fillRect(0, 0, 256, 256);
  const random = seeded(seed);
  for (let index = 0; index < 1600; index += 1) {
    const value = Math.floor(125 + random() * 65);
    context.strokeStyle = `rgba(${value},${value - 12},${value - 28},${.025 + random() * .05})`;
    context.beginPath();
    const x = random() * 256;
    const y = random() * 256;
    context.moveTo(x, y);
    context.lineTo(x + 4 + random() * 22, y + (random() - .5) * 2);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 4);
  texture.anisotropy = 4;
  return texture;
}

function createFireTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 31);
  gradient.addColorStop(0, "rgba(255,255,220,1)");
  gradient.addColorStop(.22, "rgba(255,192,78,.96)");
  gradient.addColorStop(.58, "rgba(255,82,22,.62)");
  gradient.addColorStop(1, "rgba(90,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createCommandGate(shared: ReturnType<typeof createSharedAssets>, enemy: boolean) {
  const group = new THREE.Group();
  const z = enemy ? -7.05 : 7.05;
  group.position.z = z;
  const material = enemy ? shared.materials.redLacquer : shared.materials.blackLacquer;
  const platform = new THREE.Mesh(new THREE.BoxGeometry(9.9, .5, .75), material);
  platform.position.y = .1;
  platform.castShadow = platform.receiveShadow = true;
  group.add(platform);
  [-4.2, 4.2].forEach((x) => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.45, .85), material);
    tower.position.set(x, .85, 0);
    tower.castShadow = true;
    group.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(.78, .45, 4), shared.materials.goldDim);
    roof.position.set(x, 1.72, 0);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
  });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .8), enemy ? shared.materials.enemy : shared.materials.player);
  banner.position.set(0, 1.25, enemy ? .43 : -.43);
  banner.rotation.y = enemy ? 0 : Math.PI;
  group.add(banner);
  return group;
}

function createPawn(shared: ReturnType<typeof createSharedAssets>, enemy: boolean, general: boolean, seed: number) {
  const group = new THREE.Group();
  const material = enemy ? general ? shared.materials.enemyElite : shared.materials.enemy : general ? shared.materials.playerGeneral : shared.materials.player;
  const base = new THREE.Mesh(general ? shared.geometries.generalBase : shared.geometries.base, general ? shared.materials.gold : shared.materials.blackLacquer);
  base.castShadow = true;
  group.add(base);
  const body = new THREE.Mesh(shared.geometries.body, material);
  body.position.y = .5;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(shared.geometries.head, material);
  head.position.y = .98;
  head.castShadow = true;
  group.add(head);
  const hat = new THREE.Mesh(shared.geometries.hat, general ? shared.materials.goldBright : shared.materials.blackLacquer);
  hat.position.y = 1.18;
  group.add(hat);
  const spear = new THREE.Mesh(shared.geometries.spear, shared.materials.goldDim);
  spear.position.set(enemy ? -.26 : .26, .7, 0);
  spear.rotation.z = enemy ? -.16 : .16;
  group.add(spear);
  if (general) {
    const pole = new THREE.Mesh(shared.geometries.flagPole, shared.materials.goldDim);
    pole.position.set(enemy ? .45 : -.45, .78, 0);
    group.add(pole);
    const flag = new THREE.Mesh(shared.geometries.flag, enemy ? shared.materials.redLacquer : shared.materials.player);
    flag.position.set(enemy ? .72 : -.72, 1.36, 0);
    flag.rotation.y = enemy ? 0 : Math.PI;
    flag.userData.flagPhase = seeded(seed)();
    group.add(flag);
  }
  group.userData.spawnTime = performance.now();
  group.userData.baseY = 0;
  group.userData.general = general;
  return group;
}

function createTacticMarker(shared: ReturnType<typeof createSharedAssets>, effect?: string) {
  const group = new THREE.Group();
  const material = effect === "burn" ? shared.materials.redLacquer : effect === "wet" || effect === "borrowArrows" ? shared.materials.wet : effect === "wind" ? shared.materials.player : shared.materials.gold;
  const disc = new THREE.Mesh(shared.geometries.tacticDisc, material);
  disc.castShadow = true;
  group.add(disc);
  const ring = new THREE.Mesh(shared.geometries.tacticRing, shared.materials.goldBright);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = .05;
  group.add(ring);
  group.userData.spawnTime = performance.now();
  group.userData.baseY = 0;
  group.userData.general = false;
  group.userData.tactic = true;
  return group;
}

function createFirePool(root: THREE.Group, x: number, lane: number, seed: number, shared: ReturnType<typeof createSharedAssets>) {
  const count = 54;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  const random = seeded(seed + 900 + lane * 71);
  for (let index = 0; index < count; index += 1) {
    seeds[index * 4] = random();
    seeds[index * 4 + 1] = random();
    seeds[index * 4 + 2] = random();
    seeds[index * 4 + 3] = random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, shared.materials.fire);
  points.position.x = x;
  points.visible = false;
  points.frustumCulled = false;
  root.add(points);
  return { points, positions, seeds, burn: 0 };
}

function syncBattle(runtime: SceneRuntime, battle: BattleState, selectedCardId: string | undefined, tutorialStep: number | null, reducedMotion: boolean) {
  runtime.reducedMotion = reducedMotion;
  clearDynamic(runtime.dynamic);
  const laneXs = [-3.35, 0, 3.35];
  battle.intent.forEach((intent, index) => {
    const pawn = createPawn(runtime.shared, true, intent.power >= 7 || battle.enemyMaxHp >= 45, battle.seed + battle.beat * 31 + index);
    const laneIntentIndex = battle.intent.filter((item, itemIndex) => item.lane === intent.lane && itemIndex < index).length;
    pawn.position.set(laneXs[intent.lane] + (laneIntentIndex - .5) * .55, 0.12, -4.3 + laneIntentIndex * .72);
    pawn.rotation.y = Math.PI;
    pawn.scale.setScalar(intent.power >= 7 ? 1.15 : .9);
    runtime.dynamic.add(pawn);
  });
  battle.lanes.forEach((lane, laneIndex) => {
    lane.playerCards.forEach((queued, index) => {
      const card = cardById.get(queued.cardId);
      const piece = card?.kind === "stratagem" ? createTacticMarker(runtime.shared, card.effect) : createPawn(runtime.shared, false, card?.kind === "general", battle.seed + battle.beat * 79 + index + laneIndex * 11);
      piece.position.set(laneXs[laneIndex] + (index - (lane.playerCards.length - 1) / 2) * .62, card?.kind === "stratagem" ? .24 : .12, 4.15 - index * .5);
      piece.scale.setScalar(card?.kind === "general" ? 1.12 : card?.kind === "stratagem" ? .82 : .86);
      runtime.dynamic.add(piece);
    });
    const targetZ = -(lane.momentum / battle.breachThreshold) * 4.7;
    runtime.momentumSeals[laneIndex].userData.targetZ = targetZ;
    runtime.firePools[laneIndex].burn = lane.burn;
    runtime.firePools[laneIndex].points.visible = lane.burn > 0;
    runtime.wetDiscs[laneIndex].visible = lane.wet > 0;
    runtime.windRibbons[laneIndex].visible = battle.wind !== 0;
  });
  const selectionColor = selectedCardId ? 0x6e5519 : 0x000000;
  runtime.laneMaterials.forEach((material) => {
    material.emissive.setHex(selectionColor);
    material.emissiveIntensity = selectedCardId ? .6 : tutorialStep === 2 ? .42 : 0;
  });
}

function animate(runtime: SceneRuntime, getBattle: () => BattleState, onMetrics: (metrics: { fps: number; calls: number; triangles: number }) => void) {
  const frame = (now: number) => {
    runtime.animationId = requestAnimationFrame(frame);
    const delta = Math.min(.05, (now - runtime.lastFrame) / 1000);
    runtime.lastFrame = now;
    runtime.frameAccumulator += delta;
    runtime.frameCount += 1;
    if (!runtime.paused) updateScene(runtime, getBattle(), now / 1000, delta);
    runtime.renderer.render(runtime.scene, runtime.camera);
    if (now - runtime.lastMetricsAt > 1000) {
      const fps = Math.round(runtime.frameCount / Math.max(.001, runtime.frameAccumulator));
      onMetrics({ fps, calls: runtime.renderer.info.render.calls, triangles: runtime.renderer.info.render.triangles });
      runtime.frameCount = 0;
      runtime.frameAccumulator = 0;
      runtime.lastMetricsAt = now;
    }
  };
  runtime.animationId = requestAnimationFrame(frame);
}

function updateScene(runtime: SceneRuntime, battle: BattleState, time: number, delta: number) {
  const motion = runtime.reducedMotion ? .2 : 1;
  runtime.camera.position.x += (runtime.pointerTarget.x * .45 * motion - runtime.camera.position.x) * Math.min(1, delta * 2.2);
  const bookmarkY = runtime.cameraBookmark === "near" ? 8.4 : runtime.cameraBookmark === "far" ? 12.3 : 10.2;
  runtime.camera.position.y += (bookmarkY + runtime.pointerTarget.y * .18 * motion - runtime.camera.position.y) * Math.min(1, delta * 2.2);
  runtime.camera.lookAt(0, 0, -.6);
  runtime.dynamic.children.forEach((unit, index) => {
    const age = Math.max(0, performance.now() - (unit.userData.spawnTime || 0)) / 1000;
    const spawnScale = runtime.reducedMotion ? 1 : 1 - Math.exp(-age * 9) * Math.cos(age * 15);
    const baseScale = unit.userData.general ? 1.12 : unit.userData.tactic ? .82 : .9;
    unit.scale.setScalar(baseScale * Math.max(.01, spawnScale));
    unit.position.y = .12 + Math.sin(time * 2.2 + index) * .025 * motion;
    unit.children.forEach((child) => { if (child.userData.flagPhase !== undefined) child.rotation.z = Math.sin(time * 3 + child.userData.flagPhase * 5) * .07 * motion; });
  });
  runtime.momentumSeals.forEach((seal, index) => {
    const target = seal.userData.targetZ || 0;
    seal.position.z += (target - seal.position.z) * Math.min(1, delta * 5);
    seal.rotation.y += delta * (.6 + Math.abs(battle.lanes[index].momentum) * .04) * motion;
  });
  runtime.firePools.forEach((pool, lane) => {
    if (!pool.points.visible) return;
    const intensity = Math.max(.25, pool.burn / 6);
    const count = runtime.quality === "high" ? 54 : 24;
    for (let index = 0; index < count; index += 1) {
      const seedOffset = index * 4;
      const age = (time * (.65 + pool.seeds[seedOffset + 2]) + pool.seeds[seedOffset + 3] * 4) % 1;
      pool.positions[index * 3] = (pool.seeds[seedOffset] - .5) * 1.8 * intensity + Math.sin(time * 2 + index) * .08;
      pool.positions[index * 3 + 1] = .1 + age * (1.2 + intensity * 1.2);
      pool.positions[index * 3 + 2] = (pool.seeds[seedOffset + 1] - .5) * 2.2;
    }
    (pool.points.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    pool.points.rotation.y = Math.sin(time * .5 + lane) * .08;
  });
  runtime.windRibbons.forEach((line, index) => {
    line.position.y = Math.sin(time * 1.7 + index) * .08 * motion;
    (line.material as THREE.LineBasicMaterial).opacity = .35 + Math.sin(time * 2 + index) * .12;
  });
  runtime.wetDiscs.forEach((disc, index) => { disc.scale.setScalar(1 + Math.sin(time * 1.4 + index) * .05 * motion); });
}

function pickLane(runtime: SceneRuntime, clientX: number, clientY: number): LaneIndex | null {
  const rect = runtime.renderer.domElement.getBoundingClientRect();
  runtime.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
  runtime.raycaster.setFromCamera(runtime.pointer, runtime.camera);
  const hit = runtime.raycaster.intersectObjects(runtime.laneMeshes, false)[0];
  return hit ? hit.object.userData.lane as LaneIndex : null;
}

function resize(runtime: SceneRuntime, host: HTMLDivElement) {
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  runtime.renderer.setSize(width, height, false);
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
}

function applyCameraBookmark(camera: THREE.PerspectiveCamera, bookmark: CameraBookmark) {
  if (bookmark === "near") camera.position.set(0, 8.4, 11.2);
  else if (bookmark === "far") camera.position.set(0, 12.3, 17.5);
  else camera.position.set(0, 10.2, 14.3);
  camera.lookAt(0, 0, -.6);
}

function clearDynamic(group: THREE.Group) {
  while (group.children.length) group.remove(group.children[0]);
}

function disposeScene(runtime: SceneRuntime) {
  runtime.shared.paperTexture.dispose();
  runtime.shared.fireTexture.dispose();
  Object.values(runtime.shared.geometries).forEach((geometry) => geometry.dispose());
  Object.values(runtime.shared.materials).forEach((material) => material.dispose());
  runtime.laneMaterials.forEach((material) => material.dispose());
  runtime.firePools.forEach((pool) => pool.points.geometry.dispose());
  runtime.windRibbons.forEach((line) => line.geometry.dispose());
  runtime.scene.traverse((object) => { if (object instanceof THREE.Mesh && !Object.values(runtime.shared.geometries).includes(object.geometry)) object.geometry.dispose(); });
  if (runtime.scene.overrideMaterial) runtime.scene.overrideMaterial.dispose();
}

function seeded(seed: number) {
  let state = seed | 0;
  return () => {
    state |= 0;
    state = state + 0x6d2b79f5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
