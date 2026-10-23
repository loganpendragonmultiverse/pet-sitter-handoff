// Bounded raster headers are checked before a backup can mutate saved data.
export function inspectPhoto(value) {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 2000000)
    throw new Error("Photo data exceeds the supported size.");
  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0)
    throw new Error("Photos must be base64 PNG, JPEG or WebP images.");
  let bytes;
  try {
    bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("Photo encoding is invalid.");
  }
  if (bytes.length > 1400000)
    throw new Error("Photos must be smaller than 1.4 MB.");
  const view = new DataView(bytes.buffer),
    ascii = (at, n) => String.fromCharCode(...bytes.slice(at, at + n));
  let width = 0,
    height = 0;
  if (match[1] === "png") {
    if (
      bytes.length < 45 ||
      ascii(0, 8) !== "\x89PNG\r\n\x1a\n" ||
      ascii(12, 4) !== "IHDR" ||
      view.getUint32(8) !== 13 ||
      ascii(bytes.length - 8, 4) !== "IEND"
    )
      throw new Error("PNG photo headers are invalid.");
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (match[1] === "jpeg") {
    if (
      bytes.length < 12 ||
      bytes[0] !== 255 ||
      bytes[1] !== 216 ||
      bytes.at(-2) !== 255 ||
      bytes.at(-1) !== 217
    )
      throw new Error("JPEG photo headers are invalid.");
    let at = 2;
    while (at + 4 <= bytes.length) {
      if (bytes[at] !== 255) break;
      while (bytes[at] === 255) at++;
      const marker = bytes[at++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (at + 2 > bytes.length) break;
      const length = view.getUint16(at);
      if (length < 2 || at + length > bytes.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      ) {
        if (length < 8) break;
        height = view.getUint16(at + 3);
        width = view.getUint16(at + 5);
        break;
      }
      at += length;
    }
  } else {
    if (
      bytes.length < 30 ||
      ascii(0, 4) !== "RIFF" ||
      ascii(8, 4) !== "WEBP" ||
      view.getUint32(4, true) + 8 !== bytes.length
    )
      throw new Error("WebP photo headers are invalid.");
    const kind = ascii(12, 4);
    if (kind === "VP8X") {
      width = 1 + bytes[24] + bytes[25] * 256 + bytes[26] * 65536;
      height = 1 + bytes[27] + bytes[28] * 256 + bytes[29] * 65536;
    } else if (kind === "VP8L" && bytes[20] === 47 && bytes.length >= 25) {
      const bits = view.getUint32(21, true);
      width = 1 + (bits & 16383);
      height = 1 + ((bits >>> 14) & 16383);
    } else if (
      kind === "VP8 " &&
      bytes.length >= 30 &&
      bytes[23] === 157 &&
      bytes[24] === 1 &&
      bytes[25] === 42
    ) {
      width = view.getUint16(26, true) & 16383;
      height = view.getUint16(28, true) & 16383;
    }
  }
  if (!width || !height || width > 1600 || height > 1600)
    throw new Error(
      "Imported photos must be readable raster images at most 1600 pixels on each side. Re-add a large photo through the photo picker to resize it.",
    );
  return { width, height, type: match[1] };
}
