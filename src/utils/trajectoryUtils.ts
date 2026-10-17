export interface Point {
  x: number; // 0 to 1000 in SVG coordinates
  y: number; // 0 to 460 in SVG coordinates
}

// Convert yard line (0 to 100) to SVG X coordinate (100 to 900)
// Yard 0 = 100px (Offense Goal Line)
// Yard 100 = 900px (Defense Goal Line)
export function yardToFieldX(yard: number): number {
  const clamped = Math.max(0, Math.min(100, yard));
  return 100 + clamped * 8;
}

// Convert SVG X coordinate to yard line (0 to 100)
export function fieldXToYard(x: number): number {
  const clampedX = Math.max(100, Math.min(900, x));
  return Math.round((clampedX - 100) / 8);
}

// Calculate total polyline distance
export function getPolylineLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

// Sample a point along a polyline at progress t (0 to 1)
export function samplePolyline(points: Point[], t: number): { x: number; y: number; angle: number } {
  if (!points || points.length === 0) {
    return { x: 500, y: 230, angle: 0 };
  }
  if (points.length === 1 || t <= 0) {
    const angle = points.length > 1 ? Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x) * (180 / Math.PI) : 0;
    return { x: points[0].x, y: points[0].y, angle };
  }
  if (t >= 1) {
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    const angle = Math.atan2(last.y - prev.y, last.x - prev.x) * (180 / Math.PI);
    return { x: last.x, y: last.y, angle };
  }

  const totalLength = getPolylineLength(points);
  if (totalLength === 0) {
    return { x: points[0].x, y: points[0].y, angle: 0 };
  }

  const targetDist = t * totalLength;
  let accumulated = 0;

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const segDist = Math.sqrt(dx * dx + dy * dy);

    if (accumulated + segDist >= targetDist || i === points.length - 1) {
      const segT = segDist > 0 ? (targetDist - accumulated) / segDist : 0;
      const x = p1.x + dx * segT;
      const y = p1.y + dy * segT;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      return { x, y, angle };
    }
    accumulated += segDist;
  }

  return { x: points[points.length - 1].x, y: points[points.length - 1].y, angle: 0 };
}

// Generate smooth SVG path string from array of points
export function pointsToSvgPath(points: Point[]): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}
