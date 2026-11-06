import { Buffer } from "node:buffer";
import { decode } from "jpeg-js";
import { PNG } from "pngjs/browser.js";
import type { ResumeImageType, ResumeMediaType } from "../resume-file";
import { jevImageMaxSide, jevImageMinSide, locateResumePortrait } from "./jev";
import type { PortraitBox } from "./jev";

const maxAvatarSide = 512;
const maxJpegMegapixels = 12;
const maxPngPixels = 6_000_000;

function decodePortraitImage(bytes: Uint8Array, mediaType: ResumeImageType) {
  if (mediaType === "image/png") {
    const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (header.getUint32(16) * header.getUint32(20) > maxPngPixels) {
      throw new Error("RESUME_IMAGE_TOO_LARGE_FOR_AVATAR");
    }
  }
  return mediaType === "image/jpeg"
    ? decode(bytes, {
        maxMemoryUsageInMB: 64,
        maxResolutionInMP: maxJpegMegapixels,
        useTArray: true,
      })
    : PNG.sync.read(Buffer.from(bytes));
}

type PortraitImage = ReturnType<typeof decodePortraitImage>;

function resamplePortraitImage(
  image: PortraitImage,
  region: { left: number; top: number; width: number; height: number },
  width: number,
  height: number,
) {
  const output = new PNG({ height, width });
  for (let y = 0; y < height; y += 1) {
    const sourceY = region.top + Math.floor((y * region.height) / height);
    for (let x = 0; x < width; x += 1) {
      const sourceX = region.left + Math.floor((x * region.width) / width);
      const pixel = (sourceY * image.width + sourceX) * 4;
      output.data.set(image.data.subarray(pixel, pixel + 4), (y * width + x) * 4);
    }
  }
  return PNG.sync.write(output);
}

function cropPortraitImage(image: PortraitImage, box: PortraitBox) {
  const left = Math.floor(box.left * image.width);
  const top = Math.floor(box.top * image.height);
  const sourceWidth = Math.ceil(box.right * image.width) - left;
  const sourceHeight = Math.ceil(box.bottom * image.height) - top;
  const scale = Math.min(1, maxAvatarSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const avatar = resamplePortraitImage(
    image,
    { height: sourceHeight, left, top, width: sourceWidth },
    width,
    height,
  );
  return new Uint8Array(avatar).buffer;
}

export function cropResumePortrait(
  bytes: Uint8Array,
  mediaType: ResumeImageType,
  box: PortraitBox,
) {
  return cropPortraitImage(decodePortraitImage(bytes, mediaType), box);
}

export function createResumeAvatarExtractor(
  renderFirstPage: (bytes: Uint8Array) => Promise<Uint8Array>,
  apiKey: string,
) {
  return async function extractResumeAvatar(
    bytes: Uint8Array,
    mediaType: ResumeMediaType,
  ): Promise<ArrayBuffer | null> {
    const imageBytes = mediaType === "application/pdf" ? await renderFirstPage(bytes) : bytes;
    const imageType = mediaType === "application/pdf" ? "image/png" : mediaType;
    const image = decodePortraitImage(imageBytes, imageType);
    const scale = Math.min(
      jevImageMaxSide / Math.max(image.width, image.height),
      Math.max(1, jevImageMinSide / Math.min(image.width, image.height)),
    );
    const width = Math.max(jevImageMinSide, Math.round(image.width * scale));
    const height = Math.max(jevImageMinSide, Math.round(image.height * scale));
    const box =
      width === image.width && height === image.height
        ? await locateResumePortrait(imageBytes, imageType, apiKey)
        : await locateResumePortrait(
            resamplePortraitImage(
              image,
              { height: image.height, left: 0, top: 0, width: image.width },
              width,
              height,
            ),
            "image/png",
            apiKey,
          );
    return box ? cropPortraitImage(image, box) : null;
  };
}
