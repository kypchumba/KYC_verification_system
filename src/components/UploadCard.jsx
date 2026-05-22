import { useEffect, useRef, useState } from "react";
import { Crop, UploadCloud } from "lucide-react";
import ImageCropModal from "./ImageCropModal.jsx";

export default function UploadCard({ id, title, value, onChange }) {
  const [cropSource, setCropSource] = useState(null);
  const cropSourceUrlRef = useRef(null);
  const previewUrl = value?.previewUrl;

  const clearCropSource = () => {
    if (cropSourceUrlRef.current) {
      URL.revokeObjectURL(cropSourceUrlRef.current);
      cropSourceUrlRef.current = null;
    }
    setCropSource(null);
  };

  const openCropper = (file) => {
    if (!file) return;
    clearCropSource();
    const sourceUrl = URL.createObjectURL(file);
    cropSourceUrlRef.current = sourceUrl;
    setCropSource({ file, sourceUrl });
  };

  useEffect(() => () => {
    if (cropSourceUrlRef.current) {
      URL.revokeObjectURL(cropSourceUrlRef.current);
      cropSourceUrlRef.current = null;
    }
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (file) openCropper(file);
  };

  return (
    <section className="upload-card">
      <div>
        <h2>{title}</h2>
        <p>PNG, JPG, or JPEG image</p>
      </div>

      <label className={previewUrl ? "upload-dropzone has-preview" : "upload-dropzone"} htmlFor={id}>
        {previewUrl ? (
          <img src={previewUrl} alt={`${title} preview`} />
        ) : (
          <span className="upload-empty">
            <UploadCloud size={28} />
            Choose image
          </span>
        )}
      </label>
      <input
        id={id}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleFileChange}
      />
      {previewUrl && value?.file && (
        <button className="text-button upload-crop-button" type="button" onClick={() => openCropper(value.file)}>
          <Crop size={16} /> Crop image
        </button>
      )}
      {cropSource && (
        <ImageCropModal
          title={title}
          file={cropSource.file}
          sourceUrl={cropSource.sourceUrl}
          onCancel={clearCropSource}
          onUseOriginal={() => {
            onChange(cropSource.file);
            clearCropSource();
          }}
          onApply={(croppedFile) => {
            onChange(croppedFile);
            clearCropSource();
          }}
        />
      )}
    </section>
  );
}
