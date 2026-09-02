import { fullImageRegion, type Point, type Region } from './region';

export type WatermarkDefinition = {
  type: 'text' | 'image';
  text: string;
  image?: string;
};

type DrawWatermarkOptions = {
  canvas: HTMLCanvasElement;
  sourceImage: HTMLImageElement;
  watermarkImage: HTMLImageElement | null;
  watermark: WatermarkDefinition;
  watermarkText: string;
  opacity: number;
  scale: number;
  brightness: number;
  region?: Region;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function brightnessColor(value: number) {
  const channel = Math.round((clamp(value, 0, 100) / 100) * 255);
  return `rgb(${channel}, ${channel}, ${channel})`;
}

function createTintedWatermark(
  image: HTMLImageElement,
  width: number,
  height: number,
  color: string,
) {
  const tintedCanvas = document.createElement('canvas');
  tintedCanvas.width = Math.max(1, Math.ceil(width));
  tintedCanvas.height = Math.max(1, Math.ceil(height));

  const tintedContext = tintedCanvas.getContext('2d');
  if (!tintedContext) {
    return null;
  }

  tintedContext.drawImage(image, 0, 0, width, height);
  tintedContext.globalCompositeOperation = 'source-in';
  tintedContext.fillStyle = color;
  tintedContext.fillRect(0, 0, tintedCanvas.width, tintedCanvas.height);

  return tintedCanvas;
}

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function regionSize(region: Region) {
  const [topLeft, topRight, bottomRight, bottomLeft] = region.corners;

  return {
    width: Math.max(0.01, (distance(topLeft, topRight) + distance(bottomLeft, bottomRight)) / 2),
    height: Math.max(
      0.01,
      (distance(topLeft, bottomLeft) + distance(topRight, bottomRight)) / 2,
    ),
  };
}

function mapRegionPoint(region: Region, horizontal: number, vertical: number): Point {
  const [topLeft, topRight, bottomRight, bottomLeft] = region.corners;
  const top = {
    x: topLeft.x + (topRight.x - topLeft.x) * horizontal,
    y: topLeft.y + (topRight.y - topLeft.y) * horizontal,
  };
  const bottom = {
    x: bottomLeft.x + (bottomRight.x - bottomLeft.x) * horizontal,
    y: bottomLeft.y + (bottomRight.y - bottomLeft.y) * horizontal,
  };

  return {
    x: top.x + (bottom.x - top.x) * vertical,
    y: top.y + (bottom.y - top.y) * vertical,
  };
}

type Triangle = [Point, Point, Point];

function setTriangleTransform(
  context: CanvasRenderingContext2D,
  sourceTriangle: Triangle,
  destinationTriangle: Triangle,
) {
  const [sourceFirst, sourceSecond, sourceThird] = sourceTriangle;
  const [destinationFirst, destinationSecond, destinationThird] = destinationTriangle;
  const sourceSecondX = sourceSecond.x - sourceFirst.x;
  const sourceSecondY = sourceSecond.y - sourceFirst.y;
  const sourceThirdX = sourceThird.x - sourceFirst.x;
  const sourceThirdY = sourceThird.y - sourceFirst.y;
  const determinant = sourceSecondX * sourceThirdY - sourceThirdX * sourceSecondY;

  if (Math.abs(determinant) < 0.0001) {
    return false;
  }

  const destinationSecondX = destinationSecond.x - destinationFirst.x;
  const destinationSecondY = destinationSecond.y - destinationFirst.y;
  const destinationThirdX = destinationThird.x - destinationFirst.x;
  const destinationThirdY = destinationThird.y - destinationFirst.y;
  const a =
    (destinationSecondX * sourceThirdY - destinationThirdX * sourceSecondY) /
    determinant;
  const c =
    (sourceSecondX * destinationThirdX - sourceThirdX * destinationSecondX) /
    determinant;
  const b =
    (destinationSecondY * sourceThirdY - destinationThirdY * sourceSecondY) /
    determinant;
  const d =
    (sourceSecondX * destinationThirdY - sourceThirdX * destinationSecondY) /
    determinant;
  const e = destinationFirst.x - a * sourceFirst.x - c * sourceFirst.y;
  const f = destinationFirst.y - b * sourceFirst.x - d * sourceFirst.y;

  context.setTransform(a, b, c, d, e, f);
  return true;
}

function drawWarpedTriangle(
  context: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  sourceTriangle: Triangle,
  destinationTriangle: Triangle,
) {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.beginPath();
  context.moveTo(destinationTriangle[0].x, destinationTriangle[0].y);
  context.lineTo(destinationTriangle[1].x, destinationTriangle[1].y);
  context.lineTo(destinationTriangle[2].x, destinationTriangle[2].y);
  context.closePath();
  context.clip();

  if (setTriangleTransform(context, sourceTriangle, destinationTriangle)) {
    context.drawImage(layer, 0, 0);
  }

  context.restore();
}

function drawWarpedLayer(
  context: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  region: Region,
  startHorizontal: number,
  startVertical: number,
  width: number,
  height: number,
) {
  const meshSize = 12;

  for (let row = 0; row < meshSize; row += 1) {
    const verticalStart = startVertical + (height * row) / meshSize;
    const verticalEnd = startVertical + (height * (row + 1)) / meshSize;
    const sourceVerticalStart = (layer.height * row) / meshSize;
    const sourceVerticalEnd = (layer.height * (row + 1)) / meshSize;

    for (let column = 0; column < meshSize; column += 1) {
      const horizontalStart = startHorizontal + (width * column) / meshSize;
      const horizontalEnd = startHorizontal + (width * (column + 1)) / meshSize;
      const sourceHorizontalStart = (layer.width * column) / meshSize;
      const sourceHorizontalEnd = (layer.width * (column + 1)) / meshSize;
      const topLeft = mapRegionPoint(region, horizontalStart, verticalStart);
      const topRight = mapRegionPoint(region, horizontalEnd, verticalStart);
      const bottomRight = mapRegionPoint(region, horizontalEnd, verticalEnd);
      const bottomLeft = mapRegionPoint(region, horizontalStart, verticalEnd);
      const sourceTopLeft = { x: sourceHorizontalStart, y: sourceVerticalStart };
      const sourceTopRight = { x: sourceHorizontalEnd, y: sourceVerticalStart };
      const sourceBottomRight = { x: sourceHorizontalEnd, y: sourceVerticalEnd };
      const sourceBottomLeft = { x: sourceHorizontalStart, y: sourceVerticalEnd };

      drawWarpedTriangle(
        context,
        layer,
        [sourceTopLeft, sourceTopRight, sourceBottomLeft],
        [topLeft, topRight, bottomLeft],
      );
      drawWarpedTriangle(
        context,
        layer,
        [sourceTopRight, sourceBottomRight, sourceBottomLeft],
        [topRight, bottomRight, bottomLeft],
      );
    }
  }
}

export function drawWatermark({
  canvas,
  sourceImage,
  watermarkImage,
  watermark,
  watermarkText,
  opacity,
  scale,
  brightness,
  region,
}: DrawWatermarkOptions) {
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  const width = sourceImage.naturalWidth;
  const height = sourceImage.naturalHeight;
  const selectedRegion = region ?? fullImageRegion(width, height);
  const { width: regionWidth, height: regionHeight } = regionSize(selectedRegion);
  canvas.width = width;
  canvas.height = height;

  context.clearRect(0, 0, width, height);
  context.drawImage(sourceImage, 0, 0, width, height);

  const shortestEdge = Math.min(regionWidth, regionHeight);
  const margin = Math.min(Math.max(20, shortestEdge * 0.045), shortestEdge * 0.45);
  const maxMarkWidth = Math.max(0.01, regionWidth - margin * 2);
  const maxMarkHeight = Math.max(0.01, regionHeight - margin * 2);
  const targetMarkWidth = Math.min(regionWidth * (scale / 100), maxMarkWidth);
  let markWidth = targetMarkWidth;
  let markHeight = 0;
  let paddingX = 0;
  let paddingY = 0;
  let fontSize = 0;
  let label = '';
  let imageWidth = 0;
  let imageHeight = 0;

  if (watermark.type === 'image') {
    const sourceWidth = watermarkImage?.naturalWidth || 1;
    const sourceHeight = watermarkImage?.naturalHeight || 1;
    const imagePaddingRatio = 0.18;
    const outerSourceWidth = sourceWidth * (1 + imagePaddingRatio * 2);
    const outerSourceHeight = sourceHeight * (1 + imagePaddingRatio * 2);
    const imageScale = Math.min(
      targetMarkWidth / outerSourceWidth,
      maxMarkHeight / outerSourceHeight,
    );
    imageWidth = sourceWidth * imageScale;
    imageHeight = sourceHeight * imageScale;
    paddingX = imageWidth * imagePaddingRatio;
    paddingY = imageHeight * imagePaddingRatio;
    markWidth = Math.min(maxMarkWidth, imageWidth + paddingX * 2);
    markHeight = imageHeight + paddingY * 2;
  } else {
    label = (watermarkText.trim() || watermark.text || 'AI GENERATED').toUpperCase();
    context.font = '700 1px Arial, sans-serif';
    const textWidthAtUnitSize = context.measureText(label).width;
    const widthBasedFontSize = targetMarkWidth / (textWidthAtUnitSize + 1.8);
    const heightBasedFontSize = maxMarkHeight / 2.2;
    fontSize = Math.min(widthBasedFontSize, heightBasedFontSize);
    context.font = '700 ' + fontSize + 'px Arial, sans-serif';
    const textWidth = context.measureText(label).width;

    paddingX = fontSize * 0.9;
    paddingY = fontSize * 0.6;
    markWidth = Math.min(maxMarkWidth, textWidth + paddingX * 2);
    markHeight = fontSize + paddingY * 2;
  }

  const watermarkColor = brightnessColor(brightness);
  const layer = document.createElement('canvas');
  layer.width = Math.max(1, Math.ceil(markWidth));
  layer.height = Math.max(1, Math.ceil(markHeight));
  const layerContext = layer.getContext('2d');

  if (!layerContext) {
    return { width, height };
  }

  if (watermark.type === 'image') {
    const tintedWatermark = watermarkImage
      ? createTintedWatermark(watermarkImage, imageWidth, imageHeight, watermarkColor)
      : null;

    if (tintedWatermark) {
      layerContext.drawImage(tintedWatermark, paddingX, paddingY, imageWidth, imageHeight);
    }
  } else {
    layerContext.fillStyle = watermarkColor;
    layerContext.font = '700 ' + fontSize + 'px Arial, sans-serif';
    layerContext.textBaseline = 'middle';
    layerContext.fillText(label, paddingX, markHeight / 2);
  }

  const markHorizontalSize = markWidth / regionWidth;
  const markVerticalSize = markHeight / regionHeight;
  const marginHorizontalSize = margin / regionWidth;
  const marginVerticalSize = margin / regionHeight;
  const startHorizontal = clamp(
    1 - marginHorizontalSize - markHorizontalSize,
    0,
    1,
  );
  const startVertical = clamp(1 - marginVerticalSize - markVerticalSize, 0, 1);

  context.save();
  context.globalAlpha = opacity / 100;
  drawWarpedLayer(
    context,
    layer,
    selectedRegion,
    startHorizontal,
    startVertical,
    markHorizontalSize,
    markVerticalSize,
  );
  context.restore();
  return { width, height };
}
