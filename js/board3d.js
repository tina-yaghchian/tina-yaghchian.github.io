/* Hero: a modelled circuit board rendered in real time with three.js.
   Moves on its own with a slow drift. It never follows the cursor or reacts to
   scrolling. Pressing and dragging it turns it. */

import * as THREE from "../vendor/three.module.min.js";

const BOARD = 5;          /* half width of the board */
const CHIP = 2.4;         /* package size */
const PINS = 11;          /* pins per side */
const PITCH = 0.19;
const FOOT = 1.54;        /* where a pin's foot ends, measured from centre */

function seeded(seed) {
    return () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* Collects many copies of one shape, then draws them as a single instanced mesh. */
class Batch {
    constructor(geometry, material, castShadow = true) {
        this.geometry = geometry;
        this.material = material;
        this.castShadow = castShadow;
        this.matrices = [];
    }

    add(x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) {
        const m = new THREE.Matrix4();
        m.compose(
            new THREE.Vector3(x, y, z),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
            new THREE.Vector3(sx, sy, sz)
        );
        this.matrices.push(m);
    }

    addTo(parent) {
        const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.matrices.length);
        this.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.castShadow = this.castShadow;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        parent.add(mesh);
    }
}

function roundedRect(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
}

/* An extruded block with soft edges, sitting with its underside at y = base. */
function softBlock(w, d, height, radius, bevel, base = 0) {
    const geometry = new THREE.ExtrudeGeometry(
        roundedRect(w - bevel * 2, d - bevel * 2, Math.max(radius, 0.001)),
        {
            depth: height - bevel * 2,
            bevelEnabled: true,
            bevelThickness: bevel,
            bevelSize: bevel,
            bevelSegments: 3,
            curveSegments: 6
        }
    );
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, base + bevel, 0);
    return geometry;
}

/* Studio lighting: soft boxes that the metal parts reflect. */
function studioEnvironment(renderer) {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x07090a);

    const panel = (w, h, position, color, power) => {
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide })
        );
        mesh.position.set(...position);
        mesh.lookAt(0, 0, 0);
        env.add(mesh);
    };

    panel(16, 10, [0, 14, 0], 0xffffff, 5);
    panel(6, 14, [-14, 5, 3], 0xffe2c8, 7);
    panel(5, 12, [14, 4, -5], 0xbfd6ff, 4);
    panel(16, 3, [0, 3, 15], 0xffffff, 3);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const texture = pmrem.fromScene(env, 0.035).texture;
    pmrem.dispose();
    return texture;
}

function canvasTexture(size, draw) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    draw(c.getContext("2d"), size);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

