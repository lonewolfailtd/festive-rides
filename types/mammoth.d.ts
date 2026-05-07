// Minimal type declaration for mammoth's browser bundle. The official
// @types package only covers the Node entry point; we use the browser
// bundle for client-side .docx parsing on the AI Checker page.

declare module "mammoth/mammoth.browser" {
  export interface ExtractRawTextResult {
    value: string;
    messages: { type: string; message: string }[];
  }

  export function extractRawText(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<ExtractRawTextResult>;
}
