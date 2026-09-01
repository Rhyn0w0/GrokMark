'use client';

import type { CSSProperties, ChangeEvent, DragEvent, KeyboardEvent } from 'react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type Position =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

type Ink = 'white' | 'black' | 'lime';
type ExportFormat = 'png' | 'jpg';

type WatermarkOption = {
  id: string;
  provider: string;
  watermark: string;
  text: string;
  hint: string;
};

const watermarkOptions: WatermarkOption[] = [
  {
    id: 'grok/name',
    provider: 'grok',
    watermark: 'name',
    text: 'MADE WITH GROK',
    hint: 'Provider name',
  },
  {
    id: 'grok/logo',
    provider: 'grok',
    watermark: 'logo',
    text: 'GROK',
    hint: 'Provider logo label',
  },
  {
    id: 'gemini/name',
    provider: 'gemini',
    watermark: 'name',
    text: 'MADE WITH GEMINI',
    hint: 'Provider name',
  },
  {
    id: 'gemini/logo',
    provider: 'gemini',
    watermark: 'logo',
    text: 'GEMINI',
    hint: 'Provider logo label',
  },
  {
    id: 'chatgpt/name',
    provider: 'chatgpt',
    watermark: 'name',
    text: 'MADE WITH CHATGPT',
    hint: 'Provider name',
  },
  {
    id: 'chatgpt/logo',
    provider: 'chatgpt',
    watermark: 'logo',
    text: 'CHATGPT',
    hint: 'Provider logo label',
  },
  {
    id: 'midjourney/name',
    provider: 'midjourney',
    watermark: 'name',
    text: 'MADE WITH MIDJOURNEY',
    hint: 'Provider name',
  },
  {
    id: 'midjourney/logo',
    provider: 'midjourney',
    watermark: 'logo',
    text: 'MIDJOURNEY',
    hint: 'Provider logo label',
  },
  {
    id: 'custom/text',
    provider: 'custom',
    watermark: 'text',
    text: 'AI GENERATED',
    hint: 'Write your own copy',
  },
  {
    id: 'custom/image',
    provider: 'custom',
    watermark: 'image',
    text: 'CUSTOM IMAGE',
    hint: 'Use a custom image label',
  },
];

const positionOptions: Array<{
  id: Position;
  label: string;
  symbol: string;
}> = [
  { id: 'top-left', label: 'Top left', symbol: '↖' },
  { id: 'top-center', label: 'Top center', symbol: '↑' },
  { id: 'top-right', label: 'Top right', symbol: '↗' },
  { id: 'middle-left', label: 'Middle left', symbol: '←' },
  { id: 'center', label: 'Center', symbol: '•' },
  { id: 'middle-right', label: 'Middle right', symbol: '→' },
  { id: 'bottom-left', label: 'Bottom left', symbol: '↙' },
  { id: 'bottom-center', label: 'Bottom center', symbol: '↓' },
  { id: 'bottom-right', label: 'Bottom right', symbol: '↘' },
];

