# Bundled fonts (server-side PDF rendering only)

Files:
- NotoSans-Regular.ttf  sha256 478c558ea716033cd60c03438f628dfa75694dcf6b5f6d505a2f05fd2b4f3823
- NotoSans-Bold.ttf     sha256 1df075a380fc7cb898acf64c1f7b3b4dd780de3caa860178bf929de35817a913

Source: official Noto project mirror https://github.com/notofonts/notofonts.github.io
(path fonts/NotoSans/hinted/ttf/, downloaded once at build-authoring time,
2026-09-09). Both files carry the SIL Open Font License 1.1 (see OFL.txt).
They are embedded into synthetic demo PDFs by the offline renderer and are not
served to browsers. Vietnamese diacritics are covered by the Latin Extended
Additional glyphs in Noto Sans.
