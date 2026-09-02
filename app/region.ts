export type Point = {
  x: number;
  y: number;
};

export type Region = {
  corners: [Point, Point, Point, Point];
};

export function fullImageRegion(width: number, height: number): Region {
  return {
    corners: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
  };
}

export function boundingBox(region: Region) {
  const xValues = region.corners.map((corner) => corner.x);
  const yValues = region.corners.map((corner) => corner.y);
  const minX = Math.min(...xValues);
  const minY = Math.min(...yValues);

  return {
    x: minX,
    y: minY,
    width: Math.max(...xValues) - minX,
    height: Math.max(...yValues) - minY,
  };
}
