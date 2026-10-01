// Screen recording landmarks at 50 ms intervals, in half-resolution pixels.
// 1.65–2.30 s: drop/lift, brief hesitation, fast flight, late shrink/fade.
// Map the measured trajectory by a similarity transform to any release point.
export const FLIGHT_DURATION = 0.66;
export const TIMES = [0, .076, .152, .227, .303, .379, .455, .530, .606, .682, .758, .833, .909, 1];
const SOURCE_TARGET = [198, 60];
const SOURCE_POINTS = [
  [1159, 698], [1157, 713], [1156, 730], [1155, 745],
  [1152, 762], [1146, 776], [1135, 791], [1122, 795],
  [1078, 757], [929, 667], [736, 510], [527, 337],
  [343, 181], [198, 60],
];
export const SCALES = [.44, .84, 1.065, 1.106, 1.07, 1.037, .995, 1.01, 1.01, 1, .95, .84, .63, .02];
export const ROTATIONS = [0, 0, -1, -2, -4, -7, -9, -7, -4, -2, -.5, 0, 0, 0];
export const OPACITIES = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, .7, .12, 0];

export function flightFrames(start, target) {
  const sx = SOURCE_POINTS[0][0] - SOURCE_TARGET[0];
  const sy = SOURCE_POINTS[0][1] - SOURCE_TARGET[1];
  const dx = start.x - target.x;
  const dy = start.y - target.y;
  const denominator = sx * sx + sy * sy;
  const a = (dx * sx + dy * sy) / denominator;
  const b = (dy * sx - dx * sy) / denominator;
  const points = SOURCE_POINTS.map(([x, y]) => {
    x -= SOURCE_TARGET[0]; y -= SOURCE_TARGET[1];
    return [target.x + a * x - b * y, target.y + b * x + a * y];
  });
  return { x: points.map(p => p[0]), y: points.map(p => p[1]) };
}
