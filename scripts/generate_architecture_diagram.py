import os
import subprocess

def generate_architecture_svg(output_path):
    lines = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 980" width="1440" height="980">')
    lines.append('  <style>')
    lines.append('    @import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;family=JetBrains+Mono:wght@400;500;600&amp;display=swap");')
    lines.append('    text { font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }')
    lines.append('    .mono { font-family: "JetBrains Mono", Menlo, Consolas, monospace; }')
    lines.append('  </style>')

    # Defs: Markers, Gradients, Shadows
    lines.append('  <defs>')
    lines.append('    <!-- Arrow Markers -->')
    lines.append('    <marker id="arr-blue" markerWidth="9" markerHeight="6" refX="8" refY="3" orient="auto">')
    lines.append('      <polygon points="0 0, 9 3, 0 6" fill="#2563eb"/>')
    lines.append('    </marker>')
    lines.append('    <marker id="arr-teal" markerWidth="9" markerHeight="6" refX="8" refY="3" orient="auto">')
    lines.append('      <polygon points="0 0, 9 3, 0 6" fill="#0d9488"/>')
    lines.append('    </marker>')
    lines.append('    <marker id="arr-indigo" markerWidth="9" markerHeight="6" refX="8" refY="3" orient="auto">')
    lines.append('      <polygon points="0 0, 9 3, 0 6" fill="#4f46e5"/>')
    lines.append('    </marker>')
    lines.append('    <marker id="arr-purple" markerWidth="9" markerHeight="6" refX="8" refY="3" orient="auto">')
    lines.append('      <polygon points="0 0, 9 3, 0 6" fill="#9333ea"/>')
    lines.append('    </marker>')
    lines.append('    <marker id="arr-amber" markerWidth="9" markerHeight="6" refX="8" refY="3" orient="auto">')
    lines.append('      <polygon points="0 0, 9 3, 0 6" fill="#d97706"/>')
    lines.append('    </marker>')
    lines.append('    <marker id="arr-red" markerWidth="9" markerHeight="6" refX="8" refY="3" orient="auto">')
    lines.append('      <polygon points="0 0, 9 3, 0 6" fill="#dc2626"/>')
    lines.append('    </marker>')
    lines.append('    <marker id="arr-green" markerWidth="9" markerHeight="6" refX="8" refY="3" orient="auto">')
    lines.append('      <polygon points="0 0, 9 3, 0 6" fill="#16a34a"/>')
    lines.append('    </marker>')
    lines.append('    <marker id="arr-slate" markerWidth="9" markerHeight="6" refX="8" refY="3" orient="auto">')
    lines.append('      <polygon points="0 0, 9 3, 0 6" fill="#64748b"/>')
    lines.append('    </marker>')

    # Soft Card Filter
    lines.append('    <filter id="card-shadow" x="-3%" y="-4%" width="106%" height="112%" filterUnits="userSpaceOnUse">')
    lines.append('      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.04"/>')
    lines.append('      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.02"/>')
    lines.append('    </filter>')
    lines.append('    <filter id="hover-shadow" x="-4%" y="-5%" width="108%" height="115%" filterUnits="userSpaceOnUse">')
    lines.append('      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#0284c7" flood-opacity="0.08"/>')
    lines.append('    </filter>')
    lines.append('  </defs>')

    # Canvas Background
    lines.append('  <!-- Canvas Background -->')
    lines.append('  <rect width="1440" height="980" fill="#F8FAFC"/>')

    # Subtle Dot Matrix Pattern
    lines.append('  <pattern id="dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">')
    lines.append('    <circle cx="2" cy="2" r="1" fill="#E2E8F0"/>')
    lines.append('  </pattern>')
    lines.append('  <rect width="1440" height="980" fill="url(#dot-grid)"/>')

    # Header Section
    lines.append('  <!-- Header -->')
    lines.append('  <g transform="translate(40, 24)">')
    lines.append('    <rect width="40" height="40" rx="10" fill="#2563EB"/>')
    lines.append('    <path d="M 20 10 L 20 30 M 10 20 L 30 20" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>')
    lines.append('    <text x="52" y="24" font-size="20" font-weight="800" fill="#0F172A" letter-spacing="-0.5px">HealthCare System Architecture</text>')
    lines.append('    <text x="52" y="38" font-size="12" font-weight="500" fill="#64748B">Enterprise Medical Platform • Production Cloud Topology &amp; Local Dev Ecosystem (2026)</text>')

    # Badges in Header
    lines.append('    <g transform="translate(1040, 4)">')
    lines.append('      <rect x="0" y="0" width="135" height="28" rx="6" fill="#EFF6FF" stroke="#BFDBFE"/>')
    lines.append('      <circle cx="12" cy="14" r="4" fill="#2563EB"/>')
    lines.append('      <text x="24" y="18" font-size="11" font-weight="600" fill="#1D4ED8">Next.js 16 + React 19</text>')
    lines.append('      <rect x="145" y="0" width="140" height="28" rx="6" fill="#F0FDF4" stroke="#BBF7D0"/>')
    lines.append('      <circle cx="157" cy="14" r="4" fill="#16A34A"/>')
    lines.append('      <text x="169" y="18" font-size="11" font-weight="600" fill="#15803D">Spring Boot 3 + AI RAG</text>')
    lines.append('    </g>')
    lines.append('  </g>')

    # ==========================================
    # LAYER 1: CLIENT & USER CHANNELS (y = 80..195)
    # ==========================================
    lines.append('  <!-- LAYER 1: CLIENT & USER CHANNELS -->')
    lines.append('  <g id="layer-client">')
    lines.append('    <rect x="40" y="80" width="1360" height="120" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#card-shadow)"/>')
    lines.append('    <!-- Layer Label Pill -->')
    lines.append('    <rect x="55" y="70" width="220" height="22" rx="6" fill="#EFF6FF" stroke="#93C5FD"/>')
    lines.append('    <text x="65" y="85" font-size="11" font-weight="700" fill="#1D4ED8" letter-spacing="0.5px">LAYER 1 • CLIENT &amp; APPS</text>')

    # Box 1.1: Multi-role Users
    lines.append('    <g transform="translate(60, 100)">')
    lines.append('      <rect width="250" height="84" rx="10" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>')
    lines.append('      <circle cx="28" cy="28" r="14" fill="#DBEAFE"/>')
    lines.append('      <path d="M 28 20 A 4 4 0 1 0 28 28 A 4 4 0 1 0 28 20 M 20 37 A 8 6 0 0 1 36 37" fill="none" stroke="#2563EB" stroke-width="2"/>')
    lines.append('      <text x="52" y="26" font-size="13" font-weight="700" fill="#0F172A">Hospital Users &amp; Roles</text>')
    lines.append('      <text x="52" y="42" font-size="11" fill="#64748B">Patients • Doctors • Admins</text>')
    lines.append('      <rect x="52" y="52" width="180" height="20" rx="4" fill="#E2E8F0"/>')
    lines.append('      <text x="58" y="66" class="mono" font-size="10" font-weight="600" fill="#334155">RBAC: PATIENT | DOCTOR | ADMIN</text>')
    lines.append('    </g>')

    # Box 1.2: Next.js 16 Web Portal
    lines.append('    <g transform="translate(340, 100)">')
    lines.append('      <rect width="320" height="84" rx="10" fill="#F8FAFC" stroke="#93C5FD" stroke-width="1.5"/>')
    lines.append('      <rect x="14" y="14" width="28" height="28" rx="6" fill="#EFF6FF"/>')
    lines.append('      <path d="M 20 34 L 28 18 L 36 34 M 23 29 L 33 29" stroke="#2563EB" stroke-width="2" stroke-linecap="round"/>')
    lines.append('      <text x="52" y="26" font-size="13" font-weight="700" fill="#0F172A">Next.js 16 Web Frontend</text>')
    lines.append('      <text x="52" y="42" font-size="11" fill="#64748B">App Router, Turbopack, TailwindCSS</text>')
    lines.append('      <g transform="translate(52, 54)">')
    lines.append('        <rect width="115" height="18" rx="4" fill="#DBEAFE"/>')
    lines.append('        <text x="6" y="13" font-size="10" font-weight="600" fill="#1D4ED8">React 19 Server Comp.</text>')
    lines.append('        <rect x="122" y="0" width="125" height="18" rx="4" fill="#E0F2FE"/>')
    lines.append('        <text x="128" y="13" font-size="10" font-weight="600" fill="#0369A1">Floating AI Assistant UI</text>')
    lines.append('      </g>')
    lines.append('    </g>')

    # Box 1.3: Role Portals
    lines.append('    <g transform="translate(690, 100)">')
    lines.append('      <rect width="360" height="84" rx="10" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>')
    lines.append('      <rect x="14" y="14" width="28" height="28" rx="6" fill="#F3E8FF"/>')
    lines.append('      <path d="M 20 22 H 36 M 20 28 H 36 M 20 34 H 28" stroke="#9333EA" stroke-width="2" stroke-linecap="round"/>')
    lines.append('      <text x="52" y="26" font-size="13" font-weight="700" fill="#0F172A">Clinical &amp; Management Portals</text>')
    lines.append('      <text x="52" y="42" font-size="11" fill="#64748B">Dedicated Views for Care Delivery &amp; Governance</text>')
    lines.append('      <g transform="translate(52, 54)">')
    lines.append('        <rect width="90" height="18" rx="4" fill="#F1F5F9"/>')
    lines.append('        <text x="8" y="13" class="mono" font-size="9.5" font-weight="600" fill="#475569">/patient (Hub)</text>')
    lines.append('        <rect x="96" y="0" width="95" height="18" rx="4" fill="#F1F5F9"/>')
    lines.append('        <text x="102" y="13" class="mono" font-size="9.5" font-weight="600" fill="#475569">/doctor (Studio)</text>')
    lines.append('        <rect x="197" y="0" width="95" height="18" rx="4" fill="#F1F5F9"/>')
    lines.append('        <text x="203" y="13" class="mono" font-size="9.5" font-weight="600" fill="#475569">/admin (CMS/QA)</text>')
    lines.append('      </g>')
    lines.append('    </g>')

    # Box 1.4: Mobile Responsive & PWA
    lines.append('    <g transform="translate(1080, 100)">')
    lines.append('      <rect width="300" height="84" rx="10" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>')
    lines.append('      <rect x="14" y="14" width="28" height="28" rx="6" fill="#DCFCE7"/>')
    lines.append('      <rect x="23" y="20" width="10" height="16" rx="2" stroke="#16A34A" stroke-width="1.8" fill="none"/>')
    lines.append('      <circle cx="28" cy="33" r="1" fill="#16A34A"/>')
    lines.append('      <text x="52" y="26" font-size="13" font-weight="700" fill="#0F172A">Mobile Experience &amp; PWA</text>')
    lines.append('      <text x="52" y="42" font-size="11" fill="#64748B">Zero layout shift, 390px-1440px</text>')
    lines.append('      <g transform="translate(52, 54)">')
    lines.append('        <rect width="110" height="18" rx="4" fill="#DCFCE7"/>')
    lines.append('        <text x="6" y="13" font-size="10" font-weight="600" fill="#15803D">Touch-Optimized</text>')
    lines.append('        <rect x="116" y="0" width="115" height="18" rx="4" fill="#F1F5F9"/>')
    lines.append('        <text x="122" y="13" font-size="10" font-weight="600" fill="#475569">Fast Offline Shell</text>')
    lines.append('      </g>')
    lines.append('    </g>')
    lines.append('  </g>')

    # ==========================================
    # LAYER 2: GATEWAY & VERCEL EDGE (y = 225..325)
    # ==========================================
    lines.append('  <!-- LAYER 2: GATEWAY & VERCEL EDGE -->')
    lines.append('  <g id="layer-gateway">')
    lines.append('    <rect x="40" y="225" width="1360" height="105" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#card-shadow)"/>')
    lines.append('    <!-- Layer Label Pill -->')
    lines.append('    <rect x="55" y="215" width="280" height="22" rx="6" fill="#ECFDF5" stroke="#A7F3D0"/>')
    lines.append('    <text x="65" y="230" font-size="11" font-weight="700" fill="#047857" letter-spacing="0.5px">LAYER 2 • GATEWAY &amp; VERCEL EDGE NETWORK</text>')

    # Edge Box 2.1: Domain & Anycast CDN
    lines.append('    <g transform="translate(60, 245)">')
    lines.append('      <rect width="360" height="70" rx="8" fill="#F0FDF4" stroke="#86EFAC" stroke-width="1.2"/>')
    lines.append('      <circle cx="28" cy="24" r="12" fill="#DCFCE7"/>')
    lines.append('      <path d="M 28 14 A 10 10 0 1 0 28 34 M 18 24 H 38 M 28 14 C 24 18 24 30 28 34 C 32 30 32 18 28 14" stroke="#16A34A" stroke-width="1.5" fill="none"/>')
    lines.append('      <text x="50" y="24" font-size="13" font-weight="700" fill="#0F172A">Custom Domain &amp; Anycast Edge</text>')
    lines.append('      <text x="50" y="40" class="mono" font-size="11" font-weight="600" fill="#15803D">www.healthcare.id.vn • healthcare-two-olive</text>')
    lines.append('      <text x="50" y="56" font-size="10.5" fill="#475569">Global SSL/TLS 1.3 Termination, Edge Static Caching</text>')
    lines.append('    </g>')

    # Edge Box 2.2: Edge Origin Guard & CORS
    lines.append('    <g transform="translate(450, 245)">')
    lines.append('      <rect width="420" height="70" rx="8" fill="#F0FDFA" stroke="#99F6E4" stroke-width="1.2"/>')
    lines.append('      <circle cx="28" cy="24" r="12" fill="#CCFBF1"/>')
    lines.append('      <path d="M 28 14 L 35 18 V 26 C 35 31 28 34 28 34 C 28 34 21 31 21 26 V 18 Z" stroke="#0D9488" stroke-width="1.5" fill="none"/>')
    lines.append('      <text x="50" y="24" font-size="13" font-weight="700" fill="#0F172A">Edge Origin Guard &amp; Rate Defense</text>')
    lines.append('      <text x="50" y="40" font-size="11" font-weight="600" fill="#0F766E">BFF Origin Guard: 403 Forbidden on untrusted origins</text>')
    lines.append('      <text x="50" y="56" font-size="10.5" fill="#475569">DDoS mitigation, Path rewrite, Synthetic beta failover</text>')
    lines.append('    </g>')

    # Edge Box 2.3: BFF Proxy & Token Exchange
    lines.append('    <g transform="translate(900, 245)">')
    lines.append('      <rect width="480" height="70" rx="8" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>')
    lines.append('      <circle cx="28" cy="24" r="12" fill="#E2E8F0"/>')
    lines.append('      <path d="M 22 28 L 28 20 L 34 28 M 28 22 V 32" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/>')
    lines.append('      <text x="50" y="24" font-size="13" font-weight="700" fill="#0F172A">Next.js Route Handlers / BFF Proxy</text>')
    lines.append('      <text x="50" y="40" class="mono" font-size="11" font-weight="600" fill="#2563EB">/api/v1/*  &amp;  /api/ai/chat (SSE Stream)</text>')
    lines.append('      <text x="50" y="56" font-size="10.5" fill="#475569">Server-side Bearer token injection, masks internal ports</text>')
    lines.append('    </g>')
    lines.append('  </g>')

    # ==========================================
    # LAYER 3: CORE APPLICATION SERVICES (Render Cloud) (y = 360..525)
    # ==========================================
    lines.append('  <!-- LAYER 3: APPLICATION SERVICES -->')
    lines.append('  <g id="layer-services">')
    lines.append('    <rect x="40" y="360" width="1360" height="175" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#card-shadow)"/>')
    lines.append('    <!-- Layer Label Pill (ends at x=365 to avoid any collision with BFF arrow at x=400) -->')
    lines.append('    <rect x="55" y="350" width="310" height="22" rx="6" fill="#EEF2FF" stroke="#C7D2FE"/>')
    lines.append('    <text x="65" y="365" font-size="11" font-weight="700" fill="#4338CA" letter-spacing="0.5px">LAYER 3 • APPLICATION SERVICES (RENDER CLOUD)</text>')

    # Service Cluster 3.1: Spring Boot 3 Java Backend
    lines.append('    <g transform="translate(60, 380)">')
    lines.append('      <rect width="630" height="140" rx="10" fill="#F8FAFC" stroke="#818CF8" stroke-width="1.5"/>')
    lines.append('      <!-- Sub-header -->')
    lines.append('      <rect x="12" y="10" width="28" height="28" rx="6" fill="#EEF2FF"/>')
    lines.append('      <circle cx="26" cy="24" r="7" stroke="#4F46E5" stroke-width="2" fill="none"/>')
    lines.append('      <path d="M 26 21 V 24 L 28 26" stroke="#4F46E5" stroke-width="1.8" stroke-linecap="round"/>')
    lines.append('      <text x="48" y="24" font-size="14" font-weight="800" fill="#1E1B4B">Core Backend Services (Spring Boot 3.3.x, Java 21)</text>')
    lines.append('      <text x="48" y="38" font-size="11" fill="#6366F1">Modular Monolith Architecture • Multi-tenant / Role Security</text>')

    # Internal Modules inside Spring Boot (3 modules x 194 width + 10px spacing = 602 total)
    lines.append('      <g transform="translate(14, 50)">')
    # Module 1: Auth & RBAC
    lines.append('        <rect x="0" y="0" width="194" height="74" rx="6" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="10" y="18" font-size="11" font-weight="700" fill="#0F172A">Spring Security &amp; Auth</text>')
    lines.append('        <text x="10" y="32" font-size="10" fill="#64748B">• JWT Stateless Token Auth</text>')
    lines.append('        <text x="10" y="46" font-size="10" fill="#64748B">• Bounded OTP Confirmation</text>')
    lines.append('        <text x="10" y="60" font-size="10" fill="#64748B">• RBAC Guards &amp; BCrypt</text>')

    # Module 2: Clinical & Booking Engine
    lines.append('        <rect x="204" y="0" width="194" height="74" rx="6" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="214" y="18" font-size="11" font-weight="700" fill="#0F172A">Booking &amp; Clinical</text>')
    lines.append('        <text x="214" y="32" font-size="10" fill="#64748B">• Branch-aware Doctor Slots</text>')
    lines.append('        <text x="214" y="46" font-size="10" fill="#64748B">• Appointment Lock Flow</text>')
    lines.append('        <text x="214" y="60" font-size="10" fill="#64748B">• Medical Records &amp; Diag</text>')

    # Module 3: Catalog, CMS & Payments
    lines.append('        <rect x="408" y="0" width="194" height="74" rx="6" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="418" y="18" font-size="11" font-weight="700" fill="#0F172A">Catalog, CMS &amp; Pay</text>')
    lines.append('        <text x="418" y="32" font-size="10" fill="#64748B">• Real-time Event Stream</text>')
    lines.append('        <text x="418" y="46" font-size="10" fill="#64748B">• Bank Transfer Reconcile</text>')
    lines.append('        <text x="418" y="60" font-size="10" fill="#64748B">• SSE/WS Notifications</text>')
    lines.append('      </g>')
    lines.append('    </g>')

    # Service Cluster 3.2: FastAPI AI & RAG Service
    lines.append('    <g transform="translate(750, 380)">')
    lines.append('      <rect width="630" height="140" rx="10" fill="#F8FAFC" stroke="#C084FC" stroke-width="1.5"/>')
    lines.append('      <!-- Sub-header -->')
    lines.append('      <rect x="12" y="10" width="28" height="28" rx="6" fill="#FAF5FF"/>')
    lines.append('      <path d="M 26 16 L 28 22 L 34 24 L 28 26 L 26 32 L 24 26 L 18 24 L 24 22 Z" fill="#9333EA"/>')
    lines.append('      <text x="48" y="24" font-size="14" font-weight="800" fill="#3B0764">AI &amp; RAG Intelligence Service (FastAPI, Python 3.12)</text>')
    lines.append('      <text x="48" y="38" font-size="11" fill="#9333EA">Autonomous Medical Assistant • Semantic Search &amp; Safety Filters</text>')

    # Internal Modules inside FastAPI AI (3 modules x 194 width + 10px spacing = 602 total)
    lines.append('      <g transform="translate(14, 50)">')
    # AI Module 1: RAG Engine
    lines.append('        <rect x="0" y="0" width="194" height="74" rx="6" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="10" y="18" font-size="11" font-weight="700" fill="#0F172A">RAG &amp; Embeddings</text>')
    lines.append('        <text x="10" y="32" font-size="10" fill="#64748B">• Vector Similarity Search</text>')
    lines.append('        <text x="10" y="46" font-size="10" fill="#64748B">• Medical Knowledge Base</text>')
    lines.append('        <text x="10" y="60" font-size="10" fill="#64748B">• Curated Protocols</text>')

    # AI Module 2: Medical Safety Guardrails
    lines.append('        <rect x="204" y="0" width="194" height="74" rx="6" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="214" y="18" font-size="11" font-weight="700" fill="#0F172A">Safety Guardrails</text>')
    lines.append('        <text x="214" y="32" font-size="10" fill="#64748B">• Prompt Injection Shield</text>')
    lines.append('        <text x="214" y="46" font-size="10" fill="#64748B">• Privacy &amp; Record Refusal</text>')
    lines.append('        <text x="214" y="60" font-size="10" fill="#64748B">• Hallucination Check</text>')

    # AI Module 3: Fail-Closed Provider Fallback
    lines.append('        <rect x="408" y="0" width="194" height="74" rx="6" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="418" y="18" font-size="11" font-weight="700" fill="#0F172A">Fallback Engine</text>')
    lines.append('        <text x="418" y="32" font-size="10" fill="#64748B">• Local Deterministic Rule</text>')
    lines.append('        <text x="418" y="46" font-size="10" fill="#64748B">• Cloud LLM Provider</text>')
    lines.append('        <text x="418" y="60" font-size="10" fill="#64748B">• Fail-closed Breaker</text>')
    lines.append('      </g>')
    lines.append('    </g>')
    lines.append('  </g>')

    # ==========================================
    # LAYER 4: DATA PERSISTENCE & STORAGE (y = 560..730)
    # ==========================================
    lines.append('  <!-- LAYER 4: DATA PERSISTENCE & STORAGE -->')
    lines.append('  <g id="layer-data">')
    lines.append('    <rect x="40" y="560" width="1360" height="170" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#card-shadow)"/>')
    lines.append('    <!-- Layer Label Pill -->')
    lines.append('    <rect x="55" y="550" width="310" height="22" rx="6" fill="#FFFBEB" stroke="#FDE68A"/>')
    lines.append('    <text x="65" y="565" font-size="11" font-weight="700" fill="#B45309" letter-spacing="0.5px">LAYER 4 • DATA PERSISTENCE &amp; STORAGE STACK</text>')

    # Data 4.1: PostgreSQL 16
    lines.append('    <g transform="translate(60, 580)">')
    lines.append('      <rect width="300" height="135" rx="10" fill="#F8FAFC" stroke="#FBBF24" stroke-width="1.5"/>')
    lines.append('      <!-- Cylinder Icon -->')
    lines.append('      <g transform="translate(14, 12)">')
    lines.append('        <ellipse cx="14" cy="6" rx="12" ry="5" fill="#FEF3C7" stroke="#D97706" stroke-width="1.5"/>')
    lines.append('        <path d="M 2 6 V 22 A 12 5 0 0 0 26 22 V 6" fill="#FEF3C7" stroke="#D97706" stroke-width="1.5"/>')
    lines.append('      </g>')
    lines.append('      <text x="50" y="24" font-size="13" font-weight="800" fill="#0F172A">PostgreSQL 16 (Relational DB)</text>')
    lines.append('      <text x="50" y="38" font-size="10.5" fill="#D97706">Transactional System of Record</text>')
    lines.append('      <g transform="translate(14, 48)">')
    lines.append('        <rect width="270" height="22" rx="4" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="8" y="15" class="mono" font-size="10" fill="#334155">• Flyway Migrations (V1..V8 Schema)</text>')
    lines.append('        <rect y="28" width="270" height="22" rx="4" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="8" y="43" font-size="10" fill="#334155">• Doctors, Specialties, Bookings, Slotted Times</text>')
    lines.append('        <rect y="56" width="270" height="22" rx="4" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="8" y="71" font-size="10" fill="#334155">• Row-Level Isolation &amp; Audit Logs</text>')
    lines.append('      </g>')
    lines.append('    </g>')

    # Data 4.2: Redis / Render Key-Value
    lines.append('    <g transform="translate(380, 580)">')
    lines.append('      <rect width="290" height="135" rx="10" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>')
    lines.append('      <g transform="translate(14, 12)">')
    lines.append('        <rect width="24" height="24" rx="5" fill="#FEE2E2"/>')
    lines.append('        <path d="M 6 12 L 18 6 L 18 18 Z" fill="#DC2626"/>')
    lines.append('      </g>')
    lines.append('      <text x="46" y="24" font-size="13" font-weight="800" fill="#0F172A">Redis / Render KV Cache</text>')
    lines.append('      <text x="46" y="38" font-size="10.5" fill="#DC2626">High-speed In-Memory Store</text>')
    lines.append('      <g transform="translate(14, 48)">')
    lines.append('        <rect width="260" height="22" rx="4" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="8" y="15" font-size="10" fill="#334155">• Sliding Window Rate-Limiting</text>')
    lines.append('        <rect y="28" width="260" height="22" rx="4" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="8" y="43" font-size="10" fill="#334155">• Ephemeral OTP &amp; Session Tokens</text>')
    lines.append('        <rect y="56" width="260" height="22" rx="4" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="8" y="71" font-size="10" fill="#334155">• Fast Realtime Catalog Cache</text>')
    lines.append('      </g>')
    lines.append('    </g>')

    # Data 4.3: MinIO / S3 Object Storage & ClamAV
    lines.append('    <g transform="translate(690, 580)">')
    lines.append('      <rect width="330" height="135" rx="10" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>')
    lines.append('      <g transform="translate(14, 12)">')
    lines.append('        <rect width="24" height="24" rx="5" fill="#F0FDF4"/>')
    lines.append('        <path d="M 6 18 A 6 6 0 0 1 12 10 A 8 8 0 0 1 22 14 A 5 5 0 0 1 20 20 Z" stroke="#16A34A" stroke-width="1.5" fill="none"/>')
    lines.append('      </g>')
    lines.append('      <text x="46" y="24" font-size="13" font-weight="800" fill="#0F172A">MinIO / S3 Object Storage</text>')
    lines.append('      <text x="46" y="38" font-size="10.5" fill="#16A34A">Encrypted Document Store</text>')
    lines.append('      <g transform="translate(14, 48)">')
    lines.append('        <rect width="300" height="22" rx="4" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="8" y="15" font-size="10" fill="#334155">• Diagnostic Records &amp; Scan Attachments</text>')
    lines.append('        <rect y="28" width="300" height="22" rx="4" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="8" y="43" font-size="10" fill="#334155">• Doctor Profiles &amp; Avatar Media Assets</text>')
    lines.append('        <rect y="56" width="300" height="22" rx="4" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="8" y="71" font-size="10" fill="#334155">• ClamAV Antivirus Quarantine Pipe</text>')
    lines.append('      </g>')
    lines.append('    </g>')

    # Data 4.4: Supabase RLS Synced Analytics
    lines.append('    <g transform="translate(1040, 580)">')
    lines.append('      <rect width="340" height="135" rx="10" fill="#F8FAFC" stroke="#6EE7B7" stroke-width="1.5"/>')
    lines.append('      <g transform="translate(14, 12)">')
    lines.append('        <rect width="24" height="24" rx="5" fill="#ECFDF5"/>')
    lines.append('        <path d="M 12 6 L 16 14 H 8 L 12 6 M 12 14 L 16 22 H 8 L 12 14" stroke="#059669" stroke-width="1.5" fill="none"/>')
    lines.append('      </g>')
    lines.append('      <text x="46" y="24" font-size="13" font-weight="800" fill="#0F172A">Supabase (Audited Boundary)</text>')
    lines.append('      <text x="46" y="38" font-size="10.5" fill="#059669">Healthcare Schema + RLS Projections</text>')
    lines.append('      <g transform="translate(14, 48)">')
    lines.append('        <rect width="310" height="22" rx="4" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="8" y="15" font-size="10" fill="#334155">• 15 Core Tables with Enforced RLS</text>')
    lines.append('        <rect y="28" width="310" height="22" rx="4" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="8" y="43" font-size="10" fill="#334155">• De-identified Projections &amp; Read Replicas</text>')
    lines.append('        <rect y="56" width="310" height="22" rx="4" fill="#FFFFFF" stroke="#E2E8F0"/>')
    lines.append('        <text x="8" y="71" font-size="10" fill="#334155">• Service-role Tombstone &amp; Filter Gates</text>')
    lines.append('      </g>')
    lines.append('    </g>')
    lines.append('  </g>')

    # ==========================================
    # LAYER 5: DEVOPS, SECURITY & CI/CD (y = 750..845)
    # ==========================================
    lines.append('  <!-- LAYER 5: OPERATIONS & CI/CD -->')
    lines.append('  <g id="layer-ops">')
    lines.append('    <rect x="40" y="750" width="1360" height="95" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" filter="url(#card-shadow)"/>')
    lines.append('    <!-- Layer Label Pill -->')
    lines.append('    <rect x="55" y="740" width="280" height="22" rx="6" fill="#F1F5F9" stroke="#CBD5E1"/>')
    lines.append('    <text x="65" y="755" font-size="11" font-weight="700" fill="#475569" letter-spacing="0.5px">LAYER 5 • DEVOPS, SECURITY &amp; PIPELINES</text>')

    # Ops 5.1: GitHub Actions CI/CD
    lines.append('    <g transform="translate(60, 770)">')
    lines.append('      <rect width="410" height="60" rx="8" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>')
    lines.append('      <text x="14" y="24" font-size="12.5" font-weight="700" fill="#0F172A">GitHub Actions Enterprise CI/CD</text>')
    lines.append('      <text x="14" y="42" font-size="10.5" fill="#64748B">• Lint, Typecheck, Unit/Integration Test Matrix</text>')
    lines.append('      <text x="14" y="54" font-size="10.5" fill="#64748B">• Multi-arch Docker Build + SBOM &amp; Provenance</text>')
    lines.append('    </g>')

    # Ops 5.2: ClamAV & Security
    lines.append('    <g transform="translate(490, 770)">')
    lines.append('      <rect width="410" height="60" rx="8" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>')
    lines.append('      <text x="14" y="24" font-size="12.5" font-weight="700" fill="#0F172A">ClamAV &amp; Security Scanners</text>')
    lines.append('      <text x="14" y="42" font-size="10.5" fill="#64748B">• Real-time attachment virus scanning daemon</text>')
    lines.append('      <text x="14" y="54" font-size="10.5" fill="#64748B">• OWASP dependency audit, secret leakage gates</text>')
    lines.append('    </g>')

    # Ops 5.3: Mailpit & Development Tools
    lines.append('    <g transform="translate(920, 770)">')
    lines.append('      <rect width="460" height="60" rx="8" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1.2"/>')
    lines.append('      <text x="14" y="24" font-size="12.5" font-weight="700" fill="#0F172A">Mailpit &amp; Compose Diagnostic Suite</text>')
    lines.append('      <text x="14" y="42" font-size="10.5" fill="#64748B">• SMTP dev sink for appointment confirmation &amp; OTP</text>')
    lines.append('      <text x="14" y="54" font-size="10.5" fill="#64748B">• 9-service Docker Compose topology with healthchecks</text>')
    lines.append('    </g>')
    lines.append('  </g>')

    # ==========================================
    # ARROWS & CONNECTORS (Orthogonal Routing)
    # ==========================================
    lines.append('  <!-- CONNECTORS & FLOWS -->')

    # Flow 1: Users -> Next.js Frontend (x = 185 -> 340)
    lines.append('  <path d="M 310,142 L 340,142" stroke="#2563eb" stroke-width="2" marker-end="url(#arr-blue)"/>')

    # Flow 2: Next.js Frontend -> Role Portals
    lines.append('  <path d="M 660,142 L 690,142" stroke="#2563eb" stroke-width="2" marker-end="url(#arr-blue)"/>')

    # Flow 3: Next.js Frontend -> Gateway (x=500, y=184 -> y=225)
    lines.append('  <path d="M 500,184 L 500,225" stroke="#2563eb" stroke-width="2" marker-end="url(#arr-blue)"/>')
    # Flow 3 label pill
    lines.append('  <rect x="440" y="196" width="120" height="18" rx="4" fill="#F8FAFC" stroke="#CBD5E1" opacity="0.95"/>')
    lines.append('  <text x="500" y="209" font-size="9.5" font-weight="600" fill="#1E40AF" text-anchor="middle">HTTPS / TLS 1.3</text>')

    # Flow 4: Gateway Edge Origin Guard -> BFF Proxy
    lines.append('  <path d="M 870,280 L 900,280" stroke="#0d9488" stroke-width="2" marker-end="url(#arr-teal)"/>')

    # Flow 5: BFF Proxy -> Spring Boot Backend (Orthogonal: x=1050, y=315 -> L 1050,335 -> L 390,335 -> L 390,380)
    lines.append('  <path d="M 1000,315 L 1000,340 L 400,340 L 400,380" fill="none" stroke="#2563eb" stroke-width="2" marker-end="url(#arr-blue)"/>')
    lines.append('  <rect x="630" y="331" width="170" height="18" rx="4" fill="#F8FAFC" stroke="#93C5FD" opacity="0.95"/>')
    lines.append('  <text x="715" y="344" font-size="9.5" font-weight="600" fill="#1D4ED8" text-anchor="middle">BFF Token Auth (REST APIs)</text>')

    # Flow 6: BFF Proxy -> FastAPI AI Chat (Orthogonal: x=1220, y=315 -> L 1220,380)
    lines.append('  <path d="M 1220,315 L 1220,380" fill="none" stroke="#9333ea" stroke-width="2" marker-end="url(#arr-purple)"/>')
    lines.append('  <rect x="1140" y="335" width="160" height="18" rx="4" fill="#F8FAFC" stroke="#D8B4FE" opacity="0.95"/>')
    lines.append('  <text x="1220" y="348" font-size="9.5" font-weight="600" fill="#7E22CE" text-anchor="middle">AI Chat SSE Stream / RAG</text>')

    # Flow 7: Spring Boot -> FastAPI AI Service (Inter-service internal API: x=690, y=445 -> x=750, y=445)
    lines.append('  <path d="M 690,445 L 750,445" stroke="#4f46e5" stroke-width="2" stroke-dasharray="4 2" marker-end="url(#arr-indigo)"/>')
    lines.append('  <rect x="692" y="437" width="56" height="16" rx="3" fill="#EEF2FF" stroke="#C7D2FE"/>')
    lines.append('  <text x="720" y="449" font-size="8" font-weight="700" fill="#4338CA" text-anchor="middle">Triage RAG</text>')

    # Flow 8: Spring Boot Backend -> PostgreSQL 16 (x=210, y=520 -> x=210, y=580)
    lines.append('  <path d="M 210,520 L 210,580" fill="none" stroke="#d97706" stroke-width="2" marker-end="url(#arr-amber)"/>')
    lines.append('  <rect x="150" y="538" width="120" height="18" rx="4" fill="#F8FAFC" stroke="#FDE68A" opacity="0.95"/>')
    lines.append('  <text x="210" y="551" font-size="9.5" font-weight="600" fill="#B45309" text-anchor="middle">JDBC / Flyway DDL</text>')

    # Flow 9: Spring Boot Backend -> Redis (x=450, y=520 -> x=450, y=580)
    lines.append('  <path d="M 450,520 L 450,580" fill="none" stroke="#dc2626" stroke-width="2" marker-end="url(#arr-red)"/>')
    lines.append('  <rect x="390" y="538" width="120" height="18" rx="4" fill="#F8FAFC" stroke="#FECACA" opacity="0.95"/>')
    lines.append('  <text x="450" y="551" font-size="9.5" font-weight="600" fill="#991B1B" text-anchor="middle">Jedis / Lettuce KV</text>')

    # Flow 10: Spring Boot Backend -> MinIO (x=600, y=520 -> L 600,540 -> L 760,540 -> L 760,580)
    lines.append('  <path d="M 600,520 L 600,540 L 760,540 L 760,580" fill="none" stroke="#16a34a" stroke-width="2" marker-end="url(#arr-green)"/>')
    lines.append('  <rect x="680" y="532" width="125" height="18" rx="4" fill="#F8FAFC" stroke="#BBF7D0" opacity="0.95"/>')
    lines.append('  <text x="742" y="545" font-size="9.5" font-weight="600" fill="#166534" text-anchor="middle">S3 Presigned URLs</text>')

    # Flow 11: PostgreSQL -> Supabase (Audited RLS Projection Sync: clean corridor below DB cards at y=724)
    lines.append('  <path d="M 340,715 L 340,724 L 1060,724 L 1060,715" fill="none" stroke="#059669" stroke-width="1.8" stroke-dasharray="5 3" marker-end="url(#arr-teal)"/>')
    lines.append('  <rect x="610" y="715" width="180" height="18" rx="4" fill="#ECFDF5" stroke="#A7F3D0" opacity="0.95"/>')
    lines.append('  <text x="700" y="728" font-size="9" font-weight="600" fill="#047857" text-anchor="middle">Audited RLS Projection Sync</text>')

    # ==========================================
    # LEGEND & METADATA BAR (y = 860..945)
    # ==========================================
    lines.append('  <!-- LEGEND & SPECIFICATIONS -->')
    lines.append('  <g transform="translate(40, 865)">')
    lines.append('    <rect width="1360" height="90" rx="10" fill="#0F172A"/>')

    # Legend Section Title
    lines.append('    <text x="24" y="28" font-size="12" font-weight="800" fill="#F8FAFC" letter-spacing="0.5px">SYSTEM FLOW LEGEND &amp; VERIFICATION SPECIFICATION</text>')

    # Legend Items
    # 1. Primary Flow
    lines.append('    <g transform="translate(24, 45)">')
    lines.append('      <line x1="0" y1="10" x2="30" y2="10" stroke="#2563eb" stroke-width="2.5" marker-end="url(#arr-blue)"/>')
    lines.append('      <text x="38" y="14" font-size="11" font-weight="600" fill="#94A3B8">Client &amp; BFF Ingestion</text>')
    lines.append('    </g>')

    # 2. Edge & Security Flow
    lines.append('    <g transform="translate(230, 45)">')
    lines.append('      <line x1="0" y1="10" x2="30" y2="10" stroke="#0d9488" stroke-width="2.5" marker-end="url(#arr-teal)"/>')
    lines.append('      <text x="38" y="14" font-size="11" font-weight="600" fill="#94A3B8">Origin Guard &amp; TLS Edge</text>')
    lines.append('    </g>')

    # 3. AI & RAG Inference
    lines.append('    <g transform="translate(440, 45)">')
    lines.append('      <line x1="0" y1="10" x2="30" y2="10" stroke="#9333ea" stroke-width="2.5" marker-end="url(#arr-purple)"/>')
    lines.append('      <text x="38" y="14" font-size="11" font-weight="600" fill="#94A3B8">AI RAG &amp; SSE Stream</text>')
    lines.append('    </g>')

    # 4. Database Transaction
    lines.append('    <g transform="translate(640, 45)">')
    lines.append('      <line x1="0" y1="10" x2="30" y2="10" stroke="#d97706" stroke-width="2.5" marker-end="url(#arr-amber)"/>')
    lines.append('      <text x="38" y="14" font-size="11" font-weight="600" fill="#94A3B8">Flyway / Relational Data</text>')
    lines.append('    </g>')

    # 5. Async & Projections
    lines.append('    <g transform="translate(850, 45)">')
    lines.append('      <line x1="0" y1="10" x2="30" y2="10" stroke="#059669" stroke-width="2" stroke-dasharray="4 2" marker-end="url(#arr-teal)"/>')
    lines.append('      <text x="38" y="14" font-size="11" font-weight="600" fill="#94A3B8">RLS Sync / Internal Events</text>')
    lines.append('    </g>')

    # Right: Environment Status Pill
    lines.append('    <g transform="translate(1080, 20)">')
    lines.append('      <rect width="250" height="50" rx="6" fill="#1E293B" stroke="#334155"/>')
    lines.append('      <circle cx="16" cy="18" r="4" fill="#10B981"/>')
    lines.append('      <text x="28" y="22" font-size="11" font-weight="700" fill="#F8FAFC">Active Beta: www.healthcare.id.vn</text>')
    lines.append('      <text x="28" y="38" class="mono" font-size="10" fill="#94A3B8">Render Free Tier + Vercel Edge</text>')
    lines.append('    </g>')
    lines.append('  </g>')

    lines.append('</svg>')

    content = '\n'.join(lines)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Generated SVG: {output_path} ({len(content)} bytes)")

if __name__ == '__main__':
    svg_path = 'd:/HealthCare_Project/docs/assets/architecture.svg'
    generate_architecture_svg(svg_path)
    # Also update legacy path in assets/images/
    generate_architecture_svg('d:/HealthCare_Project/assets/images/healthcare-system-architecture.svg')
