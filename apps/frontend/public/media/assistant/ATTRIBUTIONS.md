# Assistant asset provenance

This directory contains original raster artwork generated for the patient chatbot
assistant. These files are project-owned generated artwork; they are not copied
from the legacy chibi asset and do not carry a third-party stock license.

## Published assets

| File | Role | Dimensions | Alpha | Bytes | SHA-256 |
| --- | --- | ---: | :---: | ---: | --- |
| `assistant-mascot-neutral-v1.webp` | Neutral non-human mascot for the header, empty state, and onboarding | 768 x 768 | yes | 28,108 | `B016692A5515DE4098BBE04225D72090CBB98F71304ADE1B249524DCA3C55759` |
| `assistant-guide-chibi-v2.webp` | Secondary chibi illustration for onboarding/legacy presentation only; not a control | 768 x 768 | yes | 60,074 | `93D735ECCFD42A99D853E8E4E909587DFFEA58038DA3D63BF38A91AF731F74CF` |

Both files are WebP with transparency and remain below the 200 KB public-asset
budget. The existing `../healthcare-assistant-chibi.png` was intentionally left
untouched because its provenance is not recorded here.

## Generation record

- Generated: 2026-08-24 using the built-in OpenAI image generation tool.
- Source artwork was generated at 1254 x 1254 with an alpha channel and then
  resized to 768 x 768, stripped of metadata, and encoded as WebP (quality 82,
  alpha quality 90).
- Source SHA-256, neutral mascot: `38A391F09D50381B670DDFB96631F74E291919C0F73BE8D7986506B9ADB99E2A`.
- Source SHA-256, chibi guide: `A5E7D824BB6FF323EFC675F792C25FA6C41B87272B6901F69C6342128B499514`.
- Source generation output IDs are retained in the task evidence; the published
  hashes above are the reproducible hand-off identity.

## Prompt and visual constraints

The prompt family requested a calm Vietnamese healthcare navigation guide, flat
2.5D product illustration, transparent 1:1 composition, teal/mint/ink/amber and
off-white palette, crisp silhouette at 72--112 px, and no text. The neutral
mascot is a single connected speech-bubble form with an integrated heartbeat
tail. The chibi guide is a friendly digital-service guide in a utility jacket,
not a clinician.

The generation explicitly excluded hospital branding, Red Cross/cross symbols,
watermarks, badges claiming medical authority, diagnosis or prescription cues,
stethoscopes, syringes, extra characters, UI frames, and decorative status
indicators. The amber accent in the neutral mascot is attached as a cheek detail,
not a service-status indicator.

## Review notes

- Visual inspection confirmed a transparent background, one subject per asset,
  no readable text or watermark, and a clean silhouette at the intended display
  sizes.
- The neutral mascot is the only candidate for the assistant header/empty state;
  the chibi guide must not be used as the launcher icon or a second interactive
  control.
- Before production use, run the normal frontend asset audit and accessibility
  review. These generated assets do not constitute clinical, licensing, or
  production-readiness evidence.
