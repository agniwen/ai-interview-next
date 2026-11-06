import { init } from "@embedpdf/pdfium";
import type { WrappedPdfiumModule } from "@embedpdf/pdfium";
import { PNG } from "pngjs/browser.js";
import { jevImageMaxSide } from "./jev";

export function createPdfFirstPageRenderer(wasm: WebAssembly.Module) {
  let engine: Promise<WrappedPdfiumModule> | undefined;

  return async (bytes: Uint8Array): Promise<Uint8Array> => {
    engine ??= init({
      instantiateWasm(imports, ready) {
        const instance = new WebAssembly.Instance(wasm, imports);
        ready(instance);
        return instance.exports;
      },
    }).then((pdfium) => {
      pdfium.PDFiumExt_Init();
      return pdfium;
    });
    const pdfium = await engine;
    const { wasmExports } = pdfium.pdfium;
    const source = wasmExports.malloc(bytes.length);
    if (!source) {
      throw new Error("PDF_BUFFER_UNAVAILABLE");
    }
    let document = 0;
    let page = 0;
    let bitmap = 0;
    try {
      pdfium.pdfium.HEAPU8.set(bytes, source);
      document = pdfium.FPDF_LoadMemDocument(source, bytes.length, "");
      page = document ? pdfium.FPDF_LoadPage(document, 0) : 0;
      if (!page) {
        throw new Error("PDF_FIRST_PAGE_UNAVAILABLE");
      }
      const pageWidth = pdfium.FPDF_GetPageWidthF(page);
      const pageHeight = pdfium.FPDF_GetPageHeightF(page);
      const scale = jevImageMaxSide / Math.max(pageWidth, pageHeight);
      const width = Math.max(1, Math.round(pageWidth * scale));
      const height = Math.max(1, Math.round(pageHeight * scale));
      bitmap = pdfium.FPDFBitmap_Create(width, height, 1);
      if (!bitmap) {
        throw new Error("PDF_BITMAP_UNAVAILABLE");
      }
      pdfium.FPDFBitmap_FillRect(bitmap, 0, 0, width, height, 0xff_ff_ff_ff);
      // 0x10 让 PDFium 直接写出 RGBA。 / 0x10 tells PDFium to render directly in RGBA order.
      pdfium.FPDF_RenderPageBitmap(bitmap, page, 0, 0, width, height, 0, 0x10);
      const start = pdfium.FPDFBitmap_GetBuffer(bitmap);
      const png = new PNG({ height, width });
      png.data.set(pdfium.pdfium.HEAPU8.subarray(start, start + png.data.length));
      return PNG.sync.write(png);
    } finally {
      if (bitmap) {
        pdfium.FPDFBitmap_Destroy(bitmap);
      }
      if (page) {
        pdfium.FPDF_ClosePage(page);
      }
      if (document) {
        pdfium.FPDF_CloseDocument(document);
      }
      wasmExports.free(source);
    }
  };
}
