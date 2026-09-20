import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getDoctorInitials,
  getDoctorPhoto,
} from "../lib/doctor-portrait.ts";

const root = new URL("../", import.meta.url);

test("doctor portrait source encodes the own-photo-or-null contract", async () => {
  const source = await readFile(new URL("lib/doctor-portrait.ts", root), "utf8");

  assert.match(
    source,
    /export function getDoctorPhoto\([^)]*\):\s*string \| null/,
    "getDoctorPhoto must declare the nullable own-photo contract",
  );
  assert.doesNotMatch(
    source,
    /CURATED_DOCTOR_PORTRAITS|CORE_DOCTOR_PORTRAITS|DOCTOR_NAME_MAP/,
    "portrait maps that assign shared photographs to named doctors must stay deleted",
  );
  assert.doesNotMatch(
    source,
    /hashString/,
    "deterministic portrait hash-assignment must stay deleted",
  );
});

test("valid catalog portraits pass through untouched", () => {
  const cases = [
    "/media/doctors/doctor-5.jpg",
    "https://cdn.healthcare.id.vn/portraits/bs-tran-thu-ha.jpg",
    "  /media/doctors/doctor-3.jpg  ",
  ];
  for (const photoUrl of cases) {
    assert.equal(
      getDoctorPhoto({ photoUrl }),
      photoUrl.trim(),
      "the doctor's own catalog portrait must render unchanged",
    );
  }
});

test("stock photography hosts and 404 markers never render as a doctor's portrait", () => {
  const rejected = [
    "https://images.unsplash.com/photo-1559839734-2b71ea197ec2",
    "https://unsplash.com/photos/abc",
    "https://images.pexels.com/photos/123/stock.jpg",
    "https://cdn.pixabay.com/photo/doctor.jpg",
    "https://www.shutterstock.com/image-photo/doctor-456",
    "https://www.istockphoto.com/photo/doctor-gm123",
    "https://www.gettyimages.com/detail/photo/doctor-portrait",
    "https://www.freepik.com/free-photo/physician_123.htm",
    "https://placehold.co/400x400.png",
    "https://picsum.photos/200/300",
    "https://example.com/404.jpg",
    "https://cdn.example.org/photo-404-doctor.jpeg",
  ];
  for (const photoUrl of rejected) {
    assert.equal(
      getDoctorPhoto({ photoUrl }),
      null,
      `a stock or broken URL must never publish as a clinician's face: ${photoUrl}`,
    );
  }
});

test("doctors without a portrait resolve to null so UI renders the initials avatar", () => {
  const edgeCases = [
    undefined,
    null,
    {},
    { photoUrl: "" },
    { photoUrl: "   " },
    { photoUrl: null },
    { photoUrl: undefined },
  ];
  for (const doctor of edgeCases) {
    assert.equal(
      getDoctorPhoto(doctor),
      null,
      `missing portrait must be null so the initials avatar renders: ${JSON.stringify(doctor)}`,
    );
  }
});

test("resolution is deterministic: the same catalog row always yields the same result", () => {
  const doctor = { photoUrl: "/media/doctors/doctor-7.jpg" };
  const first = getDoctorPhoto(doctor);
  for (let i = 0; i < 50; i += 1) {
    assert.equal(getDoctorPhoto(doctor), first);
  }
});

test("getDoctorInitials operates correctly for initials generation", () => {
  assert.equal(getDoctorInitials("Đỗ Quang Huy"), "ĐH");
  assert.equal(getDoctorInitials("BS.CKI Phan Quốc Mai"), "PM");
  assert.equal(getDoctorInitials("TS.BS. Nguyễn Minh Khôi"), "NK");
  assert.equal(getDoctorInitials("BS"), "BS");
  assert.equal(getDoctorInitials(""), "BS");
  assert.equal(getDoctorInitials(undefined), "BS");
});
