// ============================================================
// particle_render.wgsl — Vertex + Fragment shaders
// Billboard quads, viridis colormap, SDF soft circles, bloom
// ============================================================

struct Particle {
    px: f32, py: f32,
    vx: f32, vy: f32,
    ax: f32, ay: f32,
    mass: f32, charge: f32, spin: f32, life: f32,
    color: f32, alpha: f32, phase: f32, _pad: f32,
}

struct Uniforms {
    canvasW: f32,
    canvasH: f32,
    particleSize: f32,
    bloomIntensity: f32,
    colormap: u32,  // 0=viridis 1=inferno 2=plasma 3=cyan 4=fire 5=aurora
}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

struct VertexOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) color: vec4<f32>,
}

// ---- Colormap functions ----

fn viridis(t: f32) -> vec3<f32> {
    let c0 = vec3<f32>(0.267, 0.005, 0.329);
    let c1 = vec3<f32>(0.229, 0.322, 0.545);
    let c2 = vec3<f32>(0.128, 0.566, 0.551);
    let c3 = vec3<f32>(0.370, 0.789, 0.384);
    let c4 = vec3<f32>(0.993, 0.906, 0.144);
    let s = t * 4.0;
    let i = u32(floor(s));
    let f = fract(s);
    let stops = array<vec3<f32>, 5>(c0, c1, c2, c3, c4);
    let idx = min(i, 3u);
    return mix(stops[idx], stops[idx + 1u], f);
}

fn inferno(t: f32) -> vec3<f32> {
    let r = t * t * (3.0 - 2.0 * t);
    return vec3<f32>(
        clamp(1.7 * r - 0.2, 0.0, 1.0),
        clamp(1.5 * r * r - 0.3, 0.0, 1.0),
        clamp(2.0 * r * (1.0 - r), 0.0, 1.0)
    );
}

fn plasma(t: f32) -> vec3<f32> {
    return vec3<f32>(
        clamp(0.05 + 2.4 * t - 1.8 * t * t, 0.0, 1.0),
        clamp(-0.14 + 1.0 * t - 1.1 * t * t, 0.0, 1.0),
        clamp(0.53 + 0.3 * t - 1.5 * t * t, 0.0, 1.0)
    );
}

fn cyan_map(t: f32) -> vec3<f32> {
    return vec3<f32>(t * 0.0, t * t * 0.83, t);
}

fn fire_map(t: f32) -> vec3<f32> {
    return vec3<f32>(
        clamp(t * 1.8, 0.0, 1.0),
        clamp(t * t * 1.2 - 0.1, 0.0, 1.0),
        clamp(t * t * t * 0.5, 0.0, 1.0)
    );
}

fn aurora_map(t: f32) -> vec3<f32> {
    return vec3<f32>(
        clamp(t * t * 0.3, 0.0, 1.0),
        clamp(t * 0.8 + 0.1, 0.0, 1.0),
        clamp(0.5 + t * 0.5 - t * t * 0.5, 0.0, 1.0)
    );
}

fn apply_colormap(t: f32, cmap: u32) -> vec3<f32> {
    switch cmap {
        case 0u: { return viridis(t); }
        case 1u: { return inferno(t); }
        case 2u: { return plasma(t); }
        case 3u: { return cyan_map(t); }
        case 4u: { return fire_map(t); }
        case 5u: { return aurora_map(t); }
        default: { return viridis(t); }
    }
}

// ---- Vertex shader — billboard quad ----
// Each particle emits 6 vertices (2 triangles)

@vertex
fn vs_main(
    @builtin(vertex_index) vid: u32,
) -> VertexOut {
    let pid = vid / 6u;
    let corner = vid % 6u;

    let p = particles[pid];

    // Billboard offsets: two CCW triangles
    let offsets = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>( 1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
    );
    let uvs = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 0.0),
        vec2<f32>(1.0, 0.0),
        vec2<f32>(0.0, 1.0),
        vec2<f32>(1.0, 0.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(0.0, 1.0),
    );

    let off = offsets[corner];
    let uv  = uvs[corner];

    // Particle size: scale by mass, clamp
    let size = uniforms.particleSize * clamp(0.5 + p.mass * 0.6, 0.3, 4.0);

    // Pixel position → NDC
    let ndcX = ((p.px + off.x * size) / uniforms.canvasW) * 2.0 - 1.0;
    let ndcY = 1.0 - ((p.py + off.y * size) / uniforms.canvasH) * 2.0;

    let rgb = apply_colormap(p.color, uniforms.colormap);

    var out: VertexOut;
    out.pos   = vec4<f32>(ndcX, ndcY, 0.0, 1.0);
    out.uv    = uv * 2.0 - 1.0;  // [-1,1] for SDF
    out.color = vec4<f32>(rgb, p.alpha);
    return out;
}

// ---- Fragment shader — soft circle SDF + bloom ----

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
    // SDF: signed distance from circle center
    let d = length(in.uv);
    if d > 1.0 { discard; }

    // Soft falloff
    let alpha = smoothstep(1.0, 0.0, d) * in.color.a;

    // Bloom: brighter core
    let core = smoothstep(0.6, 0.0, d) * uniforms.bloomIntensity;
    let finalRGB = in.color.rgb + core * in.color.rgb;

    return vec4<f32>(finalRGB, alpha);
}
