import { UploadCloud } from "lucide-react";

export default function UploadCard({ id, title, value, onChange }) {
  const previewUrl = value?.previewUrl;

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
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
    </section>
  );
}
