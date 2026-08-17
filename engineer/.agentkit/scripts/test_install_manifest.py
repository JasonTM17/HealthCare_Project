#!/usr/bin/env python3
"""Regression tests for portable install-manifest identities."""

from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("generate-install-manifest.py")
SPEC = importlib.util.spec_from_file_location("generate_install_manifest", SCRIPT)
if SPEC is None or SPEC.loader is None:  # pragma: no cover - import bootstrap guard
    raise RuntimeError(f"cannot load {SCRIPT}")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CanonicalBytesTests(unittest.TestCase):
    def test_valid_utf8_line_endings_are_portable(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            crlf = root / "crlf.txt"
            lf = root / "lf.txt"
            crlf.write_bytes("Wukong\r\nUnicode: 猴王\r\n".encode("utf-8"))
            lf.write_bytes("Wukong\nUnicode: 猴王\n".encode("utf-8"))
            self.assertEqual(MODULE.sha256(crlf), MODULE.sha256(lf))

    def test_invalid_utf8_bytes_never_collapse_through_replacement(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            left = root / "left.bin"
            right = root / "right.bin"
            left.write_bytes(bytes([0x80]))
            right.write_bytes(bytes([0x81]))
            self.assertNotEqual(MODULE.sha256(left), MODULE.sha256(right))
            self.assertEqual(MODULE.canonical_bytes(left), bytes([0x80]))
            self.assertEqual(MODULE.canonical_bytes(right), bytes([0x81]))


if __name__ == "__main__":
    unittest.main()
