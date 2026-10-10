// Presentation only: keep stored messages, numbers and source links unchanged.
const FIELD_LABEL = /^(Giá|Đối tượng|Số ngày|Thời gian|Dịch vụ|Xét nghiệm và chẩn đoán|Lưu ý|Địa chỉ|Chi phí|Thời lượng):(?:[ \t]+|$)/u;
const INLINE_FIELD = /([.!?])[ \t]+(?=(?:Giá|Đối tượng|Số ngày|Thời gian|Dịch vụ|Xét nghiệm và chẩn đoán|Lưu ý|Địa chỉ|Chi phí|Thời lượng):(?:[ \t]|$))/gu;
const PROTECTED_INLINE = /(`+[^`]*`+|\[[^\]]*\]\([^)]*\)|https?:\/\/\S+)/g;

export function readableChatLines(content: string): string[] {
  let inFence = false;
  return content.split(/\r?\n/).flatMap((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return [line];
    }
    if (inFence) return [line];
    // Inline code and source destinations may contain bullets/field names.
    const parts = line.split(PROTECTED_INLINE);
    const formatted = parts.map((part, index) => index % 2 ? part : part
      .replace(/[ \t]+•[ \t]+/g, "\n- ")
      .replace(INLINE_FIELD, "$1\n")).join("");
    return formatted.split("\n");
  });
}

export function chatFieldLabel(text: string): { label: string; value: string } | null {
  const match = FIELD_LABEL.exec(text);
  return match ? { label: `${match[1]}:`, value: text.slice(match[0].length) } : null;
}
