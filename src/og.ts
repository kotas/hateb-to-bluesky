import { unfurl } from './unfurl';
import { encodeImageToJpeg, decodeImage, resizeImage } from './image';

// Facebook 用のページを出してもらう
const USER_AGENT = 'facebookexternalhit/1.1';
const TIMEOUT = 30 * 1000;

const NO_TITLE = '(no title)';
const MAX_IMAGE_WIDTH = 800;
const JPEG_QUALITY = 80;

export type OgSummary = {
  title: string;
  description: string;
  image: Blob | null;
};

const fetchPage = (url: string) => fetch(url, {
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

  const title =
    metadata.open_graph?.title ??
    metadata.twitter_card?.title ??
    metadata.oEmbed?.title ??
    metadata.title;

  const description =
    metadata.open_graph?.description ??
    metadata.twitter_card?.description ??
    metadata.description;

  const imageUrl =
    metadata.open_graph?.images?.[0]?.url ??
    metadata.twitter_card?.images?.[0]?.url ??
    metadata.oEmbed?.thumbnails?.[0]?.url;

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

  let image = await decodeImage(await res.arrayBuffer());
  if (!image) {
    console.warn(`Warning: Not supported image format: ${imageUrl}`);
    return null;
  }
  if (image.width > MAX_IMAGE_WIDTH) {
    // アスペクト比を維持したままリサイズ
    try {
      image = await resizeImage(image, {
        width: MAX_IMAGE_WIDTH,
        height: Math.round(MAX_IMAGE_WIDTH * image.height / image.width),
      });
    } catch (e) {
      // 画像によってはリサイズに失敗する事がある (RuntimeError: unreachable)
      // その場合はリサイズせずにそのまま使う
      console.warn(`Warning: Failed to resize image: ${imageUrl}`);
    }
  }

  const jpeg = await encodeImageToJpeg(image, {
    quality: JPEG_QUALITY,
  });

  return new Blob([jpeg], { type: 'image/jpeg' });
}
