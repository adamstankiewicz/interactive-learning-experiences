import { PDFParse } from 'pdf-parse';

/**
 * PDF → plain text, the one thing lesson-plan upload needs from a parser.
 *
 * pdf-parse v2 is class-based and holds worker resources — `destroy()` in a
 * finally so a malformed upload can't leak them. The v1 deep import
 * (`pdf-parse/lib/pdf-parse.js`) this replaces no longer exists in v2, and
 * the debug-mode fixture bug that forced it is gone with the rewrite.
 */
export async function pdfToText(data: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
