/**
 * `pdf-parse`'s inner implementation module, imported directly to sidestep a
 * debug-mode bug in the package's root entry point (see route.ts). Untyped
 * upstream — @types/pdf-parse only covers the root export.
 */
declare module 'pdf-parse/lib/pdf-parse.js' {
  export default function pdfParse(buffer: Buffer): Promise<{ text: string }>;
}
