(function () {
  const MAX_IMAGE_COUNT = 3;
  const MAX_SOURCE_SIZE = 8 * 1024 * 1024;
  const MAX_DIMENSION = 1280;
  const QUALITY = 0.78;
  const OUTPUT_TYPE = "image/webp";
  const FALLBACK_TYPE = "image/jpeg";
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) {
      return "";
    }

    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function getExtension(file) {
    const parts = String(file.name || "").toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  function isAllowedImage(file) {
    return ALLOWED_TYPES.has(file.type) || ALLOWED_EXTENSIONS.has(getExtension(file));
  }

  function validateImages(files, options = {}) {
    const maxCount = options.maxCount || MAX_IMAGE_COUNT;
    const maxSourceSize = options.maxSourceSize || MAX_SOURCE_SIZE;
    const errors = [];

    if (files.length > maxCount) {
      errors.push(`แนบรูปภาพได้สูงสุด ${maxCount} ภาพ`);
      return errors;
    }

    files.forEach((file) => {
      if (!isAllowedImage(file)) {
        errors.push(`ไฟล์ ${file.name || "ที่เลือก"} ไม่ใช่รูปภาพชนิด JPG, PNG หรือ WebP`);
      }

      if (file.size > maxSourceSize) {
        errors.push(`ไฟล์ ${file.name || "ที่เลือก"} ใหญ่เกิน 8MB`);
      }
    });

    return errors;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    });
  }

  function loadImage(file) {
    if ("createImageBitmap" in window) {
      return createImageBitmap(file);
    }

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image load failed"));
      };
      image.src = url;
    });
  }

  function getTargetSize(width, height, maxDimension) {
    const longestSide = Math.max(width, height);

    if (longestSide <= maxDimension) {
      return { width, height };
    }

    const ratio = maxDimension / longestSide;

    return {
      width: Math.max(1, Math.round(width * ratio)),
      height: Math.max(1, Math.round(height * ratio)),
    };
  }

  function getOutputName(file, type) {
    const baseName = String(file.name || "image").replace(/\.[^.]+$/, "");
    const extension = type === OUTPUT_TYPE ? "webp" : "jpg";
    return `${baseName}.${extension}`;
  }

  async function compressImage(file, options = {}) {
    const maxDimension = options.maxDimension || MAX_DIMENSION;
    const quality = options.quality || QUALITY;
    const image = await loadImage(file);
    const sourceWidth = image.width;
    const sourceHeight = image.height;
    const target = getTargetSize(sourceWidth, sourceHeight, maxDimension);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = target.width;
    canvas.height = target.height;
    context.drawImage(image, 0, 0, target.width, target.height);

    if ("close" in image) {
      image.close();
    }

    let blob = await canvasToBlob(canvas, OUTPUT_TYPE, quality);
    let outputType = blob?.type || "";

    if (!blob || outputType !== OUTPUT_TYPE) {
      blob = await canvasToBlob(canvas, FALLBACK_TYPE, quality);
      outputType = blob?.type || FALLBACK_TYPE;
    }

    if (!blob) {
      throw new Error("Image compression failed");
    }

    const outputFile = new File([blob], getOutputName(file, outputType), {
      type: outputType,
      lastModified: Date.now(),
    });

    return {
      file: outputFile,
      originalFile: file,
      originalSize: file.size,
      compressedSize: outputFile.size,
      width: target.width,
      height: target.height,
      type: outputType,
    };
  }

  async function compressImages(fileList, options = {}) {
    const files = Array.from(fileList || []);
    const errors = validateImages(files, options);

    if (errors.length > 0) {
      return {
        items: [],
        files: [],
        errors,
      };
    }

    try {
      const items = [];

      for (const file of files) {
        items.push(await compressImage(file, options));
      }

      return {
        items,
        files: items.map((item) => item.file),
        errors: [],
      };
    } catch {
      return {
        items: [],
        files: [],
        errors: ["ไม่สามารถเตรียมรูปภาพได้ กรุณาลองเลือกรูปใหม่อีกครั้ง"],
      };
    }
  }

  window.HSCImageCompress = {
    MAX_IMAGE_COUNT,
    MAX_SOURCE_SIZE,
    MAX_DIMENSION,
    QUALITY,
    compressImage,
    compressImages,
    formatFileSize,
    validateImages,
  };
})();
