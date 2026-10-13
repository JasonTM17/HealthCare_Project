"""Documentation vector exports; topology owners are the linked Mermaid sources."""
from pathlib import Path
from html import escape
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs' / 'assets'


def canvas(title, subtitle, height):
    lines = []
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 {height}" role="img" aria-labelledby="title desc">')
    lines.append(f'<title id="title">{escape(title)}</title><desc id="desc">{escape(subtitle)}</desc>')
    lines.append('<defs>')
    for name, color in [('blue', '#2563eb'), ('green', '#16a34a'), ('purple', '#9333ea')]:
        lines.append(f'<marker id="{name}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="{color}"/></marker>')
    lines.append('</defs>')
    lines.append('<style>text{font-family:Arial,Helvetica,sans-serif;fill:#111827}.title{font-size:30px;font-weight:700}.name{font-size:19px;font-weight:700}.sub{font-size:15px;fill:#475569}.label{font-size:14px;font-weight:600}</style>')
    lines.append(f'<rect width="1200" height="{height}" fill="#ffffff"/>')
    lines.append('<rect width="1200" height="8" fill="#2563eb"/>')
    lines.append(f'<text x="60" y="66" class="title">{escape(title)}</text>')
    lines.append(f'<text x="60" y="96" class="sub">{escape(subtitle)}</text>')
    return lines


def box(lines, x, y, w, h, title, *subtitles, color='#eff6ff', border='#93c5fd'):
    lines.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{color}" stroke="{border}" stroke-width="1.5"/>')
    lines.append(f'<text x="{x+w/2}" y="{y+31}" text-anchor="middle" class="name">{escape(title)}</text>')
    for i, text in enumerate(subtitles):
        lines.append(f'<text x="{x+w/2}" y="{y+58+i*24}" text-anchor="middle" class="sub">{escape(text)}</text>')


def edge(lines, path, label, x, y, kind='blue', dashed=False):
    color = {'blue': '#2563eb', 'green': '#16a34a', 'purple': '#9333ea'}[kind]
    dash = ' stroke-dasharray="6 4"' if dashed else ''
    lines.append(f'<path d="{path}" fill="none" stroke="{color}" stroke-width="2"{dash} marker-end="url(#{kind})"/>')
    if label:
        width = max(70, len(label)*8+16)
        lines.append(f'<rect x="{x-width/2}" y="{y-15}" width="{width}" height="23" fill="#ffffff" opacity="0.97"/>')
        lines.append(f'<text x="{x}" y="{y}" text-anchor="middle" class="label">{escape(label)}</text>')


def save(name, lines):
    lines.append('</svg>')
    svg = '\n'.join(lines)
    ElementTree.fromstring(svg)
    (OUT / name).write_text(svg, encoding='utf-8')
    print(name + ' XML PASS')


