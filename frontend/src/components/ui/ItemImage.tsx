import './item-image.css';
import { useState, type ImgHTMLAttributes } from 'react';

export const ITEM_PLACEHOLDER = '/assets/item-placeholder.png';
type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src?: string | null;
};

/** Match the seeded Storage object, not arbitrary uploads with a similar filename.
 * URL parsing ignores signed-token queries without changing genuine image URLs.
 */
export function isLegacyPlaceholder(source: string): boolean {
  try {
    const path = decodeURIComponent(new URL(source, 'https://local.invalid').pathname);
    return /^\/storage\/v1\/object\/(?:sign|public|authenticated)\/demo-images\/[^/]+\/public\/seed-item-placeholder\.png$/.test(path);
  } catch {
    return false;
  }
}

/** One presentation boundary for item photos, including legacy saved placeholders. */
export function ItemImage(props: Props) {
  const source = props.src?.trim() || ITEM_PLACEHOLDER;
  // Remount only the photo boundary when its source changes, allowing retries
  // even if a previously failed URL is selected again later.
  return <ItemImageSource key={source} {...props} src={source} />;
}

function ItemImageSource({ src, className = '', alt = '', ...props }: Props) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = src?.trim() || ITEM_PLACEHOLDER;
  const fallback = source === ITEM_PLACEHOLDER || isLegacyPlaceholder(source) || source === failedSource;
  return <img {...props} alt={alt}
    className={`item-image ${className}`.trim()}
    src={fallback ? ITEM_PLACEHOLDER : source}
    data-placeholder={fallback ? 'true' : undefined}
    onError={() => { if (!fallback) setFailedSource(source); }} />;
}
