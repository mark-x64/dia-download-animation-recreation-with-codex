export const TRAIL_LENGTH = 20;
export const vertex = /* glsl */ `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }
`;
export const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tScene;
  uniform vec2 uResolution;
  uniform vec4 uHead;
  uniform vec2 uCardSize;
  uniform vec2 uVelocity;
  uniform vec4 uTrail[${TRAIL_LENGTH}];
  uniform vec2 uTarget;
  uniform float uRipple;
  uniform float uDim;
  varying vec2 vUv;

  vec3 sampleScene(vec2 point) {
    vec2 uv = clamp(point / uResolution, vec2(.001), vec2(.999));
    return texture2D(tScene, vec2(uv.x, 1.0 - uv.y)).rgb;
  }
  void main() {
    vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uResolution;
    vec2 offset = vec2(0.0);
    float bloom = 0.0;
    float speed = length(uVelocity);
    vec2 direction = speed > 1.0 ? uVelocity / speed : vec2(0.0, -1.0);
    vec2 normal = vec2(-direction.y, direction.x);

    // A stretched wake follows the card. The reference is broad white scattered
    // light with local refraction, not colored rings radiating across the page.
    for (int i = 0; i < ${TRAIL_LENGTH}; i++) {
      vec4 trail = uTrail[i];
      vec2 delta = p - trail.xy;
      float life = max(0.0, 1.0 - trail.z / .48);
      float strength = trail.w * life * life;
      vec2 local = vec2(dot(delta, direction), dot(delta, normal));
      vec2 radius = vec2(86.0 + trail.z * 170.0, 58.0 + trail.z * 125.0);
      vec2 q = local / radius;
      float envelope = exp(-dot(q, q) * 1.4);
      offset -= direction * envelope * strength * 5.2;
      offset += normal * q.y * envelope * strength * 2.5;
      float wave = sin(length(q) * 5.0 - trail.z * 12.0);
      offset += delta / (length(delta) + 1.0) * wave * envelope * strength * 1.3;
      bloom += envelope * strength * .13;
    }

    vec2 lag = direction * min(speed * .05, 88.0);
    vec2 haloPoint = uHead.xy - lag + vec2(0.0, 15.0);
    vec2 h = (p - haloPoint) / max(vec2(155.0, 115.0), uCardSize * vec2(.72, 1.3));
    float halo = exp(-dot(h, h) * 1.4) * uHead.z;
    vec2 d = (p - uHead.xy) / (uCardSize * .5 * uHead.w + vec2(42.0, 45.0));
    float lens = exp(-dot(d, d) * 1.5) * uHead.z;
    offset += d * lens * 15.0;

    vec2 chroma = offset * .105;
    vec3 color;
    color.r = sampleScene(p + offset + chroma).r;
    color.g = sampleScene(p + offset).g;
    color.b = sampleScene(p + offset - chroma).b;
    color *= 1.0 - uDim;

    float arrival = exp(-dot(p - uTarget, p - uTarget) / 3600.0) * sin(uRipple * 3.14159265);
    float whiteLight = clamp(halo * .29 + bloom * .19 + arrival * .055, 0.0, .4);
    color += vec3(whiteLight);
    // The recording's white flare has a very faint warm/cool spectral fringe
    // (for example 253/247/249 on otherwise white content), not a purple ring.
    vec2 warm = (p - uHead.xy - vec2(-60.0, -68.0)) / vec2(125.0, 95.0);
    vec2 cool = (p - uHead.xy - vec2(56.0, -30.0)) / vec2(100.0, 105.0);
    color += uHead.z * (vec3(.006, -.032, -.012) * exp(-dot(warm, warm) * 1.5)
      + vec3(-.012, 0.0, .007) * exp(-dot(cool, cool) * 1.5));
    gl_FragColor = vec4(min(color, vec3(1.0)), 1.0);
  }
`;
