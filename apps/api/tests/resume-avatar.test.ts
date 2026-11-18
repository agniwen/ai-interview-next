import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { expect, it } from "vitest";
import { createResumeAvatarExtractor, cropResumePortrait } from "../src/lib/resume-avatar";
import { createPdfFirstPageRenderer } from "../src/lib/resume-avatar/pdf-first-page";
import { createDeepSeekPortraitLocator } from "../src/lib/resume-avatar/deepseek";

function twoPagePdf() {
  const firstPage = "1 0 0 rg 0 0 30 50 re f";
  const secondPage = "0 0 1 rg 0 0 30 50 re f";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 30 50] /Contents 4 0 R >>",
    `<< /Length ${firstPage.length} >>\nstream\n${firstPage}\nendstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 30 50] /Contents 6 0 R >>",
    `<< /Length ${secondPage.length} >>\nstream\n${secondPage}\nendstream`,
  ];
  let pdf = "%PDF-1.7\n";
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  return new TextEncoder().encode(
    `${pdf}xref\n0 7\n0000000000 65535 f \n${offsets.join("")}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${pdf.length}\n%%EOF\n`,
  );
}

it("renders only the first PDF page and crops its original colors to the avatar dimensions", async () => {
  const wasm = readFileSync(new URL(import.meta.resolve("@embedpdf/pdfium/pdfium.wasm")));
  const render = createPdfFirstPageRenderer(await WebAssembly.compile(wasm));
  const page = await render(twoPagePdf());
  const rendered = PNG.sync.read(Buffer.from(page));
  expect(Math.max(rendered.width, rendered.height)).toBe(1568);
  const cropped = cropResumePortrait(page, "image/png", {
    bottom: 0.9,
    left: 0.25,
    right: 0.75,
    top: 0.1,
  });
  const image = PNG.sync.read(Buffer.from(cropped));
  expect(image).toMatchObject({ height: 512, width: 192 });
  expect([...image.data.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
});

const modelOptions = {
  apiKey: "test-key",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-flash",
};

function completion(box: number[] | null) {
  return Response.json({
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ box, version: 1 }) } }],
  });
}

it.each([
  { height: 1000, modelHeight: 784, modelWidth: 1568, width: 2000 },
  { height: 100, modelHeight: 280, modelWidth: 560, width: 200 },
])(
  "locates a portrait on a resized $width × $height image and crops the original",
  async ({ height, modelHeight, modelWidth, width }) => {
    const source = new PNG({ height, width });
    source.data.fill(255);
    const locate = createDeepSeekPortraitLocator({
      ...modelOptions,
      async fetch(url, init) {
        expect(url).toBe("https://api.deepseek.com/chat/completions");
        const request = await new Request(url, init).json();
        const [instruction, attachment] = request.messages[1].content;
        expect(instruction.text).toContain(
          `${modelWidth} pixels wide and ${modelHeight} pixels tall`,
        );
        const image = PNG.sync.read(Buffer.from(attachment.image_url.url.split(",")[1], "base64"));
        expect(image).toMatchObject({ height: modelHeight, width: modelWidth });
        return completion([
          modelWidth / 4,
          modelHeight / 4,
          (modelWidth * 3) / 4,
          (modelHeight * 3) / 4,
        ]);
      },
    });
    const extract = createResumeAvatarExtractor(
      () => Promise.reject(new Error("Image resumes skip PDF rendering")),
      locate,
    );
    const cropped = await extract(PNG.sync.write(source), "image/png");
    const avatar = PNG.sync.read(Buffer.from(cropped ?? new ArrayBuffer(0)));
    expect(avatar.width).toBe(Math.min(512, width / 2));
    expect(avatar.height).toBe(Math.min(256, height / 2));
  },
);

it("returns no crop when the model finds no candidate photo", async () => {
  const locate = createDeepSeekPortraitLocator({
    ...modelOptions,
    fetch: () => Promise.resolve(completion(null)),
  });
  const source = new PNG({ height: 280, width: 280 });
  const extract = createResumeAvatarExtractor(
    () => Promise.reject(new Error("Image resumes skip PDF rendering")),
    locate,
  );
  await expect(extract(PNG.sync.write(source), "image/png")).resolves.toBeNull();
});

it.each([{ box: [10, 10, 401, 70] }, { box: [40, 10, 10, 70] }])(
  "rejects an invalid portrait box $box",
  async ({ box }) => {
    const locate = createDeepSeekPortraitLocator({
      ...modelOptions,
      fetch: () => Promise.resolve(completion(box)),
    });
    await expect(
      locate({ bytes: new Uint8Array(), height: 300, mediaType: "image/png", width: 400 }),
    ).rejects.toThrow();
  },
);
