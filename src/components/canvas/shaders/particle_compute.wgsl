// ============================================================
// particle_compute.wgsl — GPU-side physics compute shader
// Integrates positions, applies forces, updates spatial hash
// ============================================================

struct Particle {
    px: f32, py: f32,
    vx: f32, vy: f32,
    ax: f32, ay: f32,
    mass: f32, charge: f32, spin: f32, life: f32,
    color: f32, alpha: f32, phase: f32, _pad: f32,
}

struct Params {
    count: u32,
    dt: f32,
    G: f32,
    k_coulomb: f32,
    hbar: f32,
    c: f32,
    mode: u32,        // 0=classical 1=quantum 2=relativity 3=fluid 4=em
    timeScale: f32,
    mouseX: f32,
    mouseY: f32,
    forceMode: u32,   // 0=none 1=attract 2=repel
    forceRadius: f32,
    forceStrength: f32,
    canvasW: f32,
    canvasH: f32,
    simTime: f32,
    Bz: f32,          // magnetic field z-component (EM mode)
    _pad: f32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: Params;

// ---- Helpers ----

fn wrap(v: f32, lo: f32, hi: f32) -> f32 {
    if v < lo { return hi; }
    if v > hi { return lo; }
    return v;
}

fn lorentz_gamma(vx: f32, vy: f32, c: f32) -> f32 {
    let v2 = vx*vx + vy*vy;
    let beta2 = v2 / (c * c);
    return 1.0 / sqrt(max(1.0 - beta2, 1e-6));
}

fn viridis_color(t: f32) -> f32 {
    // Encode as single float for compact storage; decode in render shader
    return clamp(t, 0.0, 1.0);
}

// ---- Classical gravity (grid approximation) ----

fn gravity_force(i: u32) -> vec2<f32> {
    var fx = 0.0;
    var fy = 0.0;
    let px = particles[i].px;
    let py = particles[i].py;
    let cx = params.canvasW * 0.5;
    let cy = params.canvasH * 0.5;

    // Sample a subset of neighbors for N² → approx (Optimized for low-end PC butter-smooth visuals via larger stride interpolation)
    let step = max(1u, params.count / 256u);
    for (var j: u32 = 0u; j < params.count; j += step) {
        if j == i { continue; }
        let dx = particles[j].px - px;
        let dy = particles[j].py - py;
        let r2 = dx*dx + dy*dy + 80.0;
        let r = sqrt(r2);
        let f = params.G * particles[j].mass / r2;
        fx += f * dx / r;
        fy += f * dy / r;
    }
    // Central well
    let dx = cx - px;
    let dy = cy - py;
    let r2 = dx*dx + dy*dy + 400.0;
    let r = sqrt(r2);
    fx += params.G * 0.5 * dx / r2;
    fy += params.G * 0.5 * dy / r2;
    return vec2<f32>(fx, fy);
}

// ---- Quantum drift ----

fn quantum_force(i: u32) -> vec2<f32> {
    let x = particles[i].px;
    let y = particles[i].py;
    let phase = particles[i].phase;
    let k = 0.055;
    let psiRe = sin(x * k + phase) * cos(y * k * 0.7 + phase * 0.8);
    let gradX = k * cos(x * k + phase) * cos(y * k * 0.7 + phase * 0.8);
    let gradY = -k * 0.7 * sin(x * k + phase) * sin(y * k * 0.7 + phase * 0.8);
    let psi2 = psiRe * psiRe + 1e-8;
    let factor = params.hbar * 0.018 / psi2;
    return vec2<f32>(gradX * factor, gradY * factor);
}

// ---- EM Lorentz force ----

fn em_force(i: u32) -> vec2<f32> {
    let q = particles[i].charge;
    let vx = particles[i].vx;
    let vy = particles[i].vy;
    let cx = params.canvasW * 0.5;
    let cy = params.canvasH * 0.5;
    let Ex = (cx - particles[i].px) * 0.002;
    let Ey = (cy - particles[i].py) * 0.002;
    let fx = q * (Ex + vy * params.Bz);
    let fy = q * (Ey - vx * params.Bz);
    return vec2<f32>(fx, fy);
}

// ---- Main compute entry ----

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    if i >= params.count { return; }

    var p = particles[i];
    let DT = params.dt * params.timeScale;

    // Mouse force
    if params.forceMode != 0u {
        let dx = p.px - params.mouseX;
        let dy = p.py - params.mouseY;
        let r2 = dx*dx + dy*dy;
        let rMax2 = params.forceRadius * params.forceRadius;
        if r2 < rMax2 && r2 > 0.5 {
            let r = sqrt(r2);
            let f = params.forceStrength * (1.0 - r / params.forceRadius) / r;
            let sign = select(-1.0, 1.0, params.forceMode == 2u);
            p.vx += sign * dx * f;
            p.vy += sign * dy * f;
        }
    }

    // Physics forces
    var force = vec2<f32>(0.0, 0.0);
    switch params.mode {
        case 0u: { force = gravity_force(i); }
        case 1u: { force = quantum_force(i); }
        case 4u: { force = em_force(i); }
        default: {}
    }

    // Relativistic mass scaling (mode 2)
    var effMass = p.mass;
    if params.mode == 2u {
        effMass = p.mass * lorentz_gamma(p.vx, p.vy, params.c);
    }

    // Velocity update
    p.ax = force.x / max(effMass, 0.001);
    p.ay = force.y / max(effMass, 0.001);
    p.vx = (p.vx + p.ax * DT) * 0.9998;
    p.vy = (p.vy + p.ay * DT) * 0.9998;

    // Speed limit (relativity mode)
    if params.mode == 2u {
        let spd = sqrt(p.vx*p.vx + p.vy*p.vy);
        if spd > params.c * 0.98 {
            let scale = params.c * 0.98 / spd;
            p.vx *= scale;
            p.vy *= scale;
        }
    }

    // Integrate position
    p.px = p.px + p.vx * DT;
    p.py = p.py + p.vy * DT;

    // Hard bounds wrapping
    // If bounded values become NaN/inf due to massive DT or force, clamp them
    if (p.px < -10000.0 || p.px > 10000.0) { p.px = params.canvasW * 0.5; p.vx = 0.0; }
    if (p.py < -10000.0 || p.py > 10000.0) { p.py = params.canvasH * 0.5; p.vy = 0.0; }

    // Wrap boundaries
    p.px = wrap(p.px, 0.0, params.canvasW);
    p.py = wrap(p.py, 0.0, params.canvasH);

    // Phase evolution (quantum)
    p.phase = p.phase + 0.08 * DT;

    // Color by speed
    let spd2 = sqrt(p.vx*p.vx + p.vy*p.vy);
    p.color = clamp(spd2 * 0.12, 0.0, 1.0);

    particles[i] = p;
}