function buildBoard(group, materials, traces) {
    const { mask, copper, gold, silver, plastic, epoxy, ceramic, darkHole } = materials;
    const rand = seeded(20260);

    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);

    const copperBox = new Batch(unitBox, copper, false);
    const copperDot = new Batch(unitCyl, copper, false);
    const goldBox = new Batch(unitBox, gold, false);
    const goldDot = new Batch(unitCyl, gold, false);
    const holes = new Batch(unitCyl, darkHole, false);
    const capBody = new Batch(unitBox, ceramic);
    const resBody = new Batch(unitBox, plastic);
    const terminals = new Batch(unitBox, silver);

    /* Board */
    const outline = roundedRect(BOARD * 2, BOARD * 2, 0.34);
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            const hole = new THREE.Path();
            hole.absarc(sx * 4.58, sz * 4.58, 0.14, 0, Math.PI * 2, true);
            outline.holes.push(hole);
            goldDot.add(sx * 4.58, 0.004, sz * 4.58, 0.5, 0.012, 0.5);
            holes.add(sx * 4.58, 0.008, sz * 4.58, 0.27, 0.012, 0.27);
        }
    }
    const boardGeometry = new THREE.ExtrudeGeometry(outline, {
        depth: 0.16,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.015,
        bevelSegments: 2,
        curveSegments: 16
    });
    boardGeometry.rotateX(-Math.PI / 2);
    boardGeometry.translate(0, -0.175, 0);
    const board = new THREE.Mesh(boardGeometry, mask);
    board.receiveShadow = true;
    board.castShadow = true;
    group.add(board);

    /* Traces: fan out from each pin with 45 degree bends, so none of them cross. */
    const half = (PINS - 1) / 2;
    const segment = (a, b) => {
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const length = Math.hypot(dx, dz);
        copperBox.add((a[0] + b[0]) / 2, 0.006, (a[1] + b[1]) / 2, length, 0.012, 0.046, Math.atan2(-dz, dx));
        copperDot.add(b[0], 0.006, b[1], 0.046, 0.012, 0.046);
    };

    for (let side = 0; side < 4; side++) {
        const angle = side * Math.PI / 2;
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const place = (lx, ly) => [lx * cos + ly * sin, -lx * sin + ly * cos];

        for (let i = -half; i <= half; i++) {
            const ly = i * PITCH;
            const xb = FOOT + (half - Math.abs(i)) * 0.13 + 0.08;
            const shift = i * 0.3;
            const xd = xb + Math.abs(shift);
            const yd = ly + shift;
            const toEdge = rand() < 0.45;
            const xEnd = toEdge ? 4.72 : xd + 0.45 + rand() * Math.max(0, 4.3 - xd - 0.45);
            const pts = [[FOOT - 0.02, ly], [xb, ly], [xd, yd], [xEnd, yd]].map(p => place(p[0], p[1]));

            copperDot.add(pts[0][0], 0.006, pts[0][1], 0.046, 0.012, 0.046);
            for (let k = 1; k < pts.length; k++) segment(pts[k - 1], pts[k]);

            const lengths = [];
            let total = 0;
            for (let k = 1; k < pts.length; k++) {
                const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
                lengths.push(l);
                total += l;
            }
            traces.push({ pts, lengths, total });

            /* Pad under the pin */
            const pad = place(1.45, ly);
            goldBox.add(pad[0], 0.008, pad[1], 0.3, 0.016, 0.11, angle);

            if (toEdge) {
                const finger = place(4.66, yd);
                goldBox.add(finger[0], 0.008, finger[1], 0.56, 0.016, 0.15, angle);
            } else {
                const end = pts[3];
                goldDot.add(end[0], 0.008, end[1], 0.17, 0.016, 0.17);
                holes.add(end[0], 0.01, end[1], 0.075, 0.018, 0.075);
            }

            /* Small surface-mount parts sitting on some of the longer traces */
            if (xEnd - xd > 0.95 && rand() < 0.4) {
                const lx = (xd + xEnd) / 2;
                const c = place(lx, yd);
                const body = rand() < 0.55 ? capBody : resBody;
                body.add(c[0], 0.075, c[1], 0.2, 0.11, 0.15, angle);
                const a = place(lx - 0.13, yd), b = place(lx + 0.13, yd);
                terminals.add(a[0], 0.07, a[1], 0.07, 0.12, 0.155, angle);
                terminals.add(b[0], 0.07, b[1], 0.07, 0.12, 0.155, angle);
            }
        }
    }

    /* Main chip */
    const chip = new THREE.Mesh(softBlock(CHIP, CHIP, 0.31, 0.05, 0.03, 0.05), epoxy);
    chip.castShadow = true;
    chip.receiveShadow = true;
    group.add(chip);

    /* Gull-wing pins */
    const profile = new THREE.Shape();
    profile.moveTo(-0.02, 0.2);
    profile.lineTo(0.09, 0.2);
    profile.lineTo(0.2, 0.035);
    profile.lineTo(0.34, 0.035);
    profile.lineTo(0.34, 0.005);
    profile.lineTo(0.18, 0.005);
    profile.lineTo(0.075, 0.165);
    profile.lineTo(-0.02, 0.165);
    profile.closePath();
    const pinGeometry = new THREE.ExtrudeGeometry(profile, { depth: 0.08, bevelEnabled: false });
    pinGeometry.translate(0, 0, -0.04);
    const pins = new Batch(pinGeometry, silver);
    for (let side = 0; side < 4; side++) {
        const angle = side * Math.PI / 2;
        const cos = Math.cos(angle), sin = Math.sin(angle);
        for (let i = -half; i <= half; i++) {
            const lx = CHIP / 2, ly = i * PITCH;
            pins.add(lx * cos + ly * sin, 0, -lx * sin + ly * cos, 1, 1, 1, angle);
        }
    }

    /* Corner: shielded module with a printed antenna */
    const can = new THREE.Mesh(softBlock(1.5, 1.35, 0.2, 0.05, 0.012, 0.01), silver);
    can.position.set(3.45, 0, -3.7);
    can.castShadow = true;
    can.receiveShadow = true;
    group.add(can);
    for (let k = 0; k < 6; k++) {
        const x = 2.82 + k * 0.25;
        copperBox.add(x, 0.006, -2.82, 0.04, 0.012, 0.3);
        if (k < 5) copperBox.add(x + 0.125, 0.006, k % 2 ? -2.67 : -2.97, 0.29, 0.012, 0.04);
    }

    /* Corner: crystal, small package, supporting parts */
    const crystal = new THREE.Mesh(softBlock(0.95, 0.42, 0.3, 0.2, 0.03, 0.01), silver);
    crystal.position.set(-3.5, 0, -4.02);
    crystal.castShadow = true;
    group.add(crystal);
    const smallChip = new THREE.Mesh(softBlock(0.8, 0.8, 0.13, 0.02, 0.012, 0.01), epoxy);
    smallChip.position.set(-3.6, 0, -3.05);
    smallChip.castShadow = true;
    group.add(smallChip);
    for (let k = -2; k <= 2; k++) {
        for (const s of [-1, 1]) {
            goldBox.add(-3.6 + k * 0.14, 0.008, -3.05 + s * 0.46, 0.08, 0.016, 0.14);
            goldBox.add(-3.6 + s * 0.46, 0.008, -3.05 + k * 0.14, 0.14, 0.016, 0.08);
        }
    }
    for (const [x, z] of [[-4.35, -3.25], [-4.35, -2.85], [-2.85, -3.75]]) {
        capBody.add(x, 0.075, z, 0.28, 0.12, 0.16);
        terminals.add(x - 0.17, 0.07, z, 0.08, 0.13, 0.165);
        terminals.add(x + 0.17, 0.07, z, 0.08, 0.13, 0.165);
    }

    /* Corner: 2 x 6 pin header */
    const header = new Batch(unitBox, plastic);
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 2; col++) {
            const x = -4.1 + col * 0.26, z = 2.95 + row * 0.26;
            header.add(x, 0.13, z, 0.245, 0.26, 0.245);
            goldBox.add(x, 0.42, z, 0.07, 0.62, 0.07);
        }
    }

    /* Corner: electrolytic capacitor and power inductor */
    const capCan = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.86, 40), plastic);
    capCan.position.set(3.75, 0.45, 3.1);
    capCan.castShadow = true;
    group.add(capCan);
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.49, 0.05, 40), new THREE.MeshStandardMaterial({ color: 0x8e9296, metalness: 1, roughness: 0.42 }));
    capTop.position.set(3.75, 0.9, 3.1);
    capTop.castShadow = true;
    group.add(capTop);
    const inductor = new THREE.Mesh(softBlock(0.95, 0.95, 0.42, 0.14, 0.04, 0.01), plastic);
    inductor.position.set(3.05, 0, 4.2);
    inductor.castShadow = true;
    group.add(inductor);

    for (const batch of [copperBox, copperDot, goldBox, goldDot, holes, capBody, resBody, terminals, pins, header]) {
        batch.addTo(group);
    }
}

