import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { expect, it, vi } from "vitest";
import { createResumeAvatarExtractor, cropResumePortrait } from "../src/lib/resume-avatar";
import { createPdfFirstPageRenderer } from "../src/lib/resume-avatar/pdf-first-page";

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

it.each([
  { height: 1000, modelHeight: 784, modelWidth: 1568, width: 2000 },
  { height: 100, modelHeight: 280, modelWidth: 560, width: 200 },
])(
  "fits a $width × $height resume into Jev's input bounds",
  async ({ height, modelHeight, modelWidth, width }) => {
    const source = new PNG({ height, width });
    source.data.fill(255);
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      const request = await new Request(url, init).json();
      const image = PNG.sync.read(Buffer.from(request.stateParts[0].data.data, "base64"));
      expect(image).toMatchObject({ height: modelHeight, width: modelWidth });
      return Response.json({
        answers: {
          hasPortrait: { probability: 1, type: "boolean" },
          portrait: { box: { bottom: 0.75, left: 0.25, right: 0.75, top: 0.25 }, type: "box" },
        },
        providerMetadata: { typesafe: { confidence: { portrait: 1 } } },
      });
    });
    try {
      const extract = createResumeAvatarExtractor(
        () => Promise.reject(new Error("Image resumes skip PDF rendering")),
        "test-gateway-key",
      );
      const cropped = await extract(PNG.sync.write(source), "image/png");
      const avatar = PNG.sync.read(Buffer.from(cropped ?? new ArrayBuffer(0)));
      expect(avatar.width).toBe(Math.min(512, width / 2));
      expect(avatar.height).toBe(Math.min(256, height / 2));
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
