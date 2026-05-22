import { useCallback, useEffect, useRef, useState } from "react";
import { Crop, X } from "lucide-react";

const DEFAULT_CROP = { x: 8, y: 8, width: 84, height: 84 };
const MIN_CROP_SIZE = 12;
const MAX_OUTPUT_SIZE = 1800;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function calculateNextCrop(action, startCrop, dxPercent, dyPercent) {
  if (action === "move") {
    return {
      ...startCrop,
      x: clamp(startCrop.x + dxPercent, 0, 100 - startCrop.width),
      y: clamp(startCrop.y + dyPercent, 0, 100 - startCrop.height),
    };
  }

  const next = { ...startCrop };

  if (action.includes("e")) {
    next.width = clamp(startCrop.width + dxPercent, MIN_CROP_SIZE, 100 - startCrop.x);
  }

  if (action.includes("s")) {
    next.height = clamp(startCrop.height + dyPercent, MIN_CROP_SIZE, 100 - startCrop.y);
  }

  if (action.includes("w")) {
    const nextX = clamp(startCrop.x + dxPercent, 0, startCrop.x + startCrop.width - MIN_CROP_SIZE);
    next.x = nextX;
    next.width = startCrop.width + startCrop.x - nextX;
  }

  if (action.includes("n")) {
    const nextY = clamp(startCrop.y + dyPercent, 0, startCrop.y + startCrop.height - MIN_CROP_SIZE);
    next.y = nextY;
    next.height = startCrop.height + startCrop.y - nextY;
  }

  return next;
}

function loadImage(sourceUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = sourceUrl;
  });
}

function canvasToBlob(canvas, type) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Could not crop image"));
      },
      type,
      0.92,
    );
  });
}

function croppedFileName(fileName, type) {
  const extension = type === "image/png" ? "png" : "jpg";
  const baseName = fileName.replace(/\.[^.]+$/, "") || "image";
  return `${baseName}-cropped.${extension}`;
}

async function cropImageFile(file, sourceUrl, crop) {
  const image = await loadImage(sourceUrl);
  const sourceX = Math.round((crop.x / 100) * image.naturalWidth);
  const sourceY = Math.round((crop.y / 100) * image.naturalHeight);
  const sourceWidth = Math.round((crop.width / 100) * image.naturalWidth);
  const sourceHeight = Math.round((crop.height / 100) * image.naturalHeight);
  const scale = Math.min(1, MAX_OUTPUT_SIZE / Math.max(sourceWidth, sourceHeight));
  const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
  const outputHeight = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not crop image");
  }

  canvas.width = outputWidth;
  canvas.height = outputHeight;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await canvasToBlob(canvas, outputType);
  return new File([blob], croppedFileName(file.name, outputType), {
    type: outputType,
    lastModified: Date.now(),
  });
}

export default function ImageCropModal({ file, sourceUrl, title, onCancel, onUseOriginal, onApply }) {
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const [crop, setCrop] = useState(DEFAULT_CROP);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [imageBox, setImageBox] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState("");

  const recalculateImageBox = useCallback(() => {
    if (!stageRef.current || !naturalSize.width || !naturalSize.height) return;

    const stageRect = stageRef.current.getBoundingClientRect();
    const imageRatio = naturalSize.width / naturalSize.height;
    const stageRatio = stageRect.width / stageRect.height;
    let width = stageRect.width;
    let height = stageRect.height;
    let left = 0;
    let top = 0;

    if (stageRatio > imageRatio) {
      height = stageRect.height;
      width = height * imageRatio;
      left = (stageRect.width - width) / 2;
    } else {
      width = stageRect.width;
      height = width / imageRatio;
      top = (stageRect.height - height) / 2;
    }

    setImageBox({ left, top, width, height });
  }, [naturalSize]);

  useEffect(() => {
    recalculateImageBox();

    if (!stageRef.current) return undefined;

    let resizeObserver;
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(recalculateImageBox);
      resizeObserver.observe(stageRef.current);
    } else {
      window.addEventListener("resize", recalculateImageBox);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", recalculateImageBox);
      }
    };
  }, [recalculateImageBox]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const drag = dragRef.current;
      if (!drag || !imageBox) return;

      event.preventDefault();
      const dxPercent = ((event.clientX - drag.startX) / imageBox.width) * 100;
      const dyPercent = ((event.clientY - drag.startY) / imageBox.height) * 100;
      setCrop(calculateNextCrop(drag.action, drag.startCrop, dxPercent, dyPercent));
    };

    const handlePointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [imageBox]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const beginCropAction = (action, event) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      action,
      startX: event.clientX,
      startY: event.clientY,
      startCrop: crop,
    };
  };

  const applyCrop = async () => {
    setIsApplying(true);
    setError("");
    try {
      const croppedFile = await cropImageFile(file, sourceUrl, crop);
      onApply(croppedFile);
    } catch (cropError) {
      setError(cropError.message);
      setIsApplying(false);
    }
  };

  const selectionStyle = imageBox
    ? {
        left: imageBox.left + (crop.x / 100) * imageBox.width,
        top: imageBox.top + (crop.y / 100) * imageBox.height,
        width: (crop.width / 100) * imageBox.width,
        height: (crop.height / 100) * imageBox.height,
      }
    : undefined;

  return (
    <div className="crop-modal-backdrop">
      <section className="crop-dialog" role="dialog" aria-modal="true" aria-labelledby="image-crop-title">
        <header className="crop-header">
          <div className="crop-heading">
            <span className="crop-heading-icon" aria-hidden="true">
              <Crop size={18} />
            </span>
            <div>
              <p className="eyebrow">Image crop</p>
              <h2 id="image-crop-title">{title}</h2>
            </div>
          </div>
          <button className="icon-button" type="button" aria-label="Close crop editor" onClick={onCancel}>
            <X size={20} />
          </button>
        </header>

        <div className="crop-stage" ref={stageRef}>
          <img
            className="crop-image"
            src={sourceUrl}
            alt="Selected ID document"
            onLoad={(event) => {
              setNaturalSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              });
            }}
          />
          {selectionStyle && (
            <div className="crop-selection" style={selectionStyle} onPointerDown={(event) => beginCropAction("move", event)}>
              <span className="crop-handle nw" onPointerDown={(event) => beginCropAction("nw", event)} />
              <span className="crop-handle ne" onPointerDown={(event) => beginCropAction("ne", event)} />
              <span className="crop-handle sw" onPointerDown={(event) => beginCropAction("sw", event)} />
              <span className="crop-handle se" onPointerDown={(event) => beginCropAction("se", event)} />
            </div>
          )}
        </div>

        {error && <p className="error-line crop-error">{error}</p>}

        <footer className="crop-footer">
          <button className="button secondary" type="button" onClick={onUseOriginal}>
            Use Original
          </button>
          <div className="crop-footer-actions">
            <button className="button secondary" type="button" onClick={onCancel}>
              Cancel
            </button>
            <button className="button primary" type="button" onClick={applyCrop} disabled={isApplying}>
              {isApplying ? "Cropping..." : "Apply Crop"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
