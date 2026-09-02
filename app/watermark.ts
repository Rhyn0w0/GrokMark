export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

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
  position: WatermarkPosition;
  opacity: number;
  scale: number;
  brightness: number;
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

export function drawWatermark({
  canvas,
  sourceImage,
  watermarkImage,
  watermark,
  watermarkText,
  position,
  opacity,
  scale,
  brightness,
}: DrawWatermarkOptions) {
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  const width = sourceImage.naturalWidth;
  const height = sourceImage.naturalHeight;
  canvas.width = width;
  canvas.height = height;

  context.clearRect(0, 0, width, height);
  context.drawImage(sourceImage, 0, 0, width, height);

  const shortestEdge = Math.min(width, height);
  const margin = Math.min(Math.max(20, shortestEdge * 0.045), shortestEdge * 0.45);
  const maxMarkWidth = Math.max(0.01, width - margin * 2);
  const maxMarkHeight = Math.max(0.01, height - margin * 2);
  const targetMarkWidth = Math.min(width * (scale / 100), maxMarkWidth);
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

  let x = margin;
  let y = margin;

  if (position.includes('right')) {
    x = width - margin - markWidth;
  } else if (position.includes('center')) {
    x = (width - markWidth) / 2;
  }

  if (position === 'center' || position.startsWith('middle')) {
    y = (height - markHeight) / 2;
  } else if (position.startsWith('bottom')) {
    y = height - margin - markHeight;
  }

  const watermarkColor = brightnessColor(brightness);
  context.save();
  context.globalAlpha = opacity / 100;

  if (watermark.type === 'image') {
    const tintedWatermark = watermarkImage
      ? createTintedWatermark(watermarkImage, imageWidth, imageHeight, watermarkColor)
      : null;

    if (tintedWatermark) {
      context.drawImage(
        tintedWatermark,
        x + paddingX,
        y + paddingY,
        imageWidth,
        imageHeight,
      );
    }
  } else {
    context.fillStyle = watermarkColor;
    context.font = '700 ' + fontSize + 'px Arial, sans-serif';
    context.textBaseline = 'middle';
    context.fillText(label, x + paddingX, y + markHeight / 2);
  }

  context.restore();
  return { width, height };
}
