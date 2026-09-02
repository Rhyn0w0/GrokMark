'use client';

import type {
  CSSProperties,
  ChangeEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import Link from 'next/link';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import defaultWatermarkConfig from '../config/watermarks.json';
import { detectRegion } from './detect';
import { fullImageRegion, type Point, type Region } from './region';
import {
  drawWatermark,
  type WatermarkDefinition,
} from './watermark';

type CornerIndex = 0 | 1 | 2 | 3;

type Dimensions = {
  width: number;
  height: number;
};

type PreviewBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ExportFormat = 'png' | 'jpg';
type WatermarkType = 'text' | 'image';

type WatermarkPreset = {
  id: string;
  label: string;
  type: WatermarkType;
  text?: string;
  image?: string;
  hint?: string;
};

type ProviderConfig = {
  id: string;
  name: string;
  watermarks: WatermarkPreset[];
};

type WatermarkConfig = {
  version: number;
  providers: ProviderConfig[];
};

type WatermarkChoice = WatermarkDefinition & {
  id: string;
  providerId: string;
  provider: string;
  watermarkId: string;
  watermark: string;
  hint: string;
};

const watermarkStorageKey = 'grokmark-watermark-config';
const watermarkConfigChangeEvent = 'grokmark-watermark-config-change';
const newProviderValue = '__new_provider__';
const maxWatermarkTextLength = 32;
const minWatermarkScale = 0.1;
const maxWatermarkScale = 90;
const sizeSliderMin = 0;
const sizeSliderMax = 100;
const sizeSliderStep = 0.1;
const sizeSliderCenter = 50;
const defaultWatermarkScale = 15;
const watermarkScaleCenter = 15;
const defaultProviders = defaultWatermarkConfig.providers as ProviderConfig[];
const regionCornerOptions: Array<{
  index: CornerIndex;
  label: string;
}> = [
  { index: 0, label: 'Top left region corner' },
  { index: 1, label: 'Top right region corner' },
  { index: 2, label: 'Bottom right region corner' },
  { index: 3, label: 'Bottom left region corner' },
];

function flattenWatermarkConfig(providers: ProviderConfig[]) {
  return providers.flatMap((provider) =>
    provider.watermarks.map((watermark) => ({
      id: `${provider.id}/${watermark.id}`,
      providerId: provider.id,
      provider: provider.name,
      watermarkId: watermark.id,
      watermark: watermark.label,
      type: watermark.type,
      text:
        watermark.text?.trim() || watermark.label.toUpperCase(),
      image: watermark.image,
      hint:
        watermark.hint ||
        (watermark.type === 'image' ? 'Image link' : 'Plain text'),
    })),
  );
}

const defaultWatermarkOptions = flattenWatermarkConfig(defaultProviders);
const defaultSelectedWatermarkId =
  defaultWatermarkOptions.find((option) => option.id === 'grok/image')?.id ??
  defaultWatermarkOptions[0]?.id ??
  '';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWatermarkConfig(value: unknown): value is WatermarkConfig {
  if (!isRecord(value) || !Array.isArray(value.providers)) {
    return false;
  }

  return value.providers.every((provider) => {
    if (
      !isRecord(provider) ||
      typeof provider.id !== 'string' ||
      typeof provider.name !== 'string' ||
      !provider.name.trim() ||
      !Array.isArray(provider.watermarks) ||
      provider.watermarks.length === 0
    ) {
      return false;
    }

    return provider.watermarks.every((watermark) => {
      if (
        !isRecord(watermark) ||
        typeof watermark.id !== 'string' ||
        typeof watermark.label !== 'string' ||
        !watermark.label.trim() ||
        (watermark.type !== 'text' && watermark.type !== 'image')
      ) {
        return false;
      }

      return watermark.type === 'text'
        ? typeof watermark.text === 'string' && Boolean(watermark.text.trim())
        : typeof watermark.image === 'string' && Boolean(watermark.image.trim());
    });
  });
}

function parseStoredWatermarkConfig(serializedConfig: string | null) {
  if (!serializedConfig) {
    return null;
  }

  try {
    const parsedConfig: unknown = JSON.parse(serializedConfig);
    return isWatermarkConfig(parsedConfig)
      ? cloneProviders(parsedConfig.providers)
      : null;
  } catch {
    return null;
  }
}

function subscribeToWatermarkConfig(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(watermarkConfigChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(watermarkConfigChangeEvent, onStoreChange);
  };
}

function getWatermarkConfigSnapshot() {
  try {
    return window.localStorage.getItem(watermarkStorageKey);
  } catch {
    return null;
  }
}

function getServerWatermarkConfigSnapshot() {
  return null;
}

function cloneProviders(providers: ProviderConfig[]) {
  return providers.map((provider) => ({
    ...provider,
    watermarks: provider.watermarks.map((watermark) => ({ ...watermark })),
  }));
}

function slugify(value: string, fallback: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}

function uniqueId(base: string, existingIds: Set<string>) {
  let candidate = base;
  let suffix = 2;

  while (existingIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function isImageReference(value: string) {
  if (value.startsWith('/')) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function optionDomId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function mapPoint(point: Point, source: Dimensions, target: Dimensions): Point {
  if (!source.width || !source.height) {
    return { x: 0, y: 0 };
  }

  return {
    x: (point.x / source.width) * target.width,
    y: (point.y / source.height) * target.height,
  };
}

function clampPoint(point: Point, bounds: Dimensions): Point {
  return {
    x: clamp(point.x, 0, bounds.width),
    y: clamp(point.y, 0, bounds.height),
  };
}

function rangeFill(value: number, minimum: number, maximum: number) {
  return ((value - minimum) / (maximum - minimum)) * 100 + '%';
}

function scaleFromSliderPosition(position: number) {
  const clampedPosition = clamp(position, sizeSliderMin, sizeSliderMax);

  if (clampedPosition <= sizeSliderCenter) {
    const normalizedPosition =
      (clampedPosition - sizeSliderMin) /
      (sizeSliderCenter - sizeSliderMin);

    return (
      minWatermarkScale *
      Math.pow(
        watermarkScaleCenter / minWatermarkScale,
        normalizedPosition,
      )
    );
  }

  const normalizedPosition =
    (clampedPosition - sizeSliderCenter) /
    (sizeSliderMax - sizeSliderCenter);

  return (
    watermarkScaleCenter *
    Math.pow(maxWatermarkScale / watermarkScaleCenter, normalizedPosition)
  );
}

function sliderPositionFromScale(value: number) {
  const clampedScale = clamp(value, minWatermarkScale, maxWatermarkScale);

  if (clampedScale <= watermarkScaleCenter) {
    const normalizedScale =
      Math.log(clampedScale / minWatermarkScale) /
      Math.log(watermarkScaleCenter / minWatermarkScale);

    return (
      sizeSliderMin +
      normalizedScale * (sizeSliderCenter - sizeSliderMin)
    );
  }

  const normalizedScale =
    Math.log(clampedScale / watermarkScaleCenter) /
    Math.log(maxWatermarkScale / watermarkScaleCenter);

  return (
    sizeSliderCenter +
    normalizedScale * (sizeSliderMax - sizeSliderCenter)
  );
}

function formatWatermarkScale(value: number) {
  return (value < 10 ? value.toFixed(1) : Math.round(value)) + '%';
}

function createDemoImage() {
  const demoCanvas = document.createElement('canvas');
  demoCanvas.width = 1600;
  demoCanvas.height = 1200;

  const context = demoCanvas.getContext('2d');
  if (!context) {
    return '';
  }

  const background = context.createLinearGradient(0, 0, 1600, 1200);
  background.addColorStop(0, '#dcefe7');
  background.addColorStop(0.52, '#f3e8d6');
  background.addColorStop(1, '#e4c8ae');
  context.fillStyle = background;
  context.fillRect(0, 0, 1600, 1200);

  context.fillStyle = 'rgba(255, 255, 255, .42)';
  context.beginPath();
  context.arc(1240, 240, 180, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#f5ac79';
  context.beginPath();
  context.arc(1260, 250, 108, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#9abca9';
  context.beginPath();
  context.moveTo(0, 760);
  context.bezierCurveTo(280, 560, 460, 590, 690, 775);
  context.bezierCurveTo(890, 930, 1100, 600, 1600, 700);
  context.lineTo(1600, 1200);
  context.lineTo(0, 1200);
  context.closePath();
  context.fill();

  context.fillStyle = '#46796d';
  context.beginPath();
  context.moveTo(0, 900);
  context.bezierCurveTo(250, 720, 520, 790, 810, 940);
  context.bezierCurveTo(1080, 1080, 1250, 800, 1600, 820);
  context.lineTo(1600, 1200);
  context.lineTo(0, 1200);
  context.closePath();
  context.fill();

  context.strokeStyle = 'rgba(24, 59, 51, .36)';
  context.lineWidth = 18;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(280, 270);
  context.bezierCurveTo(420, 160, 520, 220, 565, 360);
  context.bezierCurveTo(615, 510, 760, 490, 812, 340);
  context.stroke();

  context.strokeStyle = 'rgba(255, 255, 255, .72)';
  context.lineWidth = 10;
  context.beginPath();
  context.moveTo(330, 320);
  context.bezierCurveTo(435, 245, 490, 280, 540, 390);
  context.bezierCurveTo(590, 500, 720, 490, 775, 385);
  context.stroke();

  context.fillStyle = '#f6f0e7';
  context.beginPath();
  context.arc(410, 470, 36, 0, Math.PI * 2);
  context.arc(510, 505, 46, 0, Math.PI * 2);
  context.arc(618, 465, 34, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = 'rgba(24, 59, 51, .17)';
  context.fillRect(108, 1025, 1384, 2);

  return demoCanvas.toDataURL('image/jpeg', 0.92);
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watermarkPickerRef = useRef<HTMLDivElement>(null);
  const watermarkSearchRef = useRef<HTMLInputElement>(null);
  const addWatermarkProviderRef = useRef<HTMLSelectElement>(null);
  const addWatermarkLabelRef = useRef<HTMLInputElement>(null);
  const activeCornerRef = useRef<CornerIndex | null>(null);
  const hasInteractedWithRegionRef = useRef(false);

  const [imageSource, setImageSource] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [sourceLabel, setSourceLabel] = useState('No image loaded');
  const [fileName, setFileName] = useState('grokmark-export');
  const storedWatermarkConfig = useSyncExternalStore(
    subscribeToWatermarkConfig,
    getWatermarkConfigSnapshot,
    getServerWatermarkConfigSnapshot,
  );
  const providerConfigs =
    parseStoredWatermarkConfig(storedWatermarkConfig) ?? defaultProviders;
  const [selectedWatermarkId, setSelectedWatermarkId] = useState(
    defaultSelectedWatermarkId,
  );
  const [watermarkSearch, setWatermarkSearch] = useState('');
  const [isWatermarkMenuOpen, setIsWatermarkMenuOpen] = useState(false);
  const [highlightedWatermarkIndex, setHighlightedWatermarkIndex] = useState(0);
  const [watermarkText, setWatermarkText] = useState(
    defaultWatermarkOptions[0]?.text ?? 'AI GENERATED',
  );
  const [isAddWatermarkOpen, setIsAddWatermarkOpen] = useState(false);
  const [newProviderId, setNewProviderId] = useState(
    defaultProviders[0]?.id ?? newProviderValue,
  );
  const [newProviderName, setNewProviderName] = useState('');
  const [newWatermarkLabel, setNewWatermarkLabel] = useState('');
  const [newWatermarkType, setNewWatermarkType] = useState<WatermarkType>('text');
  const [newWatermarkText, setNewWatermarkText] = useState('');
  const [newWatermarkImage, setNewWatermarkImage] = useState('');
  const [addWatermarkError, setAddWatermarkError] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(50);
  const [scale, setScale] = useState(defaultWatermarkScale);
  const [brightness, setBrightness] = useState(100);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [region, setRegion] = useState<Region | null>(null);
  const [regionSource, setRegionSource] = useState<'detected' | 'manual' | null>(null);
  const [isDetectingRegion, setIsDetectingRegion] = useState(false);
  const [isRegionOverlayVisible, setIsRegionOverlayVisible] = useState(false);
  const [activeCorner, setActiveCorner] = useState<CornerIndex | null>(null);
  const [previewBounds, setPreviewBounds] = useState<PreviewBounds | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const watermarkOptions = flattenWatermarkConfig(providerConfigs);
  const selectedWatermark: WatermarkChoice =
    watermarkOptions.find((option) => option.id === selectedWatermarkId) ??
    watermarkOptions[0] ??
    ({
      id: 'fallback/name',
      providerId: 'fallback',
      provider: 'Provider',
      watermarkId: 'name',
      watermark: 'name',
      type: 'text',
      text: 'AI GENERATED',
      hint: 'Plain text',
    } satisfies WatermarkChoice);
  const normalizedWatermarkSearch = watermarkSearch.trim().toLowerCase();
  const filteredWatermarkOptions = normalizedWatermarkSearch
    ? watermarkOptions.filter((option) =>
        `${option.provider}/${option.watermark} ${option.hint}`
          .toLowerCase()
          .includes(normalizedWatermarkSearch),
      )
    : watermarkOptions;
  const selectedWatermarkType = selectedWatermark.type;
  const selectedWatermarkImage = selectedWatermark.image;
  const selectedWatermarkText = selectedWatermark.text;

  function saveProviderConfigs(nextProviders: ProviderConfig[]) {
    try {
      const configToStore: WatermarkConfig = {
        version: 1,
        providers: nextProviders,
      };
      window.localStorage.setItem(watermarkStorageKey, JSON.stringify(configToStore));
      window.dispatchEvent(new Event(watermarkConfigChangeEvent));
      return true;
    } catch {
      setNotice('Custom watermarks could not be saved in this browser.');
      return false;
    }
  }

  function updateProviderConfigs(
    update: (currentProviders: ProviderConfig[]) => ProviderConfig[],
  ) {
    return saveProviderConfigs(update(providerConfigs));
  }

  function getImagePointFromPointer(event: ReactPointerEvent): Point | null {
    const canvas = canvasRef.current;
    if (!canvas || !imageSize) {
      return null;
    }

    const canvasRect = canvas.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) {
      return null;
    }

    return clampPoint(
      mapPoint(
        {
          x: event.clientX - canvasRect.left,
          y: event.clientY - canvasRect.top,
        },
        { width: canvasRect.width, height: canvasRect.height },
        imageSize,
      ),
      imageSize,
    );
  }

  function updateRegionCorner(index: CornerIndex, point: Point) {
    if (!imageSize) {
      return;
    }

    hasInteractedWithRegionRef.current = true;
    setRegionSource('manual');
    setRegion((currentRegion) => {
      const nextCorners = [
        ...(currentRegion ?? fullImageRegion(imageSize.width, imageSize.height))
          .corners,
      ] as Region['corners'];
      nextCorners[index] = clampPoint(point, imageSize);
      return { corners: nextCorners };
    });
  }

  function nudgeRegionCorner(index: CornerIndex, deltaX: number, deltaY: number) {
    if (!imageSize) {
      return;
    }

    hasInteractedWithRegionRef.current = true;
    setRegionSource('manual');
    setRegion((currentRegion) => {
      const baseRegion =
        currentRegion ?? fullImageRegion(imageSize.width, imageSize.height);
      const currentCorner = baseRegion.corners[index];
      const nextCorners = [...baseRegion.corners] as Region['corners'];
      nextCorners[index] = clampPoint(
        {
          x: currentCorner.x + deltaX,
          y: currentCorner.y + deltaY,
        },
        imageSize,
      );
      return { corners: nextCorners };
    });
  }

  function handleCornerPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    index: CornerIndex,
  ) {
    if (!imageSize) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    hasInteractedWithRegionRef.current = true;
    activeCornerRef.current = index;
    setActiveCorner(index);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCornerPointerMove(
    event: ReactPointerEvent<HTMLButtonElement>,
    index: CornerIndex,
  ) {
    if (activeCornerRef.current !== index) {
      return;
    }

    const point = getImagePointFromPointer(event);
    if (point) {
      updateRegionCorner(index, point);
    }
  }

  function handleCornerPointerEnd(
    event: ReactPointerEvent<HTMLButtonElement>,
    index: CornerIndex,
  ) {
    if (activeCornerRef.current !== index) {
      return;
    }

    activeCornerRef.current = null;
    setActiveCorner(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleCornerKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: CornerIndex,
  ) {
    const step = event.shiftKey ? 10 : 1;
    const deltas: Record<string, Point> = {
      ArrowUp: { x: 0, y: -step },
      ArrowRight: { x: step, y: 0 },
      ArrowDown: { x: 0, y: step },
      ArrowLeft: { x: -step, y: 0 },
    };
    const delta = deltas[event.key];

    if (!delta) {
      return;
    }

    event.preventDefault();
    nudgeRegionCorner(index, delta.x, delta.y);
  }

  function resetRegion() {
    hasInteractedWithRegionRef.current = true;
    activeCornerRef.current = null;
    setActiveCorner(null);
    setRegion(null);
    setRegionSource(null);
    setIsRegionOverlayVisible(Boolean(imageSource));
  }

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !imageSource) {
      setCanvasReady(false);
      return;
    }

    setCanvasReady(false);
    const previewCanvas = canvas;
    const sourceImage = new Image();
    const watermarkImage =
      selectedWatermarkType === 'image' ? new Image() : null;
    let sourceReady = false;
    let watermarkReady = watermarkImage === null;
    let isCancelled = false;

    sourceImage.decoding = 'async';
    if (watermarkImage) {
      watermarkImage.crossOrigin = 'anonymous';
      watermarkImage.decoding = 'async';
    }

    function drawPreview() {
      if (!sourceReady || !watermarkReady || isCancelled) {
        return;
      }

      const context = previewCanvas.getContext('2d');
      if (!context) {
        setNotice('This browser could not create a canvas preview.');
        return;
      }

      const result = drawWatermark({
        canvas: previewCanvas,
        sourceImage,
        watermarkImage,
        watermark: {
          type: selectedWatermarkType,
          text: selectedWatermarkText,
          image: selectedWatermarkImage,
        },
        watermarkText,
        opacity,
        scale,
        brightness,
        region: region ?? undefined,
      });
      if (result) {
        setImageSize(result);
        setCanvasReady(true);
      }
    }

    sourceImage.onload = () => {
      sourceReady = true;
      drawPreview();
    };
    sourceImage.onerror = () => {
      setCanvasReady(false);
      setNotice('That image could not be read. Try a PNG, JPG, or WEBP file.');
    };

    if (watermarkImage) {
      watermarkImage.onload = () => {
        watermarkReady = true;
        drawPreview();
      };
      watermarkImage.onerror = () => {
        setCanvasReady(false);
        setNotice('That watermark image could not be loaded. Check its image link.');
      };
      watermarkImage.src = selectedWatermarkImage ?? '';
    }

    sourceImage.src = imageSource;

    return () => {
      isCancelled = true;
      sourceImage.onload = null;
      sourceImage.onerror = null;
      if (watermarkImage) {
        watermarkImage.onload = null;
        watermarkImage.onerror = null;
      }
    };
  }, [
    brightness,
    imageSource,
    opacity,
    scale,
    selectedWatermark.id,
    selectedWatermarkImage,
    selectedWatermarkText,
    selectedWatermarkType,
    region,
    watermarkText,
  ]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;

    if (!canvas || !stage || !imageSource) {
      setPreviewBounds(null);
      return;
    }

    const previewCanvas = canvas;
    const previewStage = stage;

    function measurePreview() {
      const canvasRect = previewCanvas.getBoundingClientRect();
      const stageRect = previewStage.getBoundingClientRect();

      if (!canvasRect.width || !canvasRect.height) {
        return;
      }

      const nextBounds = {
        left: canvasRect.left - stageRect.left - previewStage.clientLeft,
        top: canvasRect.top - stageRect.top - previewStage.clientTop,
        width: canvasRect.width,
        height: canvasRect.height,
      };

      setPreviewBounds((currentBounds) => {
        if (
          currentBounds &&
          currentBounds.left === nextBounds.left &&
          currentBounds.top === nextBounds.top &&
          currentBounds.width === nextBounds.width &&
          currentBounds.height === nextBounds.height
        ) {
          return currentBounds;
        }

        return nextBounds;
      });
    }

    measurePreview();
    window.addEventListener('resize', measurePreview);

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measurePreview);
    resizeObserver?.observe(previewCanvas);
    resizeObserver?.observe(previewStage);

    return () => {
      window.removeEventListener('resize', measurePreview);
      resizeObserver?.disconnect();
    };
  }, [imageSource, imageSize]);

  useEffect(() => {
    if (!imageSource) {
      return;
    }

    let isCancelled = false;
    const sourceImage = new Image();
    sourceImage.decoding = 'async';
    sourceImage.onload = async () => {
      try {
        const detection = await detectRegion(sourceImage);
        if (!detection || isCancelled || hasInteractedWithRegionRef.current) {
          return;
        }

        setRegion(detection.region);
        setRegionSource('detected');
        setIsRegionOverlayVisible(true);
        setNotice('Drawing region detected. Drag the corners to adjust it.');
      } catch {
        // Detection is an enhancement. The full-image editor remains usable.
      } finally {
        if (!isCancelled) {
          setIsDetectingRegion(false);
        }
      }
    };
    sourceImage.onerror = () => {
      if (!isCancelled) {
        setIsDetectingRegion(false);
      }
    };
    sourceImage.src = imageSource;

    return () => {
      isCancelled = true;
      sourceImage.onload = null;
      sourceImage.onerror = null;
    };
  }, [imageSource]);

  useEffect(() => {
    if (!isWatermarkMenuOpen) {
      return;
    }

    watermarkSearchRef.current?.focus();

    function closeOnOutsideClick(event: PointerEvent) {
      if (
        watermarkPickerRef.current &&
        !watermarkPickerRef.current.contains(event.target as Node)
      ) {
        setIsWatermarkMenuOpen(false);
      }
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsWatermarkMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isWatermarkMenuOpen]);

  useEffect(() => {
    if (!isAddWatermarkOpen) {
      return;
    }

    addWatermarkLabelRef.current?.focus();

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        closeAddWatermarkDialog();
      }
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isAddWatermarkOpen]);

  function acceptImage(file: File) {
    if (!file.type.startsWith('image/')) {
      setNotice('Choose an image file to get started.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setNotice('That file is over 25 MB. Choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      hasInteractedWithRegionRef.current = false;
      setImageSource(String(reader.result));
      setImageSize(null);
      setRegion(null);
      setRegionSource(null);
      setIsDetectingRegion(true);
      setIsRegionOverlayVisible(true);
      setSourceLabel(file.name);
      setFileName(file.name.replace(/\.[^/.]+$/, '') || 'grokmark-export');
      setNotice(null);
    };
    reader.onerror = () => setNotice('The image could not be loaded. Try again.');
    reader.readAsDataURL(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      acceptImage(file);
    }
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      acceptImage(file);
    }
  }

  function loadDemo() {
    const demoImage = createDemoImage();
    if (!demoImage) {
      setNotice('The sample image could not be created in this browser.');
      return;
    }

    hasInteractedWithRegionRef.current = false;
    setImageSource(demoImage);
    setImageSize(null);
    setRegion(null);
    setRegionSource(null);
    setIsDetectingRegion(true);
    setIsRegionOverlayVisible(true);
    setSourceLabel('GrokMark sample illustration');
    setFileName('grokmark-sample');
    setNotice('Sample loaded. Try moving the mark or changing its text.');
  }

  function clearImage() {
    hasInteractedWithRegionRef.current = false;
    setImageSource(null);
    setImageSize(null);
    setRegion(null);
    setRegionSource(null);
    setIsDetectingRegion(false);
    setIsRegionOverlayVisible(false);
    activeCornerRef.current = null;
    setActiveCorner(null);
    setSourceLabel('No image loaded');
    setCanvasReady(false);
    setNotice(null);
  }

  function handleExport() {
    const canvas = canvasRef.current;
    if (!canvas || !canvasReady) {
      setNotice('Add an image before exporting.');
      return;
    }

    const mimeType = exportFormat === 'png' ? 'image/png' : 'image/jpeg';
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setNotice('The marked image could not be exported.');
            return;
          }

          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download =
            (fileName || 'grokmark-export') + '-watermarked.' + exportFormat;
          link.click();
          URL.revokeObjectURL(downloadUrl);
          setNotice('Exported ' + exportFormat.toUpperCase() + '.');
        },
        mimeType,
        0.92,
      );
    } catch {
      setNotice(
        'This image link does not allow browser export. Try another image link.',
      );
    }
  }

  function openAddWatermarkDialog() {
    setIsWatermarkMenuOpen(false);
    setNewProviderId(providerConfigs[0]?.id ?? newProviderValue);
    setNewProviderName('');
    setNewWatermarkLabel('');
    setNewWatermarkType('text');
    setNewWatermarkText('');
    setNewWatermarkImage('');
    setAddWatermarkError(null);
    setIsAddWatermarkOpen(true);
  }

  function closeAddWatermarkDialog() {
    setIsAddWatermarkOpen(false);
    setAddWatermarkError(null);
  }

  function handleAddWatermark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const label = newWatermarkLabel.trim();
    if (!label) {
      setAddWatermarkError('Give this watermark a name.');
      return;
    }

    const isNewProvider = newProviderId === newProviderValue;
    const selectedProviderConfig = providerConfigs.find(
      (provider) => provider.id === newProviderId,
    );
    const providerName = isNewProvider
      ? newProviderName.trim()
      : selectedProviderConfig?.name ?? '';

    if (!providerName) {
      setAddWatermarkError('Give the new provider a name.');
      return;
    }

    const value =
      newWatermarkType === 'text'
        ? newWatermarkText.trim()
        : newWatermarkImage.trim();

    if (!value) {
      setAddWatermarkError(
        newWatermarkType === 'text'
          ? 'Add the text people should see.'
          : 'Add an image link.',
      );
      return;
    }

    if (newWatermarkType === 'image' && !isImageReference(value)) {
      setAddWatermarkError('Use an http, https, or site-relative image link.');
      return;
    }

    const providerId = isNewProvider
      ? uniqueId(
          slugify(providerName, 'provider'),
          new Set(providerConfigs.map((provider) => provider.id)),
        )
      : newProviderId;
    const watermarkId = uniqueId(
      slugify(label, 'watermark'),
      new Set(selectedProviderConfig?.watermarks.map((watermark) => watermark.id)),
    );
    const newPreset: WatermarkPreset = {
      id: watermarkId,
      label,
      type: newWatermarkType,
      hint: newWatermarkType === 'text' ? 'Plain text' : 'Image link',
      ...(newWatermarkType === 'text' ? { text: value } : { image: value }),
    };

    const didSave = updateProviderConfigs((currentProviders) => {
      if (isNewProvider) {
        return [
          ...currentProviders,
          { id: providerId, name: providerName, watermarks: [newPreset] },
        ];
      }

      return currentProviders.map((provider) =>
        provider.id === providerId
          ? {
              ...provider,
              watermarks: [...provider.watermarks, newPreset],
            }
          : provider,
      );
    });
    if (!didSave) {
      return;
    }

    setSelectedWatermarkId(`${providerId}/${watermarkId}`);
    setWatermarkText(
      newWatermarkType === 'text' ? value : label.toUpperCase(),
    );
    setWatermarkSearch('');
    setHighlightedWatermarkIndex(0);
    setIsAddWatermarkOpen(false);
    setAddWatermarkError(null);
    setNotice(`Added ${providerName} / ${label}.`);
  }

  function chooseWatermarkOption(option: WatermarkChoice) {
    setSelectedWatermarkId(option.id);
    setWatermarkText(
      option.type === 'text' ? option.text : option.watermark.toUpperCase(),
    );
    setWatermarkSearch('');
    setHighlightedWatermarkIndex(0);
    setIsWatermarkMenuOpen(false);
  }

  function handleWatermarkSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedWatermarkIndex((current) =>
        Math.min(current + 1, Math.max(filteredWatermarkOptions.length - 1, 0)),
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedWatermarkIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const option = filteredWatermarkOptions[highlightedWatermarkIndex];
      if (option) {
        chooseWatermarkOption(option);
      }
    }
  }

  const sizeSliderValue = sliderPositionFromScale(scale);
  const displaySize = imageSize
    ? imageSize.width + ' × ' + imageSize.height
    : 'Waiting for an image';
  const displayRegion = imageSize
    ? region ?? fullImageRegion(imageSize.width, imageSize.height)
    : null;
  const scaleReference = region ? 'region width' : 'image width';

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="GrokMark home">
          <span className="brand-symbol" aria-hidden="true">
            𝕏
          </span>
          <span>GrokMark</span>
        </Link>

        <div className="topbar-status">
          <span className="status-dot" aria-hidden="true" />
          Runs in your browser
        </div>

        <a className="topbar-link" href="#how-it-works">
          How it works <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            Photo marker / beta
          </p>
          <h1 id="page-title">
            Make the origin <span>clear.</span>
          </h1>
          <p className="hero-description">
            Add a visible AI watermark to photos, illustrations, and drawings
            before they leave your screen.
          </p>
        </div>

        <div className="privacy-note">
          <span className="privacy-icon" aria-hidden="true">
            ◌
          </span>
          <div>
            <span>Privacy by default</span>
            <strong>Your image stays on this device.</strong>
          </div>
        </div>
      </section>

      <section className="editor-grid" aria-label="GrokMark editor">
        <aside className="controls-panel panel">
          <div className="panel-heading">
            <div>
              <p className="panel-label">01 / mark it</p>
              <h2>Watermark settings</h2>
            </div>
            {imageSource ? (
              <button className="quiet-button" type="button" onClick={clearImage}>
                Clear
              </button>
            ) : null}
          </div>

          <div className="control-section upload-section">
            <label
              className={'upload-zone' + (isDragging ? ' is-dragging' : '')}
              htmlFor="image-upload"
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (event.currentTarget === event.target) {
                  setIsDragging(false);
                }
              }}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                id="image-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
              />
              <span className="upload-icon" aria-hidden="true">
                ↥
              </span>
              <span className="upload-title">
                {imageSource ? 'Replace your image' : 'Drop an image here'}
              </span>
              <span className="upload-copy">PNG, JPG, or WEBP · 25 MB max</span>
            </label>
            <button className="sample-link" type="button" onClick={loadDemo}>
              Or try the sample illustration <span aria-hidden="true">↗</span>
            </button>
          </div>

          <div className="control-section watermark-section">
            <div className="section-heading">
              <div className="section-heading__stack">
                <span className="section-label">Watermark</span>
                <span className="section-helper">Provider / treatment</span>
              </div>
            </div>

            <div className="watermark-picker" ref={watermarkPickerRef}>
              <button
                className={
                  isWatermarkMenuOpen
                    ? 'watermark-trigger is-open'
                    : 'watermark-trigger'
                }
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isWatermarkMenuOpen}
                aria-label="Choose a watermark"
                onClick={() => {
                  setIsWatermarkMenuOpen((current) => !current);
                  setWatermarkSearch('');
                  setHighlightedWatermarkIndex(
                    Math.max(
                      watermarkOptions.findIndex(
                        (option) => option.id === selectedWatermarkId,
                      ),
                      0,
                    ),
                  );
                }}
              >
                <span className="watermark-trigger__value">
                  <span className="watermark-token">{selectedWatermark.provider}</span>
                  <span className="watermark-slash">/</span>
                  <span>{selectedWatermark.watermark}</span>
                </span>
                <span className="watermark-trigger__hint">{selectedWatermark.hint}</span>
                <span className="watermark-trigger__chevron" aria-hidden="true">
                  ⌄
                </span>
              </button>

              {isWatermarkMenuOpen ? (
                <div className="watermark-menu">
                  <div className="watermark-search-wrap">
                    <span aria-hidden="true">⌕</span>
                    <input
                      ref={watermarkSearchRef}
                      type="search"
                      role="combobox"
                      aria-label="Search watermark options"
                      aria-controls="watermark-options"
                      aria-expanded="true"
                      aria-activedescendant={
                        filteredWatermarkOptions[highlightedWatermarkIndex]
                          ? `watermark-option-${optionDomId(filteredWatermarkOptions[highlightedWatermarkIndex].id)}`
                          : undefined
                      }
                      placeholder="Search options"
                      value={watermarkSearch}
                      onChange={(event) => {
                        setWatermarkSearch(event.target.value);
                        setHighlightedWatermarkIndex(0);
                      }}
                      onKeyDown={handleWatermarkSearchKeyDown}
                    />
                  </div>

                  <div
                    className="watermark-options"
                    id="watermark-options"
                    role="listbox"
                    aria-label="Watermark options"
                  >
                    {filteredWatermarkOptions.length ? (
                      filteredWatermarkOptions.map((option, index) => (
                        <button
                          className={
                            option.id === selectedWatermarkId
                              ? 'watermark-option is-selected'
                              : index === highlightedWatermarkIndex
                                ? 'watermark-option is-highlighted'
                                : 'watermark-option'
                          }
                          id={`watermark-option-${optionDomId(option.id)}`}
                          key={option.id}
                          type="button"
                          role="option"
                          aria-selected={option.id === selectedWatermarkId}
                          onMouseEnter={() => setHighlightedWatermarkIndex(index)}
                          onClick={() => chooseWatermarkOption(option)}
                        >
                          <span className="watermark-option__label">
                            <span className="watermark-token">{option.provider}</span>
                            <span className="watermark-slash">/</span>
                            <span>{option.watermark}</span>
                          </span>
                          <span className="watermark-option__hint">{option.hint}</span>
                          {option.id === selectedWatermarkId ? (
                            <span className="watermark-option__check" aria-hidden="true">
                              ✓
                            </span>
                          ) : null}
                        </button>
                      ))
                    ) : (
                      <p className="watermark-empty">No watermark matches that search.</p>
                    )}
                  </div>
                  <div className="watermark-menu__footer">
                    <button
                      className="add-watermark-button"
                      type="button"
                      aria-haspopup="dialog"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        openAddWatermarkDialog();
                      }}
                      onClick={openAddWatermarkDialog}
                    >
                      <span aria-hidden="true">＋</span>
                      Add watermark
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="control-section region-section">
            <div className="section-heading">
              <div className="section-heading__stack">
                <span className="section-label">Region</span>
                <span className="section-helper">Where the mark sits</span>
              </div>
              <span className="section-value">
                {isDetectingRegion
                  ? 'Finding drawing'
                  : regionSource === 'detected'
                    ? 'Detected'
                    : regionSource === 'manual'
                      ? 'Custom'
                      : 'Whole image'}
              </span>
            </div>
            <div className="region-actions">
              <button
                className={
                  isRegionOverlayVisible
                    ? 'quiet-button region-toggle is-active'
                    : 'quiet-button region-toggle'
                }
                type="button"
                aria-pressed={isRegionOverlayVisible}
                disabled={!imageSource}
                onClick={() => {
                  activeCornerRef.current = null;
                  setActiveCorner(null);
                  setIsRegionOverlayVisible((current) => !current);
                }}
              >
                {isRegionOverlayVisible ? 'Hide overlay' : 'Show overlay'}
              </button>
              <button
                className="quiet-button region-reset"
                type="button"
                disabled={!imageSource || !region}
                onClick={resetRegion}
              >
                {regionSource === 'detected' ? 'Use whole image' : 'Reset'}
              </button>
            </div>
            <p className="section-helper region-helper">
              Drag the four corners to frame the drawing.
            </p>
          </div>

          <div className="control-section">
            <div className="range-control">
              <div className="section-heading">
                <label className="section-label" htmlFor="opacity">
                  Opacity
                </label>
                <output htmlFor="opacity">{opacity}%</output>
              </div>
              <input
                id="opacity"
                type="range"
                min="20"
                max="100"
                value={opacity}
                style={
                  {
                    '--range-fill': rangeFill(opacity, 20, 100),
                  } as CSSProperties
                }
                onChange={(event) => setOpacity(Number(event.target.value))}
              />
            </div>
            <div className="range-control">
              <div className="section-heading">
                <label className="section-label" htmlFor="scale">
                  Size
                </label>
                <output htmlFor="scale">
                  {formatWatermarkScale(scale)} of {scaleReference}
                </output>
              </div>
              <input
                id="scale"
                type="range"
                min={sizeSliderMin}
                max={sizeSliderMax}
                step={sizeSliderStep}
                value={sizeSliderValue}
                aria-label={'Watermark size relative to ' + scaleReference}
                aria-valuemin={minWatermarkScale}
                aria-valuemax={maxWatermarkScale}
                aria-valuenow={scale}
                aria-valuetext={
                  formatWatermarkScale(scale) + ' of ' + scaleReference
                }
                style={
                  {
                    '--range-fill': rangeFill(
                      sizeSliderValue,
                      sizeSliderMin,
                      sizeSliderMax,
                    ),
                  } as CSSProperties
                }
                onChange={(event) =>
                  setScale(scaleFromSliderPosition(Number(event.target.value)))
                }
              />
            </div>
            <div className="range-control">
              <div className="section-heading">
                <label className="section-label" htmlFor="brightness">
                  Brightness
                </label>
                <output htmlFor="brightness">{brightness}%</output>
              </div>
              <input
                id="brightness"
                type="range"
                min="0"
                max="100"
                value={brightness}
                style={
                  {
                    '--range-fill': rangeFill(brightness, 0, 100),
                  } as CSSProperties
                }
                onChange={(event) => setBrightness(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="export-block">
            <div className="export-heading">
              <div>
                <p className="panel-label">02 / export</p>
                <h3>Ready to share?</h3>
              </div>
              <select
                value={exportFormat}
                onChange={(event) =>
                  setExportFormat(event.target.value as ExportFormat)
                }
                aria-label="Export format"
              >
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
              </select>
            </div>
            <button
              className="export-button"
              type="button"
              onClick={handleExport}
              disabled={!imageSource || !canvasReady}
            >
              <span>
                {imageSource
                  ? 'Download ' + exportFormat.toUpperCase()
                  : 'Add an image to export'}
              </span>
              <span aria-hidden="true">↓</span>
            </button>
            <p className="export-note">
              No account. No upload queue. Your original stays untouched.
            </p>
          </div>
        </aside>

        <section className="preview-panel panel" aria-labelledby="preview-heading">
          <div className="preview-heading">
            <div>
              <p className="panel-label">Live canvas</p>
              <h2 id="preview-heading">See it before it leaves.</h2>
            </div>
            <span className="live-chip">
              <span className="status-dot" aria-hidden="true" />
              Live preview
            </span>
          </div>

          <div
            ref={stageRef}
            className={'canvas-stage' + (imageSource ? ' has-image' : '')}
          >
            {imageSource ? (
              <>
                <canvas ref={canvasRef} aria-label="Watermarked image preview" />
                {isRegionOverlayVisible && displayRegion && previewBounds ? (
                  <div
                    className="region-overlay"
                    role="group"
                    aria-label="Watermark region"
                    style={{
                      left: previewBounds.left,
                      top: previewBounds.top,
                      width: previewBounds.width,
                      height: previewBounds.height,
                    }}
                  >
                    <svg
                      className="region-overlay__outline"
                      viewBox={`0 0 ${imageSize?.width ?? 0} ${imageSize?.height ?? 0}`}
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <polygon
                        points={displayRegion.corners
                          .map((corner) => `${corner.x},${corner.y}`)
                          .join(' ')}
                      />
                    </svg>
                    {regionCornerOptions.map((cornerOption) => {
                      const corner = displayRegion.corners[cornerOption.index];
                      const previewPoint = mapPoint(
                        corner,
                        imageSize ?? { width: 1, height: 1 },
                        { width: 100, height: 100 },
                      );

                      return (
                        <button
                          className={
                            activeCorner === cornerOption.index
                              ? 'region-handle is-active'
                              : 'region-handle'
                          }
                          key={cornerOption.index}
                          type="button"
                          aria-label={cornerOption.label}
                          style={{
                            left: `${previewPoint.x}%`,
                            top: `${previewPoint.y}%`,
                          }}
                          onPointerDown={(event) =>
                            handleCornerPointerDown(event, cornerOption.index)
                          }
                          onPointerMove={(event) =>
                            handleCornerPointerMove(event, cornerOption.index)
                          }
                          onPointerUp={(event) =>
                            handleCornerPointerEnd(event, cornerOption.index)
                          }
                          onPointerCancel={(event) =>
                            handleCornerPointerEnd(event, cornerOption.index)
                          }
                          onLostPointerCapture={(event) =>
                            handleCornerPointerEnd(event, cornerOption.index)
                          }
                          onKeyDown={(event) =>
                            handleCornerKeyDown(event, cornerOption.index)
                          }
                        />
                      );
                    })}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="sample-art" aria-label="Sample artwork preview">
                <span className="sample-art__sun" />
                <span className="sample-art__hill sample-art__hill--back" />
                <span className="sample-art__hill sample-art__hill--front" />
                <span className="sample-art__loop" />
                <span className="sample-art__grain" />
                <span className="sample-mark">
                  <span aria-hidden="true">✦</span>{' '}
                  {watermarkText.trim() || 'AI GENERATED'}
                </span>
              </div>
            )}
            {!imageSource ? (
              <div className="empty-stage-copy">
                <span>Drop your photo on the left</span>
                <small>Or load the sample to test the controls.</small>
              </div>
            ) : null}
          </div>

          <div className="preview-meta">
            <div>
              <span className="meta-label">Current source</span>
              <strong>{sourceLabel}</strong>
            </div>
            <div className="meta-right">
              <span className="meta-label">Canvas size</span>
              <strong>{displaySize}</strong>
            </div>
          </div>

          {notice ? (
            <p className="notice" role="status">
              <span aria-hidden="true">✦</span> {notice}
            </p>
          ) : null}
        </section>
      </section>

      <section className="how-it-works" id="how-it-works">
        <div>
          <span className="step-number">A</span>
          <strong>Bring an image.</strong>
          <span>Photo, illustration, or a drawing inside a photo.</span>
        </div>
        <div>
          <span className="step-number">B</span>
          <strong>Make the mark yours.</strong>
          <span>Choose a provider mark or write the label people need to see.</span>
        </div>
        <div>
          <span className="step-number">C</span>
          <strong>Download the marked copy.</strong>
          <span>The original file never changes.</span>
        </div>
      </section>

      <footer className="site-footer">
        <span>GrokMark / a small tool for clearer sharing</span>
        <span>Built for the browser, ready for Vercel</span>
        <a
          className="site-footer__link"
          href="https://github.com/Rhyn0w0/GrokMark"
          target="_blank"
          rel="noreferrer"
        >
          View on GitHub <span aria-hidden="true">↗</span>
        </a>
      </footer>

      {isAddWatermarkOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAddWatermarkDialog();
            }
          }}
        >
          <section
            className="watermark-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-watermark-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="panel-label">New preset</p>
                <h2 id="add-watermark-title">Add a watermark</h2>
              </div>
              <button
                className="dialog-close"
                type="button"
                aria-label="Close add watermark dialog"
                onClick={closeAddWatermarkDialog}
              >
                ×
              </button>
            </div>
            <p className="dialog-copy">
              Add a text label or an image link to an existing provider, or start a new one.
            </p>

            <form className="watermark-form" onSubmit={handleAddWatermark}>
              <label className="dialog-field" htmlFor="new-watermark-provider">
                <span>Provider</span>
                <select
                  ref={addWatermarkProviderRef}
                  id="new-watermark-provider"
                  value={newProviderId}
                  onChange={(event) => {
                    setNewProviderId(event.target.value);
                    setAddWatermarkError(null);
                  }}
                >
                  {providerConfigs.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                  <option value={newProviderValue}>New provider</option>
                </select>
              </label>

              {newProviderId === newProviderValue ? (
                <label className="dialog-field" htmlFor="new-provider-name">
                  <span>New provider name</span>
                  <input
                    id="new-provider-name"
                    type="text"
                    maxLength={32}
                    value={newProviderName}
                    onChange={(event) => {
                      setNewProviderName(event.target.value);
                      setAddWatermarkError(null);
                    }}
                    placeholder="Your provider"
                  />
                </label>
              ) : null}

              <label className="dialog-field" htmlFor="new-watermark-label">
                <span>Watermark name</span>
                <input
                  ref={addWatermarkLabelRef}
                  id="new-watermark-label"
                  type="text"
                  maxLength={24}
                  value={newWatermarkLabel}
                  onChange={(event) => {
                    setNewWatermarkLabel(event.target.value);
                    setAddWatermarkError(null);
                  }}
                  placeholder="name, badge, or image"
                />
              </label>

              <fieldset className="dialog-field dialog-type-field">
                <legend>Watermark type</legend>
                <div className="type-toggle">
                  <button
                    className={
                      newWatermarkType === 'text'
                        ? 'type-toggle__button is-selected'
                        : 'type-toggle__button'
                    }
                    type="button"
                    aria-pressed={newWatermarkType === 'text'}
                    onClick={() => {
                      setNewWatermarkType('text');
                      setAddWatermarkError(null);
                    }}
                  >
                    Plain text
                  </button>
                  <button
                    className={
                      newWatermarkType === 'image'
                        ? 'type-toggle__button is-selected'
                        : 'type-toggle__button'
                    }
                    type="button"
                    aria-pressed={newWatermarkType === 'image'}
                    onClick={() => {
                      setNewWatermarkType('image');
                      setAddWatermarkError(null);
                    }}
                  >
                    Image link
                  </button>
                </div>
              </fieldset>

              {newWatermarkType === 'text' ? (
                <label className="dialog-field" htmlFor="new-watermark-text">
                  <span>Text shown on the image</span>
                  <input
                    id="new-watermark-text"
                    type="text"
                    maxLength={maxWatermarkTextLength}
                    value={newWatermarkText}
                    onChange={(event) => {
                      setNewWatermarkText(event.target.value);
                      setAddWatermarkError(null);
                    }}
                    placeholder="MADE WITH YOUR PROVIDER"
                  />
                </label>
              ) : (
                <label className="dialog-field" htmlFor="new-watermark-image">
                  <span>Image URL</span>
                  <input
                    id="new-watermark-image"
                    type="text"
                    inputMode="url"
                    value={newWatermarkImage}
                    onChange={(event) => {
                      setNewWatermarkImage(event.target.value);
                      setAddWatermarkError(null);
                    }}
                    placeholder="https://example.com/watermark.svg"
                  />
                  {isImageReference(newWatermarkImage.trim()) ? (
                    <span className="dialog-image-preview">
                      {/* User-provided image links cannot use Next's fixed image loader. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={newWatermarkImage.trim()} alt="" />
                      Image preview
                    </span>
                  ) : null}
                </label>
              )}

              {addWatermarkError ? (
                <p className="dialog-error" role="alert">
                  {addWatermarkError}
                </p>
              ) : null}

              <div className="dialog-actions">
                <button
                  className="quiet-button"
                  type="button"
                  onClick={closeAddWatermarkDialog}
                >
                  Cancel
                </button>
                <button className="dialog-submit" type="submit">
                  Add + select
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
