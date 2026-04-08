// ============================================================
// post_process.wgsl — Bloom + Motion blur + Vignette
// ============================================================

@group(0) @binding(0) var tex: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var accumTex: texture_2d<f32>;

struct PostParams {
    trailDecay: f32,
    bloomThreshold: f32,
    vignetteStrength: f32,
    _pad: f32,
}
@group(0) @binding(3) var<uniform> params: PostParams;

struct VOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VOut {
    let positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -3.0),
        vec2<f32>( 3.0,  1.0),
        vec2<f32>(-1.0,  1.0),
    );
    var out: VOut;
    out.pos = vec4<f32>(positions[vid], 0.0, 1.0);
    out.uv  = (positions[vid] + 1.0) * 0.5;
    out.uv.y = 1.0 - out.uv.y;
    return out;
}

// 5-tap Gaussian blur for bloom
fn gaussianBlur(uv: vec2<f32>, texSize: vec2<f32>) -> vec3<f32> {
    let d = 1.5 / texSize;
    var col = textureSample(tex, samp, uv).rgb * 0.36;
    col += textureSample(tex, samp, uv + vec2<f32>(d.x, 0.0)).rgb * 0.16;
    col += textureSample(tex, samp, uv - vec2<f32>(d.x, 0.0)).rgb * 0.16;
    col += textureSample(tex, samp, uv + vec2<f32>(0.0, d.y)).rgb * 0.16;
    col += textureSample(tex, samp, uv - vec2<f32>(0.0, d.y)).rgb * 0.16;
    return col;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4<f32> {
    let texDims = vec2<f32>(textureDimensions(tex));
    let current = textureSample(tex, samp, in.uv);
    let accum = textureSample(accumTex, samp, in.uv);

    // Motion blur: blend with accumulation buffer
    var color = mix(current.rgb, accum.rgb, params.trailDecay);

    // Bloom: extract bright pixels and add blurred version
    let brightness = dot(current.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
    if brightness > params.bloomThreshold {
        let blurred = gaussianBlur(in.uv, texDims);
        color += blurred * 0.35;
    }

    // Space vignette
    let uv2 = in.uv * 2.0 - 1.0;
    let vignette = 1.0 - dot(uv2, uv2) * params.vignetteStrength;
    color *= clamp(vignette, 0.0, 1.0);

    return vec4<f32>(color, current.a);
}
