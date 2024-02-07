import { fileTypeFromBuffer } from 'file-type';
import encodeJpeg, { init as initJpegEncWasm } from '@jsquash/jpeg/encode';
import decodeJpeg, { init as initJpegDecWasm } from '@jsquash/jpeg/decode';
import decodePng, { init as initPngDecWasm } from '@jsquash/png/decode';
import decodeWebp, { init as initWebpDecWasm } from '@jsquash/webp/decode';
import resize, { initResize as initResizeWasm } from '@jsquash/resize';

// Cloudflare 上で使うには WASM を別途ロードして init する必要がある
// @ts-ignore 型定義がなくてエラーになるので無視
import JPEG_ENC_WASM from '../node_modules/@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm';
// @ts-ignore 型定義がなくてエラーになるので無視
import JPEG_DEC_WASM from '../node_modules/@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm';
import PNG_DEC_WASM from '../node_modules/@jsquash/png/codec/pkg/squoosh_png_bg.wasm';
// @ts-ignore 型定義がなくてエラーになるので無視
import WEBP_DEC_WASM from '../node_modules/@jsquash/webp/codec/dec/webp_dec.wasm';
import RESIZE_WASM from '../node_modules/@jsquash/resize/lib/resize/squoosh_resize_bg.wasm';

const decoders = {
  jpg: decodeJpeg,
  png: decodePng,
  webp: decodeWebp,
};
const decoderInitializers = {
  jpg: () => initJpegDecWasm(JPEG_DEC_WASM),
  png: () => initPngDecWasm(PNG_DEC_WASM),
  webp: () => initWebpDecWasm(WEBP_DEC_WASM),
};

export type DecodableFileExtension = keyof typeof decoders;
export type ImageData = Parameters<typeof resize>[0];
export type ResizeOptions = Parameters<typeof resize>[1];
export type EncodeOptions = Parameters<typeof encodeJpeg>[1];

const decoderInitialized = {} as Record<DecodableFileExtension, true | undefined>;
export async function decodeImage(buffer: ArrayBuffer, ext?: DecodableFileExtension): Promise<ImageData | null> {
  let actualExt: DecodableFileExtension;
  if (ext) {
    actualExt = ext;
  } else {
    // 拡張子の指定がない場合はファイル内容から推測 (file-type)
    const fileType = await fileTypeFromBuffer(buffer);
    if (!fileType) {
      console.warn(`Warning: Failed to guess image format`);
      return null;
    }
    actualExt = fileType.ext as DecodableFileExtension;
  }

  if (!decoders[actualExt]) {
    return null;
  }

  if (!decoderInitialized[actualExt]) {
    await decoderInitializers[actualExt]();
    decoderInitialized[actualExt] = true;
  }

  return await decoders[actualExt](buffer);
}

let resizeInitialized = false;
export async function resizeImage(image: ImageData, options: ResizeOptions): Promise<ImageData> {
  if (!resizeInitialized) {
    await initResizeWasm(RESIZE_WASM);
    resizeInitialized = true;
  }
  return await resize(image, options);
}

let encoderInitialized = false;
export async function encodeImageToJpeg(image: ImageData, options: EncodeOptions): Promise<ArrayBuffer> {
  if (!encoderInitialized) {
    await initJpegEncWasm(JPEG_ENC_WASM);
    encoderInitialized = true;
  }
  return await encodeJpeg(image, options);
}