lines = canvas('HealthCare / System architecture', 'Logical boundaries — source-backed topology; integrations depend on environment.', 1120)
box(lines, 60, 132, 1080, 78, 'Browser / user roles', 'Public discovery  ·  Patient  ·  Doctor  ·  Administrator')
box(lines, 60, 284, 1080, 94, 'Next.js UI + same-origin BFF', 'Route handlers  ·  Origin/CSRF boundary  ·  Server trust token  ·  Request deadlines')
box(lines, 60, 452, 1080, 126, 'Spring Boot / modular monolith', 'Authentication & ownership  ·  Booking  ·  Clinical records  ·  Consultation & care plans', 'CMS publication  ·  Payments & review  ·  Notifications/outboxes  ·  AI policy & history')
box(lines, 60, 710, 300, 100, 'PostgreSQL', 'Flyway / transactions', 'Business + session authority', color='#f0fdf4', border='#86efac')
box(lines, 450, 710, 300, 100, 'Redis', 'Rate limits / coordination', 'CMS wake-up signals', color='#f0fdf4', border='#86efac')
box(lines, 840, 710, 300, 100, 'FastAPI AI', 'Retrieve / generate', 'Validate / runtime policy')
box(lines, 60, 918, 690, 100, 'Feature-gated integrations', 'MinIO / S3  ·  Scanner adapter + ClamAV  ·  Mailpit / SMTP', 'Private objects and scan linkage  ·  Mail outbox delivery', color='#faf5ff', border='#d8b4fe')
box(lines, 840, 918, 300, 100, 'RAG / provider selection', 'Memory or protected projection', 'Remote model when permitted', color='#faf5ff', border='#d8b4fe')
edge(lines, 'M 600 210 V 284', 'Same origin', 600, 251)
edge(lines, 'M 600 378 V 452', 'Trusted HTTP', 600, 420)
edge(lines, 'M 210 578 V 710', 'SQL', 210, 647, 'green')
edge(lines, 'M 600 578 V 710', 'Coordination', 600, 647, 'green')
edge(lines, 'M 990 578 V 710', 'Service auth', 990, 647)
edge(lines, 'M 60 520 H 28 V 866 H 405 V 918', 'Feature-gated', 405, 871, 'purple', True)
edge(lines, 'M 990 810 V 918', 'Conditional', 990, 871, 'purple', True)
lines.append('<text x="60" y="1060" class="sub">Legend: blue = request/service call; green = data/coordination; dashed purple = configured integration.</text>')
lines.append('<text x="60" y="1088" class="sub">Browser never bypasses Core to reach AI. Redis is not the history authority. Presigned URLs do not prove encryption.</text>')
save('architecture.svg', lines)

lines = canvas('HealthCare / Local Compose', 'Local demo deployment — loopback host ports; internal-only AI; no hosted topology claim.', 1030)
lines.append('<rect x="60" y="218" width="680" height="706" rx="12" fill="#f8fafc" stroke="#94a3b8" stroke-dasharray="6 4"/>')
lines.append('<rect x="800" y="218" width="360" height="706" rx="12" fill="#faf5ff" stroke="#c084fc" stroke-dasharray="6 4"/>')
lines.append('<text x="88" y="246" class="label">EDGE network / local tools</text>')
lines.append('<text x="822" y="246" class="label">INTERNAL-only dependencies</text>')
box(lines, 80, 132, 620, 64, 'Browser / localhost:3000')
box(lines, 80, 286, 620, 80, 'Frontend container', 'Next.js UI + BFF')
box(lines, 80, 452, 620, 88, 'Backend container', 'Spring / bridges edge + internal networks')
box(lines, 820, 452, 300, 88, 'AI service', 'Loopback port declared: 8000')
box(lines, 80, 644, 620, 104, 'Data dependencies', 'PostgreSQL  ·  Redis  ·  MinIO', 'Named volumes preserve data across stop/start', color='#f0fdf4', border='#86efac')
box(lines, 820, 644, 300, 80, 'Scanner adapter', 'Private authenticated HTTP', color='#faf5ff', border='#d8b4fe')
box(lines, 80, 842, 620, 64, 'Mailpit / local SMTP sink', color='#faf5ff', border='#d8b4fe')
box(lines, 820, 842, 300, 64, 'ClamAV', color='#faf5ff', border='#d8b4fe')
edge(lines, 'M 390 196 V 286', 'Web', 390, 269)
edge(lines, 'M 390 366 V 452', 'BFF', 390, 414)
edge(lines, 'M 700 474 H 820', 'AI', 760, 464)
edge(lines, 'M 390 540 V 644', 'Data', 390, 596, 'green')
edge(lines, 'M 700 514 H 766 V 684 H 820', '', 0, 0, 'purple', True)
edge(lines, 'M 80 514 H 28 V 792 H 390 V 842', 'Outbox', 390, 797, 'purple', True)
edge(lines, 'M 970 724 V 842', 'Scan', 970, 787, 'purple', True)
lines.append('<text x="60" y="966" class="sub">Legend: blue = request; green = data; dashed purple = scan/mail integration.</text>')
lines.append('<text x="60" y="994" class="sub">AI: loopback port declared; no edge network/provider egress. Upload flags are separate. Mailpit is local-only.</text>')
save('deployment-local.svg', lines)
