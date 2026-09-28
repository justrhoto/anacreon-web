// CP437 <-> Unicode glyph mapping (the scenario and help files are CP437 encoded).

export const CP437 = "\u0000☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

const REV = new Map();
for (let i = 255; i >= 0; i--) REV.set(CP437.charCodeAt(i), i);

// Convert a Unicode glyph to its CP437 byte.
export function toCP(code) {
  if (code >= 32 && code < 127) return code;
  const b = REV.get(code);
  if (b !== undefined) return b;
  return code < 256 ? code : 63;
}

// Decode raw CP437 bytes into a glyph string (tab/CR/LF/^Z kept as control codes).
export function decodeCP437(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    s += (b === 9 || b === 10 || b === 13 || b === 26) ? String.fromCharCode(b) : CP437[b];
  }
  return s;
}