const inkOptions: Array<{ id: Ink; label: string }> = [
  { id: 'white', label: 'White ink' },
  { id: 'black', label: 'Black ink' },
  { id: 'lime', label: 'Lime ink' },
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function rangeFill(value: number, minimum: number, maximum: number) {
  return ((value - minimum) / (maximum - minimum)) * 100 + '%';
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watermarkPickerRef = useRef<HTMLDivElement>(null);
  const watermarkSearchRef = useRef<HTMLInputElement>(null);

  const [imageSource, setImageSource] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [sourceLabel, setSourceLabel] = useState('No image loaded');
  const [fileName, setFileName] = useState('grokmark-export');
  const [selectedWatermarkId, setSelectedWatermarkId] = useState('grok/name');
  const [watermarkSearch, setWatermarkSearch] = useState('');
  const [isWatermarkMenuOpen, setIsWatermarkMenuOpen] = useState(false);
  const [highlightedWatermarkIndex, setHighlightedWatermarkIndex] = useState(0);
  const [watermarkText, setWatermarkText] = useState('MADE WITH GROK');
  const [position, setPosition] = useState<Position>('bottom-right');
  const [opacity, setOpacity] = useState(82);
  const [scale, setScale] = useState(100);
  const [ink, setInk] = useState<Ink>('white');
  const [frosted, setFrosted] = useState(true);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [isDragging, setIsDragging] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !imageSource) {
      setCanvasReady(false);
      return;
    }

    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      const context = canvas.getContext('2d');
      if (!context) {
        setNotice('This browser could not create a canvas preview.');
        return;
      }

      const width = image.naturalWidth;
      const height = image.naturalHeight;
      canvas.width = width;
      canvas.height = height;
      setImageSize({ width, height });

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const shortestEdge = Math.min(width, height);
      const margin = Math.max(20, shortestEdge * 0.045);
      const label = (watermarkText.trim() || 'AI GENERATED').toUpperCase();
      let fontSize = clamp(shortestEdge * 0.044 * (scale / 100), 18, 104);

      context.font = '700 ' + fontSize + 'px Arial, sans-serif';
      let textWidth = context.measureText(label).width;
      const maxMarkWidth = Math.max(90, width - margin * 2);
      const requestedMarkWidth = textWidth + fontSize * 1.8;

      if (requestedMarkWidth > maxMarkWidth) {
        fontSize = Math.max(12, fontSize * (maxMarkWidth / requestedMarkWidth));
        context.font = '700 ' + fontSize + 'px Arial, sans-serif';
        textWidth = context.measureText(label).width;
      }

      const paddingX = fontSize * 0.9;
      const paddingY = fontSize * 0.6;
      const markWidth = Math.min(maxMarkWidth, textWidth + paddingX * 2);
      const markHeight = fontSize + paddingY * 2;

      let x = margin;
      let y = margin;

      if (position.includes('right')) {
        x = width - margin - markWidth;
      } else if (position.includes('center')) {
        x = (width - markWidth) / 2;
      }

      if (position.startsWith('middle')) {
        y = (height - markHeight) / 2;
      } else if (position.startsWith('bottom')) {
        y = height - margin - markHeight;
      }

      const colors = {
        white: {
          text: '#ffffff',
          surface: 'rgba(15, 29, 27, .72)',
          shadow: 'rgba(15, 29, 27, .24)',
        },
        black: {
          text: '#17241f',
          surface: 'rgba(255, 252, 244, .88)',
          shadow: 'rgba(255, 252, 244, .2)',
        },
        lime: {
          text: '#163027',
          surface: 'rgba(217, 255, 90, .92)',
          shadow: 'rgba(24, 59, 51, .22)',
        },
      };
      const selectedColors = colors[ink];

      context.save();
      context.globalAlpha = opacity / 100;
      context.shadowColor = selectedColors.shadow;
      context.shadowBlur = frosted ? fontSize * 0.75 : fontSize * 0.35;
      context.shadowOffsetY = fontSize * 0.14;

      if (frosted) {
        context.fillStyle = selectedColors.surface;
        drawRoundedRect(context, x, y, markWidth, markHeight, fontSize * 0.42);
        context.fill();
      }

      context.shadowColor = 'transparent';
      context.fillStyle = selectedColors.text;
      context.font = '700 ' + fontSize + 'px Arial, sans-serif';
      context.textBaseline = 'middle';
      context.fillText(label, x + paddingX, y + markHeight / 2);
      context.restore();
      setCanvasReady(true);
    };
    image.onerror = () => {
      setCanvasReady(false);
      setNotice('That image could not be read. Try a PNG, JPG, or WEBP file.');
    };
    image.src = imageSource;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [frosted, imageSource, ink, opacity, position, scale, watermarkText]);

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
      setImageSource(String(reader.result));
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

    setImageSource(demoImage);
    setImageSize({ width: 1600, height: 1200 });
    setSourceLabel('GrokMark sample illustration');
    setFileName('grokmark-sample');
    setNotice('Sample loaded. Try moving the mark or changing its text.');
  }

  function clearImage() {
    setImageSource(null);
    setImageSize(null);
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
  }

  const selectedWatermark =
    watermarkOptions.find((option) => option.id === selectedWatermarkId) ??
    watermarkOptions[0];
  const normalizedWatermarkSearch = watermarkSearch.trim().toLowerCase();
  const filteredWatermarkOptions = normalizedWatermarkSearch
    ? watermarkOptions.filter((option) =>
        `${option.provider}/${option.watermark} ${option.hint}`
          .toLowerCase()
          .includes(normalizedWatermarkSearch),
      )
    : watermarkOptions;

  function chooseWatermarkOption(option: WatermarkOption) {
    setSelectedWatermarkId(option.id);
    setWatermarkText(option.text);
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

  const displaySize = imageSize
    ? imageSize.width + ' × ' + imageSize.height
    : 'Waiting for an image';

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
              <span className="character-count">{watermarkText.length}/32</span>
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
                          ? `watermark-option-${filteredWatermarkOptions[highlightedWatermarkIndex].id.replace('/', '-')}`
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
                          id={`watermark-option-${option.id.replace('/', '-')}`}
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
                </div>
              ) : null}
            </div>

            <label className="field-kicker" htmlFor="watermark-text">
              Visible copy
            </label>
            <div className="text-input-wrap">
              <input
                id="watermark-text"
                type="text"
                maxLength={32}
                value={watermarkText}
                onChange={(event) => setWatermarkText(event.target.value)}
                placeholder="AI GENERATED"
              />
              <span aria-hidden="true">↗</span>
            </div>
          </div>

          <div className="control-section">
            <div className="section-heading">
              <span className="section-label">Position</span>
              <span className="section-value">
                {positionOptions.find((option) => option.id === position)?.label}
              </span>
            </div>
            <div className="position-grid" aria-label="Watermark position">
              {positionOptions.map((option) => (
                <button
                  className={position === option.id ? 'position-button is-selected' : 'position-button'}
                  key={option.id}
                  type="button"
                  onClick={() => setPosition(option.id)}
                  aria-label={option.label}
                  aria-pressed={position === option.id}
                >
                  {option.symbol}
                </button>
              ))}
            </div>
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
                <output htmlFor="scale">{scale}%</output>
              </div>
              <input
                id="scale"
                type="range"
                min="70"
                max="150"
                value={scale}
                style={
                  {
                    '--range-fill': rangeFill(scale, 70, 150),
                  } as CSSProperties
                }
                onChange={(event) => setScale(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="control-section compact-section">
            <div className="section-heading">
              <span className="section-label">Ink</span>
              <span className="section-value">Choose a contrast</span>
            </div>
            <div className="ink-list">
              {inkOptions.map((option) => (
                <button
                  className={
                    ink === option.id ? 'ink-button is-selected' : 'ink-button'
                  }
                  key={option.id}
                  type="button"
                  onClick={() => setInk(option.id)}
                  aria-label={option.label}
                  aria-pressed={ink === option.id}
                >
                  <span className={'ink-swatch ink-swatch--' + option.id} />
                </button>
              ))}
            </div>
          </div>

          <div className="control-section compact-section switch-row">
            <div>
              <span className="section-label">Frosted backing</span>
              <span className="helper-text">Keeps the mark readable on busy art</span>
            </div>
            <button
              className={frosted ? 'switch is-on' : 'switch'}
              type="button"
              role="switch"
              aria-checked={frosted}
              onClick={() => setFrosted((current) => !current)}
            >
              <span />
            </button>
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

          <div className={'canvas-stage' + (imageSource ? ' has-image' : '')}>
            {imageSource ? (
              <canvas ref={canvasRef} aria-label="Watermarked image preview" />
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
      </footer>
    </main>
  );
}
