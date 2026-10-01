import { SCALES } from './referenceMotion.js';

export const CARD_WIDTH = 480;
export const CARD_HEIGHT = 86;
export const REST_SCALE = .8;
const MAX_SCALE = Math.max(...SCALES);
const MARGIN = 20;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function cardGeometry(width, height) {
  const cardWidth = Math.min(CARD_WIDTH, Math.max(220, (width - MARGIN * 2) / MAX_SCALE));
  const insetX = Math.min(width / 2, cardWidth * MAX_SCALE / 2 + MARGIN);
  const insetY = Math.min(height / 2, CARD_HEIGHT * MAX_SCALE / 2 + MARGIN);
  return { cardWidth, minX: insetX, maxX: width - insetX, minY: insetY, maxY: height - insetY };
}

export function keepInBounds(point, geometry) {
  return { x: clamp(point.x, geometry.minX, geometry.maxX), y: clamp(point.y, geometry.minY, geometry.maxY) };
}

export function randomSpawnPoint(geometry, target, previous, random = Math.random) {
  const clearOfButton = point => Math.abs(point.x - target.x) > geometry.cardWidth * REST_SCALE / 2 + 34
    || Math.abs(point.y - target.y) > CARD_HEIGHT * REST_SCALE / 2 + 40;
  const differentFromLast = point => !previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 110;
  for (let i = 0; i < 40; i++) {
    const point = {
      x: geometry.minX + random() * (geometry.maxX - geometry.minX),
      y: geometry.minY + random() * (geometry.maxY - geometry.minY),
    };
    if (clearOfButton(point) && differentFromLast(point)) return point;
  }
  // Very narrow viewports still have usable space above and below the button.
  const corners = [
    { x: geometry.minX, y: geometry.minY }, { x: geometry.maxX, y: geometry.minY },
    { x: geometry.minX, y: geometry.maxY }, { x: geometry.maxX, y: geometry.maxY },
  ].filter(point => clearOfButton(point) && differentFromLast(point));
  return corners[Math.floor(random() * corners.length)] || { x: geometry.minX, y: geometry.minY };
}