function buildMarkings(group) {
    const inkFor = size => size / (BOARD * 2);

    /* White silkscreen printed on the board */
    const silk = canvasTexture(2048, (g, size) => {
        const u = inkFor(size);
        const px = x => (x + BOARD) * u;
        g.clearRect(0, 0, size, size);
        g.strokeStyle = g.fillStyle = "rgba(235, 238, 232, 0.86)";
        g.lineWidth = 3;
        g.textBaseline = "middle";

        const text = (label, x, z, height, weight = 500) => {
            g.font = `${weight} ${Math.round(height * u)}px "IBM Plex Mono", monospace`;
            g.fillText(label, px(x), px(z));
        };
        const box = (x, z, w, d) => g.strokeRect(px(x), px(z), w * u, d * u);

        /* Chip corner marks */
        const c = 1.72, m = 0.26;
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            g.beginPath();
            g.moveTo(px(sx * c), px(sz * (c - m)));
            g.lineTo(px(sx * c), px(sz * c));
            g.lineTo(px(sx * (c - m)), px(sz * c));
            g.stroke();
        }
        text("U1", -1.62, -1.98, 0.17);

        box(-4.32, 2.75, 0.74, 1.76);
        text("J1", -4.3, 2.58, 0.16);
        text("TINA", -3.35, 3.28, 0.2);
        text("YAGHCHIAN", -3.35, 3.55, 0.13);

        text("U2", 2.72, -4.55, 0.16);
        box(2.65, -4.42, 1.6, 1.44);
        text("ANT", 2.72, -2.42, 0.13);

        text("Y1", -4.12, -4.54, 0.16);
        text("U3", -3.25, -2.45, 0.14);

        text("C1", 2.72, 2.72, 0.16);
        g.beginPath();
        g.arc(px(3.75), px(3.1), 0.6 * u, 0, Math.PI * 2);
        g.stroke();
        text("L1", 2.42, 3.85, 0.14);
    });
    const silkPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(BOARD * 2, BOARD * 2).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ map: silk, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    silkPlane.position.y = 0.003;
    silkPlane.receiveShadow = true;
    group.add(silkPlane);

    /* Laser-etched marking on the chip */
    const etch = canvasTexture(1024, (g, size) => {
        g.clearRect(0, 0, size, size);
        g.fillStyle = "rgba(205, 208, 204, 0.72)";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.font = `500 ${size * 0.26}px "IBM Plex Mono", monospace`;
        g.fillText("TY", size / 2, size * 0.44);
        g.font = `400 ${size * 0.058}px "IBM Plex Mono", monospace`;
        g.fillText("WATERLOO, ON", size / 2, size * 0.66);
        g.beginPath();
        g.arc(size * 0.13, size * 0.13, size * 0.032, 0, Math.PI * 2);
        g.fill();
    });
    const etchPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(CHIP * 0.96, CHIP * 0.96).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ map: etch, transparent: true, roughness: 0.65, metalness: 0.15 })
    );
    etchPlane.position.y = 0.363;
    group.add(etchPlane);
}

