import { describe, expect, it } from 'vitest';

import { pdfToText } from '@/lib/pdf-text';

/** A complete, minimal one-page PDF — no fixtures on disk, no network. */
const TINY_PDF = new Uint8Array(
  Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n' +
      '4 0 obj<</Length 62>>stream\nBT /F1 12 Tf 72 700 Td (Comparing fractions lesson plan) Tj ET\nendstream\nendobj\n' +
      '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n' +
      'xref\n0 6\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF',
  ),
);

describe('pdfToText', () => {
  it('extracts the text a lesson-plan upload needs', async () => {
    const text = await pdfToText(TINY_PDF);
    expect(text).toContain('Comparing fractions lesson plan');
  });

  it('rejects garbage instead of hanging or leaking', async () => {
    await expect(pdfToText(new Uint8Array([1, 2, 3]))).rejects.toThrow();
  });
});
