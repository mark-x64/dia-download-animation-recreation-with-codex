import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'motion/react';
import { FLIGHT_DURATION, TIMES, SCALES, ROTATIONS, OPACITIES, flightFrames } from './referenceMotion';

import { CARD_WIDTH, CARD_HEIGHT, REST_SCALE, cardGeometry, keepInBounds, randomSpawnPoint } from './cardGeometry';
const clamp = (v, low, high) => Math.min(high, Math.max(low, v));

export function useCardMotion(stage, button) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(REST_SCALE);
  const rotate = useMotionValue(0);
  const opacity = useMotionValue(0);
  const energy = useMotionValue(0);
  const dim = useMotionValue(0);
  const ripple = useMotionValue(1);
  const [phase, setPhase] = useState('ready');
  const phaseRef = useRef('ready');
  const controls = useRef([]);
  const generation = useRef(0);
  const reducedMotion = useReducedMotion();
  const target = useRef({ x: 0, y: 0 });
  const dragged = useRef(false);
  const shift = useRef(false);
  const respawnTimer = useRef(null);
  const lastSpawn = useRef(null);
  const positioned = useRef(false);
  const dimensions = useRef({ width: CARD_WIDTH, height: CARD_HEIGHT });
  const [cardWidth, setCardWidth] = useState(CARD_WIDTH);

  const changePhase = useCallback(value => { phaseRef.current = value; setPhase(value); }, []);
  const stop = useCallback(() => {
    generation.current += 1;
    clearTimeout(respawnTimer.current);
    respawnTimer.current = null;
    controls.current.forEach(control => control.stop());
    controls.current = [];
    ripple.set(1);
  }, [ripple]);
  const measure = useCallback(() => {
    const area = stage.current.getBoundingClientRect();
    const sink = button.current.getBoundingClientRect();
    target.current = { x: sink.left + sink.width / 2 - area.left, y: sink.top + sink.height / 2 - area.top };
    const geometry = cardGeometry(area.width, area.height);
    dimensions.current.width = geometry.cardWidth;
    setCardWidth(geometry.cardWidth);
    return { width: area.width, height: area.height, geometry };
  }, [stage, button]);
  const chooseSpawnPoint = useCallback(() => {
    const { geometry } = measure();
    const point = randomSpawnPoint(geometry, target.current, lastSpawn.current);
    lastSpawn.current = point;
    return point;
  }, [measure]);

  const open = useCallback(async (slowPlayback = false) => {
    stop();
    const point = chooseSpawnPoint();
    const token = generation.current;
    // Relocate while invisible; reappear at the random point, without a return flight.
    opacity.set(0); energy.set(0); dim.set(0);
    x.set(point.x); y.set(point.y); rotate.set(0);
    scale.set(reducedMotion ? REST_SCALE : .02);
    changePhase('opening');
    const duration = reducedMotion ? .12 : slowPlayback ? .9 : .3;
    const flight = [
      animate(scale, reducedMotion ? REST_SCALE : [.02, .9, REST_SCALE], {
        duration, ...(reducedMotion ? {} : { times: [0, .8, 1] }),
      }),
      animate(opacity, 1, { duration: duration * .6 }),
    ];
    controls.current = flight;
    await Promise.all(flight.map(control => control.finished));
    if (token === generation.current) changePhase('ready');
  }, [stop, chooseSpawnPoint, reducedMotion, changePhase, x, y, scale, opacity, rotate, energy, dim]);

  const collect = useCallback(async (slowPlayback = shift.current) => {
    if (phaseRef.current === 'folded') return;
    stop(); measure();
    const token = generation.current;
    const destination = { ...target.current };
    const frames = flightFrames({ x: x.get(), y: y.get() }, destination);
    const factor = slowPlayback ? 3 : 1;
    const duration = reducedMotion ? .12 : FLIGHT_DURATION * factor;
    const track = { duration, times: TIMES, ease: 'linear' };
    changePhase('collecting');
    const flight = reducedMotion ? [
      animate(x, destination.x, { duration }), animate(y, destination.y, { duration }),
      animate(scale, .02, { duration }), animate(opacity, 0, { duration }), animate(rotate, 0, { duration }),
    ] : [
      animate(x, frames.x, track), animate(y, frames.y, track),
      animate(scale, [scale.get(), ...SCALES.slice(1)], track),
      animate(rotate, [rotate.get(), ...ROTATIONS.slice(1)], track),
      animate(opacity, [opacity.get(), ...OPACITIES.slice(1)], track),
    ];
    // Recorded blank background: 255 → 193 over about 0.43 s; recovery starts
    // after the card is gone. Ambient controls are independent of flight completion.
    controls.current = [...flight,
      animate(dim, [dim.get(), .245, .245, 0], { duration: reducedMotion ? .2 : 1.35 * factor, times: [0, .32, .55, 1], ease: 'linear' }),
      animate(energy, reducedMotion ? [0, 0, 0, 0] : [energy.get(), 1, 1, 0], { duration: reducedMotion ? .12 : 1.1 * factor, times: [0, .2, .67, 1], ease: 'linear' }),
    ];
    await Promise.all(flight.map(control => control.finished));
    if (token !== generation.current) return;
    x.set(destination.x); y.set(destination.y);
    if (stage.current?.contains(document.activeElement) && document.activeElement?.classList.contains('floating-card')) button.current.focus({ preventScroll: true });
    changePhase('folded');
    if (!reducedMotion) {
      ripple.set(0);
      controls.current.push(animate(ripple, 1, { duration: .28 * factor }));
    }
    // Let the reference glow and dimming finish before the next card appears.
    respawnTimer.current = setTimeout(() => {
      if (generation.current === token && phaseRef.current === 'folded') open();
    }, reducedMotion ? 180 : 900 * factor);
  }, [stop, measure, reducedMotion, changePhase, x, y, scale, rotate, opacity, dim, energy, ripple, stage, button, open]);

  const release = useCallback(async (velocity, slowPlayback = shift.current) => {
    const speed = Math.hypot(velocity.x, velocity.y);
    if (reducedMotion || !Number.isFinite(speed) || speed < 220) return collect(slowPlayback);
    stop();
    const { width, height } = measure();
    const token = generation.current;
    const factor = slowPlayback ? 3 : 1;
    const velocityScale = Math.min(1, 3200 / speed) / factor;
    const vx = velocity.x * velocityScale;
    const vy = velocity.y * velocityScale;
    const insetX = Math.min(width / 2, dimensions.current.width * .84 / 2 + 12);
    const insetY = Math.min(height / 2, CARD_HEIGHT * .84 / 2 + 12);
    const inertia = {
      type: 'inertia', power: .24 * factor, timeConstant: 240 * factor,
      bounceStiffness: 380 / (factor * factor), bounceDamping: 32 / factor, restDelta: 2,
    };
    changePhase('throwing');
    const flight = [
      animate(x, x.get() + vx * inertia.power, { ...inertia, velocity: vx, min: insetX, max: width - insetX }),
      animate(y, y.get() + vy * inertia.power, { ...inertia, velocity: vy, min: insetY, max: height - insetY }),
    ];
    controls.current = [...flight,
      animate(rotate, clamp(velocity.x * .003, -12, 12), { duration: .22 * factor }),
      animate(scale, .84, { duration: .15 * factor }),
      animate(energy, 1, { duration: .1 }), animate(dim, .245, { duration: .15 }),
    ];
    await Promise.all(flight.map(control => control.finished));
    if (token === generation.current && phaseRef.current === 'throwing') collect(slowPlayback);
  }, [reducedMotion, collect, stop, measure, changePhase, x, y, rotate, scale, energy, dim]);

  const grab = useCallback(() => {
    stop(); dragged.current = false; changePhase('dragging');
    controls.current = [animate(scale, .84, { duration: .18 }), animate(opacity, 1, { duration: .08 }),
      animate(energy, reducedMotion ? 0 : .8, { duration: .25 }), animate(dim, .245, { duration: .42 })];
  }, [stop, changePhase, scale, opacity, energy, dim, reducedMotion]);
  const keyDown = useCallback(event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); collect(event.shiftKey); return; }
    const move = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
    if (!move) return;
    event.preventDefault(); grab();
    const { geometry } = measure();
    const point = keepInBounds({ x: x.get() + move[0], y: y.get() + move[1] }, geometry);
    x.set(point.x); y.set(point.y);
  }, [collect, grab, measure, x, y]);
  useLayoutEffect(() => {
    const layout = () => {
      const { geometry } = measure();
      if (!positioned.current) {
        positioned.current = true;
        const point = chooseSpawnPoint();
        x.set(point.x); y.set(point.y); opacity.set(1);
      } else if (phaseRef.current === 'ready' || phaseRef.current === 'opening') {
        const point = keepInBounds({ x: x.get(), y: y.get() }, geometry);
        x.set(point.x); y.set(point.y);
      }
      else if (phaseRef.current === 'folded') { x.set(target.current.x); y.set(target.current.y); }
      else if (phaseRef.current === 'collecting' || phaseRef.current === 'throwing') collect();
    };
    layout();
    const observer = new ResizeObserver(layout); observer.observe(stage.current);
    const keys = event => { shift.current = event.shiftKey; };
    const blur = () => { shift.current = false; if (phaseRef.current === 'dragging') collect(); };
    window.addEventListener('keydown', keys); window.addEventListener('keyup', keys); window.addEventListener('blur', blur);
    return () => { stop(); observer.disconnect(); window.removeEventListener('keydown', keys); window.removeEventListener('keyup', keys); window.removeEventListener('blur', blur); };
  }, [stage, measure, chooseSpawnPoint, x, y, opacity, collect, stop]);
  const signals = useMemo(() => ({ x, y, scale, opacity, energy, dim, ripple, phaseRef, target, dimensions, reducedMotion }),
    [x, y, scale, opacity, energy, dim, ripple, reducedMotion]);
  return { ...signals, signals, rotate, phase, grab, collect, release, keyDown, width: cardWidth, height: CARD_HEIGHT,
    dragStart: () => { dragged.current = true; },
    dragMove: info => rotate.set(clamp(info.velocity.x * .002, -5, 5)),
    releaseTap: event => { if (!dragged.current && phaseRef.current === 'dragging') collect(event.shiftKey); },
    toggle: event => phaseRef.current === 'folded' ? open(event.shiftKey) : collect(event.shiftKey) };
}