export async function initBoard3D(canvas, hero, { reducedMotion = false } = {}) {
    try {
        await document.fonts.load('500 64px "IBM Plex Mono"');
        await document.fonts.load('400 64px "IBM Plex Mono"');
    } catch (e) { /* the monospace fallback is fine */ }

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.environment = studioEnvironment(renderer);
    scene.environmentIntensity = 0.75;

    const camera = new THREE.PerspectiveCamera(26, 1, 1, 200);

    const key = new THREE.DirectionalLight(0xfff4e8, 2.6);
    key.position.set(-7, 13, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.012;
    key.shadow.radius = 4;
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xffb27a, 0.9);
    rim.position.set(9, 3, -8);
    scene.add(rim);

    const materials = {
        mask: new THREE.MeshPhysicalMaterial({ color: 0x07110d, roughness: 0.5, clearcoat: 0.28, clearcoatRoughness: 0.42, envMapIntensity: 0.32 }),
        copper: new THREE.MeshStandardMaterial({ color: 0xd98a50, metalness: 1, roughness: 0.36 }),
        gold: new THREE.MeshStandardMaterial({ color: 0xdcb670, metalness: 1, roughness: 0.27 }),
        silver: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 1, roughness: 0.3 }),
        plastic: new THREE.MeshStandardMaterial({ color: 0x131416, roughness: 0.5 }),
        epoxy: new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.62 }),
        ceramic: new THREE.MeshStandardMaterial({ color: 0xa98a68, roughness: 0.55 }),
        darkHole: new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 0.9 })
    };

    const pivot = new THREE.Group();
    scene.add(pivot);

    const traces = [];
    buildBoard(pivot, materials, traces);
    buildMarkings(pivot);

    /* Soft shadow beneath the floating board, most visible on the light theme */
    const groundTexture = canvasTexture(512, (g, size) => {
        const fade = g.createRadialGradient(size / 2, size / 2, size * 0.12, size / 2, size / 2, size / 2);
        fade.addColorStop(0, "rgba(0, 0, 0, 1)");
        fade.addColorStop(1, "rgba(0, 0, 0, 0)");
        g.fillStyle = fade;
        g.fillRect(0, 0, size, size);
    });
    const groundMaterial = new THREE.MeshBasicMaterial({ map: groundTexture, transparent: true, depthWrite: false, toneMapped: false });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 15.5).rotateX(-Math.PI / 2), groundMaterial);
    ground.position.y = -1.7;
    ground.renderOrder = -1;
    scene.add(ground);

    const applyTheme = () => {
        groundMaterial.opacity = document.documentElement.dataset.theme === "light" ? 0.2 : 0.5;
    };
    applyTheme();

    /* Signals: bright points with fading tails, travelling out along the copper */
    const PULSES = reducedMotion ? 0 : 11;
    const TAIL = 8;
    const glowTexture = canvasTexture(128, (g, size) => {
        const fade = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        fade.addColorStop(0, "rgba(255, 255, 255, 1)");
        fade.addColorStop(0.22, "rgba(255, 255, 255, 0.55)");
        fade.addColorStop(1, "rgba(255, 255, 255, 0)");
        g.fillStyle = fade;
        g.fillRect(0, 0, size, size);
    });
    const pulsePositions = new Float32Array(PULSES * TAIL * 3);
    const pulseColors = new Float32Array(PULSES * TAIL * 3);
    const pulseGeometry = new THREE.BufferGeometry();
    pulseGeometry.setAttribute("position", new THREE.BufferAttribute(pulsePositions, 3));
    pulseGeometry.setAttribute("color", new THREE.BufferAttribute(pulseColors, 3));
    const pulsePoints = new THREE.Points(pulseGeometry, new THREE.PointsMaterial({
        size: 0.34,
        map: glowTexture,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        sizeAttenuation: true
    }));
    pulsePoints.frustumCulled = false;
    pivot.add(pulsePoints);

    const pulses = Array.from({ length: PULSES }, (_, i) => ({ trace: null, d: 0, v: 0, wait: i * 0.32 }));

    function pointOn(trace, distance) {
        let d = Math.max(0, distance);
        for (let i = 0; i < trace.lengths.length; i++) {
            if (d <= trace.lengths[i]) {
                const a = trace.pts[i], b = trace.pts[i + 1], f = trace.lengths[i] ? d / trace.lengths[i] : 0;
                return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
            }
            d -= trace.lengths[i];
        }
        return trace.pts[trace.pts.length - 1];
    }

    function updatePulses(dt) {
        pulses.forEach((p, index) => {
            if (!p.trace) {
                p.wait -= dt;
                if (p.wait <= 0) {
                    p.trace = traces[Math.floor(Math.random() * traces.length)];
                    p.d = 0;
                    p.v = 1.5 + Math.random() * 1.1;
                }
            } else {
                p.d += p.v * dt;
                if (p.d - TAIL * 0.075 > p.trace.total) {
                    p.trace = null;
                    p.wait = 0.2 + Math.random() * 1.6;
                }
            }
            for (let k = 0; k < TAIL; k++) {
                const at = (index * TAIL + k) * 3;
                const distance = p.trace ? p.d - k * 0.075 : -1;
                const live = p.trace && distance > 0 && distance < p.trace.total;
                const pos = live ? pointOn(p.trace, distance) : [0, 0];
                pulsePositions[at] = pos[0];
                pulsePositions[at + 1] = live ? 0.03 : -60;
                pulsePositions[at + 2] = pos[1];
                const fall = live ? Math.pow(1 - k / TAIL, 2) : 0;
                pulseColors[at] = 1.0 * fall;
                pulseColors[at + 1] = 0.62 * fall;
                pulseColors[at + 2] = 0.34 * fall;
            }
        });
        pulseGeometry.attributes.position.needsUpdate = true;
        pulseGeometry.attributes.color.needsUpdate = true;
    }

    /* Framing: board sits to the right on desktop, above the name on phones */
    let W = 0, H = 0;

    function frameScene() {
        const r = hero.getBoundingClientRect();
        W = r.width;
        H = r.height;
        if (W < 1 || H < 1) return;

        const mobile = W < 900;
        const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.75 : 2);
        renderer.setPixelRatio(dpr);
        renderer.setSize(W, H, false);

        const targetPx = mobile ? Math.min(W * 0.96, 430) : Math.min(W * 0.46, H * 0.8);
        const centerX = mobile ? W * 0.5 : W * 0.745;
        const centerY = mobile ? 158 : H * 0.44;

        const fov = THREE.MathUtils.degToRad(camera.fov);
        const visibleHeight = 13.2 * H / targetPx;
        const distance = visibleHeight / (2 * Math.tan(fov / 2));

        camera.aspect = W / H;
        camera.position.set(0, distance * 0.8, distance * 0.6);
        camera.lookAt(0, 0, 0);
        camera.setViewOffset(W, H, W / 2 - centerX, H / 2 - centerY, W, H);
        camera.near = Math.max(1, distance - 16);
        camera.far = distance + 30;
        camera.updateProjectionMatrix();
    }

    /* Motion: a slow drift, plus turning by hand while pressed */
    const BASE_YAW = -0.52;
    let dragYaw = 0, spin = 0;
    let dragging = false, lastX = 0;
    let time = 0;
    let running = false, last = 0;

    function draw() {
        const drift = reducedMotion ? 0 : 1;
        pivot.rotation.y = BASE_YAW + dragYaw + drift * Math.sin(time * 0.2) * 0.14;
        pivot.rotation.x = drift * Math.sin(time * 0.27) * 0.025;
        pivot.position.y = drift * Math.sin(time * 0.38) * 0.06;
        renderer.render(scene, camera);
    }

    function loop(now) {
        if (!running) return;
        const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
        last = now;
        time += dt;
        if (!dragging) {
            dragYaw += spin * dt;
            spin *= Math.exp(-dt * 2.4);
        }
        updatePulses(dt);
        draw();
        requestAnimationFrame(loop);
    }

    function start() {
        if (running || reducedMotion) return;
        running = true;
        last = 0;
        requestAnimationFrame(loop);
    }
    function stop() { running = false; }

    hero.addEventListener("pointerdown", e => {
        if (e.target.closest("a, button")) return;
        const r = hero.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        const onBoard = W < 900 ? y < 320 : x > W * 0.48 && y < H - 100;
        if (!onBoard) return;
        dragging = true;
        lastX = e.clientX;
        spin = 0;
    });
    addEventListener("pointermove", e => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        lastX = e.clientX;
        dragYaw += dx * 0.008;
        spin = dx * 0.5;
        if (reducedMotion) draw();
    });
    const release = () => { dragging = false; };
    addEventListener("pointerup", release);
    addEventListener("pointercancel", release);

    let resizeTimer;
    new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { frameScene(); draw(); }, 100);
    }).observe(hero);

    document.addEventListener("themechange", () => {
        applyTheme();
        if (!running) draw();
    });

    new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !document.hidden) start(); else stop();
    }).observe(hero);

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stop(); else start();
    });

    frameScene();
    updatePulses(0);
    draw();
    canvas.classList.add("ready");
    hero.classList.add("has-3d");
}
