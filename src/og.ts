import { unfurl } from './unfurl';
import { optimizeImage } from 'wasm-image-optimization';

// Facebook 用のページを出してもらう
const USER_AGENT = 'facebookexternalhit/1.1';
const TIMEOUT = 30 * 1000;

const NO_TITLE = '(no title)';
const MAX_IMAGE_WIDTH = 800;
const JPEG_QUALITY = 90;

export type OgSummary = {
  title: string;
  description: string;
  image: Blob | null;
};

const fetchPage = (url: string) =>
  fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT),
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

export async function extractOgSummaryFromUrl(url: string): Promise<OgSummary | null> {
  const metadata = await unfurl(url, {
    fetch: fetchPage,
    oembed: true,
  });

  const title = metadata.open_graph?.title ?? metadata.twitter_card?.title ?? metadata.oEmbed?.title ?? metadata.title;

  const description = metadata.open_graph?.description ?? metadata.twitter_card?.description ?? metadata.description;

  const imageUrl =
    metadata.open_graph?.images?.[0]?.url ?? metadata.twitter_card?.images?.[0]?.url ?? metadata.oEmbed?.thumbnails?.[0]?.url;

  return {
    title: title || NO_TITLE,
    description: description || '',
    image: imageUrl ? await fetchNormalizedImage(imageUrl) : null,
  };
}

async function fetchNormalizedImage(imageUrl: string): Promise<Blob | null> {
  // 画像をダウンロード
  const res = await fetchPage(imageUrl);
  if (!res.ok) {
    console.warn(`Warning: Failed to fetch image: ${imageUrl} - ${res.status} ${res.statusText}`);
    return null;
  }

  const originalImage = await res.arrayBuffer();

  let image = await optimizeImage({
    image: originalImage,
    width: MAX_IMAGE_WIDTH,
    quality: JPEG_QUALITY,
    format: 'jpeg',
  });
  if (!image) {
    // 最適化に失敗した場合はオリジナル画像をそのまま使う
    console.warn(`Warning: Failed to normalize image: ${imageUrl}`);
    image = new Uint8Array(originalImage);
  }

  return new Blob([image], { type: 'image/jpeg' });
}
