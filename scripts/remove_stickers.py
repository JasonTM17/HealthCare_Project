import os
import re

EMOJIS_TO_REMOVE = [
    "🏥", "🎬", "👥", "🛡️", "🛡", "🩺", "🗺️", "🗺", "📐", "📁", "📊",
    "🖥️", "🖥", "⚡", "📱", "🌐", "🔒", "🔄", "⚙️", "⚙", "☕", "🔐",
    "📋", "📅", "📑", "💳", "📡", "🤖", "📚", "💾", "🐘", "📦", "☁️",
    "☁", "🛠️", "🛠", "🚀", "🦠", "✉️", "✉", "📸", "💡", "🏛️", "🏛",
    "🔍", "⚖️", "⚖", "🔗", "❌", "🧩"
]

def clean_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Anchor fixes for README.md so navigation links work cleanly
    if filepath.endswith("README.md"):
        content = content.replace(
            '<a href="#-demo-trực-tiếp--tài-khoản-trải-nghiệm">',
            '<a href="#demo-trực-tiếp--tài-khoản-trải-nghiệm-live-demo--roles">'
        )
        content = content.replace(
            '<a href="#-product-walkthrough-demo">',
            '<a href="#product-walkthrough-demo">'
        )
        content = content.replace(
            '<a href="#-kiến-trúc-hệ-thống-system-architecture">',
            '<a href="#kiến-trúc-hệ-thống-system-architecture">'
        )
        content = content.replace(
            '<a href="#-bộ-sưu-tập-giao-diện-thực-tế-screenshots">',
            '<a href="#bộ-sưu-tập-giao-diện-thực-tế-screenshots-gallery">'
        )
        content = content.replace(
            '<a href="#-tính-năng-cốt-lõi-features-matrix">',
            '<a href="#tính-năng-cốt-lõi-features-matrix">'
        )
        content = content.replace(
            '<a href="#-hướng-dẫn-cài-đặt--khởi-động-nhanh">',
            '<a href="#hướng-dẫn-cài-đặt--khởi-động-nhanh-quick-start">'
        )
        content = content.replace("➔", "->")

    # Replace each emoji with space after it if present, otherwise just the emoji
    for emoji in EMOJIS_TO_REMOVE:
        content = content.replace(emoji + " ", "")
        content = content.replace(emoji, "")

    # Cleanup any residual double spaces in specific markdown structures
    lines = []
    for line in content.splitlines():
        # Clean heading spaces: e.g. "##  Kiến trúc" -> "## Kiến trúc"
        line = re.sub(r'^(#+\s+)\s+', r'\1', line)
        # Clean table cell spaces: "|  **" -> "| **"
        line = re.sub(r'(\|\s+)\s+', r'\1', line)
        # Clean list spaces: "-  **" -> "- **"
        line = re.sub(r'^(\s*[-*]\s+)\s+', r'\1', line)
        # Clean blockquote spaces: ">  **" -> "> **"
        line = re.sub(r'^(>\s+)\s+', r'\1', line)
        # Clean mermaid node leading space: [" Next.js -> ["Next.js
        line = line.replace('[" ', '["').replace('[(" ', '[("')
        # Clean summary tag leading space: <summary><strong> Nhấp -> <summary><strong>Nhấp
        line = line.replace('<strong> ', '<strong>')
        # Clean tech tree
        if line.startswith("├──  "):
            line = "├── " + line[5:]
        elif line.startswith("└──  "):
            line = "└── " + line[5:]
        lines.append(line)

    cleaned = "\n".join(lines) + "\n"

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(cleaned)

    print(f"Successfully cleaned: {filepath}")

if __name__ == "__main__":
    targets = [
        "README.md",
        "docs/architecture/system-overview.md",
        "docs/architecture/system-overview.mmd",
        "docs/reports/20260817-advise-booking-flow.md"
    ]
    for t in targets:
        clean_file(t)
