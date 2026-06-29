import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { fileToDataUrl } from '../../lib/utils';

interface ImageInputProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  compact?: boolean;
}

export function ImageInput({ label, value, onChange, compact }: ImageInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  async function handle(file: File | undefined) {
    if (file) onChange(await fileToDataUrl(file));
  }
  return (
    <div className={compact ? 'image-input compact' : 'image-input'}>
      <button type="button" onClick={() => ref.current?.click()}>
        <Upload /> {label}
      </button>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => handle(e.target.files?.[0])} />
      {value && <img src={value} />}
    </div>
  );
}
