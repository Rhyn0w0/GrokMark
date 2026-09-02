import type { Region } from './region';

export type Detection = {
  region: Region;
  score: number;
};

export type RegionDetector = (
  image: HTMLImageElement,
) => Promise<Detection | null>;

const minimumDetectionScore = 0.5;

export const detectRegion: RegionDetector = async (image) => {
  const { scanDocument } = await import('scanic');
  const result = await scanDocument(image, { mode: 'detect' });

  if (!result.success || !result.corners) {
    return null;
  }

  const score = result.confidence ?? result.score ?? 0;
  if (score < minimumDetectionScore) {
    return null;
  }

  return {
    region: {
      corners: [
        result.corners.topLeft,
        result.corners.topRight,
        result.corners.bottomRight,
        result.corners.bottomLeft,
      ],
    },
    score,
  };
};
