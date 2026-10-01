import Skeleton from '@mui/material/Skeleton';

function Lines({ short = false }) {
  return <div className="skeleton-lines">
    {(short ? ['92%', '67%'] : ['100%', '91%', '72%']).map((width, index) =>
      <Skeleton key={index} width={width} height={6} />)}
  </div>;
}

function Feature({ position, variant = '' }) {
  return <div className={`skeleton-cluster skeleton-feature ${position} ${variant}`}>
    <div className="skeleton-heading"><Skeleton width="56%" height={12} /><Skeleton width="29%" height={5} /></div>
    <Skeleton className="skeleton-cover" variant="rounded" width="100%" />
    <Lines />
    <div className="skeleton-byline"><Skeleton variant="circular" width={20} height={20} /><Skeleton width="27%" height={5} /></div>
  </div>;
}

function Summary({ position }) {
  return <div className={`skeleton-cluster skeleton-summary ${position}`}>
    <div className="skeleton-profile"><Skeleton variant="circular" width={38} height={38} /><div><Skeleton width="76%" height={10} /><Skeleton width="48%" height={5} /></div></div>
    <Lines />
    <div className="skeleton-metrics">{[0, 1, 2].map(i => <div key={i}><Skeleton width="64%" height={18} /><Skeleton width="100%" height={5} /></div>)}</div>
    <Lines short />
  </div>;
}

export function SkeletonScene() {
  return <div className="skeleton-layout">
    <Feature position="top-left" variant="primary" />
    <Summary position="top-middle" />
    <Feature position="top-right" />
    <div className="skeleton-side middle-left"><Lines short /></div>
    <div className="skeleton-side middle-right"><Lines short /></div>
    <Feature position="bottom-left" />
    <Summary position="bottom-middle" />
    <Feature position="bottom-right" />
  </div>;
}
