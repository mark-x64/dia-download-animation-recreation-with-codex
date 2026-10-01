import { useEffect, useRef } from 'react';
import { Renderer, Triangle, Program, Mesh, Texture } from 'ogl';
import { toCanvas } from 'html-to-image';
import { fragment, vertex, TRAIL_LENGTH } from './fluidShader';

export function FluidLayer({ stage, background, card, onError }) {
  const canvasRef = useRef(null);
  const signals = card.signals;

  useEffect(() => {
    if (signals.reducedMotion) return;
    const canvas = canvasRef.current;
    let disposed = false;
    let ready = false;
    let frame = 0;
    let resizeTimer;
    let captureId = 0;
    let renderer;
    try {
      renderer = new Renderer({ canvas, dpr: Math.min(window.devicePixelRatio, 1.75), alpha: false, antialias: false });
    } catch (error) {
      onError(error.message);
      return;
    }
    const gl = renderer.gl;
    if (!gl) { onError('WebGL is not available in this browser'); return; }
    const texture = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
    const uniforms = {
      tScene: { value: texture },
      uResolution: { value: new Float32Array(2) },
      uHead: { value: new Float32Array(4) },
      uCardSize: { value: new Float32Array(2) },
      uVelocity: { value: new Float32Array(2) },
      // OGL detects GLSL uniform arrays with Array.isArray (typed arrays differ).
      uTrail: { value: Array(TRAIL_LENGTH * 4).fill(0) },
      uTarget: { value: new Float32Array(2) },
      uRipple: { value: 1 },
      uDim: { value: 0 },
    };
    const geometry = new Triangle(gl);
    const program = new Program(gl, { vertex, fragment, uniforms, depthTest: false, depthWrite: false, cullFace: null });
    const mesh = new Mesh(gl, { geometry, program });
    const history = Array.from({ length: TRAIL_LENGTH }, () => ({ x: -1000, y: -1000, born: -10000, strength: 0 }));
    let previousX = signals.x.get();
    let previousY = signals.y.get();
    let previousTime = performance.now();
    let lastSample = 0;
    let velocityX = 0;
    let velocityY = 0;

    function wake() {
      if (!frame && ready && !disposed && !document.hidden) {
        previousTime = performance.now();
        frame = requestAnimationFrame(render);
      }
    }
    function render(now) {
      frame = 0;
      if (disposed || !ready || document.hidden) return;
      const dt = Math.max(1 / 240, Math.min((now - previousTime) / 1000, 0.05));
      previousTime = now;
      const px = signals.x.get();
      const py = signals.y.get();
      const movement = Math.hypot(px - previousX, py - previousY);
      const smoothing = 1 - Math.exp(-dt * 18);
      velocityX += ((px - previousX) / dt - velocityX) * smoothing;
      velocityY += ((py - previousY) / dt - velocityY) * smoothing;
      previousX = px; previousY = py;
      const speed = Math.min(Math.hypot(velocityX, velocityY) / 1000, 1.4);
      const energy = signals.energy.get();
      if (movement > 0.4 && energy > 0.01 && now - lastSample >= 18) {
        const sample = history.pop();
        Object.assign(sample, { x: px, y: py, born: now, strength: Math.min(1.3, speed + 0.16) * energy });
        history.unshift(sample);
        lastSample = now;
      }
      let hasWake = false;
      history.forEach((sample, i) => {
        const age = (now - sample.born) / 1000;
        const values = uniforms.uTrail.value;
        values[i * 4] = sample.x;
        values[i * 4 + 1] = sample.y;
        values[i * 4 + 2] = age;
        values[i * 4 + 3] = sample.strength;
        if (age < 0.5 && sample.strength > 0) hasWake = true;
      });
      uniforms.uHead.value.set([px, py, energy, signals.scale.get()]);
      uniforms.uCardSize.value.set([signals.dimensions.current.width, signals.dimensions.current.height]);
      uniforms.uVelocity.value.set([velocityX, velocityY]);
      uniforms.uTarget.value.set([signals.target.current.x, signals.target.current.y]);
      uniforms.uRipple.value = signals.ripple.get();
      uniforms.uDim.value = signals.dim.get();
      const active = energy > 0.002 || signals.dim.get() > 0.002 || hasWake || signals.ripple.get() < 0.999;
      if (active) {
        canvas.style.opacity = '1';
        canvas.dataset.rendering = 'true';
        renderer.render({ scene: mesh });
        frame = requestAnimationFrame(render);
      } else {
        canvas.style.opacity = '0';
        canvas.dataset.rendering = 'false';
        velocityX = 0; velocityY = 0;
      }
    }

    async function capture() {
      const token = ++captureId;
      ready = false;
      canvas.style.opacity = '0';
      const { width, height } = stage.current.getBoundingClientRect();
      renderer.setSize(width, height);
      uniforms.uResolution.value.set([width, height]);
      try {
        // Only the static MUI layer is captured, at layout changes. The live card
        // and button remain DOM elements with real pointer and keyboard input.
        const bitmap = await toCanvas(background.current, {
          pixelRatio: Math.min(window.devicePixelRatio, 2),
          backgroundColor: '#fff', skipFonts: true,
        });
        if (disposed || token !== captureId) return;
        texture.image = bitmap;
        texture.needsUpdate = true;
        ready = true;
        canvas.dataset.ready = 'true';
        onError('');
        wake();
      } catch (error) {
        if (!disposed && token === captureId) onError(error.message);
      }
    }
    const unsubscribe = [signals.x, signals.y, signals.scale, signals.energy, signals.dim, signals.ripple].map(value => value.on('change', wake));
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(capture, 100);
    });
    observer.observe(stage.current);
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else wake();
    };
    const contextLost = event => { event.preventDefault(); ready = false; onError('WebGL context lost; reload the page'); };
    canvas.addEventListener('webglcontextlost', contextLost);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true;
      clearTimeout(resizeTimer);
      cancelAnimationFrame(frame);
      unsubscribe.forEach(stop => stop());
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', contextLost);
      document.removeEventListener('visibilitychange', visibility);
      geometry.remove(); program.remove(); gl.deleteTexture(texture.texture);
    };
  }, [signals, stage, background, onError]);

  return <canvas ref={canvasRef} className="fluid-canvas" aria-hidden="true" />;
}
