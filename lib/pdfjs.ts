// Shared loader for pdfjs-dist that polyfills the Stage-3 Uint8Array
// methods pdfjs v5+ depends on (toHex / fromHex / toBase64 / fromBase64).
// Some Chrome/Safari versions don't ship them yet; without the polyfill
// pdfjs throws "a.toHex is not a function" the first time you upload a
// PDF. The polyfill is tiny, idempotent, and runs lazily on first
// import so we don't pay the cost on pages that never touch a PDF.

let applied = false;

function applyPolyfill(): void {
  if (applied) return;
  applied = true;
  if (typeof Uint8Array === "undefined") return;
  const proto = Uint8Array.prototype as unknown as {
    toHex?: () => string;
    fromHex?: (s: string) => Uint8Array;
    toBase64?: () => string;
    fromBase64?: (s: string) => Uint8Array;
  };
  if (typeof proto.toHex !== "function") {
    proto.toHex = function (this: Uint8Array): string {
      let s = "";
      for (let i = 0; i < this.length; i++) {
        s += this[i].toString(16).padStart(2, "0");
      }
      return s;
    };
  }
  if (typeof proto.fromHex !== "function") {
    proto.fromHex = function (s: string): Uint8Array {
      const out = new Uint8Array(s.length / 2);
      for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
      }
      return out;
    };
  }
  if (typeof proto.toBase64 !== "function") {
    proto.toBase64 = function (this: Uint8Array): string {
      let bin = "";
      for (let i = 0; i < this.length; i++) bin += String.fromCharCode(this[i]);
      return btoa(bin);
    };
  }
  if (typeof proto.fromBase64 !== "function") {
    proto.fromBase64 = function (s: string): Uint8Array {
      const bin = atob(s);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    };
  }
}

/**
 * Lazy-load pdfjs-dist with the runtime polyfill applied. Use this
 * everywhere we'd otherwise call `import("pdfjs-dist")` directly.
 */
export async function loadPdfjs() {
  applyPolyfill();
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  return pdfjs;
}
