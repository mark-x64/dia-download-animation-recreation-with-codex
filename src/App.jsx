import { useRef, useState } from 'react';
import { motion, useTransform } from 'motion/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import PauseCircleFilledRounded from '@mui/icons-material/PauseCircleFilledRounded';
import CancelRounded from '@mui/icons-material/CancelRounded';
import Skeleton from '@mui/material/Skeleton';
import { SkeletonScene } from './SkeletonScene';
import { FluidLayer } from './FluidLayer';
import { useCardMotion } from './useCardMotion';

const theme = createTheme({ components: { MuiSkeleton: {
  defaultProps: { animation: false },
  styleOverrides: { root: { backgroundColor: '#e7e7e7', transform: 'none', borderRadius: 4 } },
} } });

export function App() {
  const stage = useRef(null);
  const button = useRef(null);
  const background = useRef(null);
  const [effectError, setEffectError] = useState('');
  const card = useCardMotion(stage, button);
  const buttonScale = useTransform(card.ripple, [0, .3, .65, 1], [1, .87, 1.06, 1]);
  const shadow = useTransform(card.energy, v => `0 ${4 + v * 7}px ${8 + v * 15}px rgba(0,0,0,${.13 + v * .07}), inset 0 1px 0 rgba(255,255,255,.8)`);
  const folded = card.phase === 'folded';

  return <ThemeProvider theme={theme}>
    <main ref={stage} className="stage" aria-label="Download animation" data-state={card.phase} data-effect-error={effectError || undefined}>
      <div ref={background} className="background-scene" aria-hidden="true"><SkeletonScene /></div>
      <motion.div className="dim-layer" style={{ opacity: card.dim }} aria-hidden="true" />
      <FluidLayer stage={stage} background={background} card={card} onError={setEffectError} />
      <div className="button-anchor">
        <motion.button ref={button} className="download-button" style={{ scale: buttonScale }}
          whileTap={{ scale: .92 }} onClick={card.toggle} aria-label={folded ? 'Show another card' : 'Collect card'}>
          <ArrowDownwardRounded sx={{ fontSize: 19 }} />
        </motion.button>
      </div>
      <motion.div className="floating-card" role="button" tabIndex={folded ? -1 : 0}
        aria-label="Drag or throw the card; release to collect it" aria-hidden={folded}
        drag dragMomentum={false} dragElastic={.04} dragConstraints={stage}
        onPointerDown={card.grab} onPointerUp={card.releaseTap} onDragStart={card.dragStart}
        onDrag={(_, info) => card.dragMove(info)}
        onDragEnd={(event, info) => card.release(info.velocity, event.shiftKey)}
        onPointerCancel={() => card.collect()} onKeyDown={card.keyDown}
        style={{ x: card.x, y: card.y, scale: card.scale, rotate: card.rotate, opacity: card.opacity,
          boxShadow: shadow, width: card.width, height: card.height, left: -card.width / 2,
          top: -card.height / 2, pointerEvents: folded ? 'none' : 'auto' }}>
        <span className="card-download"><ArrowDownwardRounded sx={{ fontSize: 24 }} /></span>
        <span className="card-lines" aria-hidden="true"><Skeleton width="100%" height={10} /><Skeleton width="70%" height={6} /></span>
        <PauseCircleFilledRounded className="card-action" sx={{ fontSize: 24 }} />
        <CancelRounded className="card-action" sx={{ fontSize: 24 }} />
      </motion.div>
      {effectError ? <span className="sr-only" role="alert">{effectError}</span> : null}
    </main>
  </ThemeProvider>;
}
