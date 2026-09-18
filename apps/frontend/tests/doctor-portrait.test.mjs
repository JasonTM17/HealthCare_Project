import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import {
  CORE_DOCTOR_PORTRAITS,
  CURATED_DOCTOR_PORTRAITS,
  getDoctorInitials,
  getDoctorPhoto,
} from "../lib/doctor-portrait.ts";

const root = new URL("../", import.meta.url);

test("doctor portrait source adheres to non-null and unblocked catalog rules", async () => {
  const source = await readFile(new URL("lib/doctor-portrait.ts", root), "utf8");

  // Verify blocking regex is absent
  assert.doesNotMatch(
    source,
    /!\/\^\\\/media\\\/doctors\\\/doctor-\\d\+\\\.jpg\$\/i\.test/,
    "doctor-portrait.ts must NOT contain the regex blocking local doctor portraits"
  );

  // Verify getDoctorPhoto return type annotation guarantees string
  assert.match(
    source,
    /export function getDoctorPhoto\([^)]*\):\s*string/,
    "getDoctorPhoto must return a non-null string"
  );
});

test("all 11 curated clinical portrait assets exist on disk with valid file size", async () => {
  assert.equal(CURATED_DOCTOR_PORTRAITS.length, 11);

  for (const relativePath of CURATED_DOCTOR_PORTRAITS) {
    const fileUrl = new URL(`public${relativePath}`, root);
    const info = await stat(fileUrl);
    assert.ok(info.isFile(), `${relativePath} must be a valid file`);
    assert.ok(
      info.size > 200_000,
      `${relativePath} should be a real high-resolution photograph (>200KB), got ${info.size} bytes`
    );
  }
});

test("canonical clinical leaders and specialists resolve to their dedicated portraits", () => {
  const cases = [
    { slug: "nguyen-minh-khoi", expected: "/media/doctors/doctor-1.jpg" },
    { slug: "vo-thi-mai", expected: "/media/doctors/doctor-2.jpg" },
    { slug: "le-van-duc", expected: "/media/doctors/doctor-3.jpg" },
    { slug: "pham-hoang-yen", expected: "/media/doctors/doctor-4.jpg" },
    { slug: "tran-thu-ha", expected: "/media/doctors/doctor-5.jpg" },
    { slug: "do-quang-huy", expected: "/media/doctors/doctor-6.jpg" },
    { slug: "le-thu-trang", expected: "/media/doctors/doctor-7.jpg" },
    { slug: "tsbs-le-thu-trang", expected: "/media/doctors/doctor-7.jpg" },
    { slug: "phan-quoc-viet", expected: "/media/doctors/doctor-8.jpg" },
    { slug: "bs-phan-quoc-viet", expected: "/media/doctors/doctor-8.jpg" },
    { slug: "dang-my-linh", expected: "/media/doctors/doctor-9.jpg" },
    { slug: "thsbs-dang-my-linh", expected: "/media/doctors/doctor-9.jpg" },
    { slug: "trinh-anh-dung", expected: "/media/doctors/doctor-10.jpg" },
    { slug: "bs-trinh-anh-dung", expected: "/media/doctors/doctor-10.jpg" },
    { slug: "hoang-gia-huy", expected: "/media/doctors/doctor-11.jpg" },
    { slug: "bs-hoang-gia-huy", expected: "/media/doctors/doctor-11.jpg" },
  ];

  for (const { slug, expected } of cases) {
    assert.equal(getDoctorPhoto({ slug }), expected);
    assert.equal(CORE_DOCTOR_PORTRAITS[slug], expected);
  }
});

test("full name matching strips clinical titles and handles accents/ASCII", () => {
  const nameCases = [
    { fullName: "TS.BS. Lê Thu Trang", expected: "/media/doctors/doctor-7.jpg" },
    { fullName: "BS. Phan Quốc Việt", expected: "/media/doctors/doctor-8.jpg" },
    { fullName: "ThS.BS. Đặng Mỹ Linh", expected: "/media/doctors/doctor-9.jpg" },
    { fullName: "BS.CKI Lê Văn Đức", expected: "/media/doctors/doctor-3.jpg" },
    { fullName: "PGS.TS.BS. Đỗ Quang Huy", expected: "/media/doctors/doctor-6.jpg" },
    { fullName: "Vo Thi Mai", expected: "/media/doctors/doctor-2.jpg" },
    { fullName: "Nguyen Minh Khoi", expected: "/media/doctors/doctor-1.jpg" },
  ];

  for (const { fullName, expected } of nameCases) {
    const photo = getDoctorPhoto({ fullName });
    assert.equal(photo, expected);
  }
});

test("rejection of generic stock photo hosts into deterministic clinical portraits", () => {
  const stockUrls = [
    "https://images.unsplash.com/photo-1559839734-2b71ea197ec2",
    "https://unsplash.com/photos/abc",
    "https://images.pexels.com/photos/123/stock.jpg",
    "https://cdn.pixabay.com/photo/doctor.jpg",
    "https://www.shutterstock.com/image-photo/doctor-456",
  ];

  for (const stockUrl of stockUrls) {
    const photo = getDoctorPhoto({
      id: "test-doctor-1",
      fullName: "BS. Nguyễn Văn A",
      photoUrl: stockUrl,
    });
    assert.ok(!photo.includes("unsplash.com"), "Must reject Unsplash URLs");
    assert.ok(!photo.includes("pexels.com"), "Must reject Pexels URLs");
    assert.match(
      photo,
      /^\/media\/doctors\/doctor-\d+\.jpg$/,
      "Must fallback to local curated doctor portrait"
    );
  }
});

test("valid catalog local portrait paths are accepted", () => {
  const validPath = "/media/doctors/doctor-5.jpg";
  const result = getDoctorPhoto({
    id: "doctor-custom-1",
    fullName: "Bác sĩ B",
    photoUrl: validPath,
  });
  assert.equal(result, validPath);
});

test("100% non-null contract: null, undefined, empty, and synthetic doctors always return valid portrait", () => {
  const edgeCases = [
    undefined,
    null,
    {},
    { fullName: "" },
    { id: "" },
    { id: "demo-bs-1" },
    { id: "demo-bs-2", fullName: "Bác sĩ Chưa Đặt Tên" },
    { slug: "unknown-doctor-slug" },
    { photoUrl: "https://example.com/404.jpg" },
  ];

  for (const doc of edgeCases) {
    const photo = getDoctorPhoto(doc);
    assert.ok(typeof photo === "string", "Photo must be a string");
    assert.ok(photo.length > 0, "Photo must not be empty");
    assert.match(
      photo,
      /^\/media\/doctors\/doctor-\d+\.jpg$/,
      `Doctor ${JSON.stringify(doc)} must resolve to a valid curated portrait`
    );
  }
});

test("deterministic hashing: same doctor identity always resolves to the exact same portrait", () => {
  const doc = { id: "550e8400-e29b-41d4-a716-446655440000", fullName: "BS. Trần Văn Nam" };
  const initial = getDoctorPhoto(doc);

  for (let i = 0; i < 50; i += 1) {
    assert.equal(
      getDoctorPhoto(doc),
      initial,
      "Subsequent resolutions must be strictly identical"
    );
  }
});

test("doctor population distribution uses full curated portrait pool without single-asset collapse", () => {
  const usedPortraits = new Set();

  for (let i = 1; i <= 60; i += 1) {
    const photo = getDoctorPhoto({
      id: `demo-bs-${i}`,
      fullName: `Bác sĩ Khám Bệnh ${i}`,
    });
    usedPortraits.add(photo);
  }

  // Ensure all 11 curated portraits are distributed across 60 simulated demo doctors
  assert.equal(
    usedPortraits.size,
    11,
    `All 11 curated portraits should be utilized across demo doctors, got ${usedPortraits.size}`
  );
});

test("getDoctorInitials operates correctly for initials generation", () => {
  assert.equal(getDoctorInitials("Đỗ Quang Huy"), "ĐH");
  assert.equal(getDoctorInitials("BS.CKI Phan Quốc Mai"), "PM");
  assert.equal(getDoctorInitials("TS.BS. Nguyễn Minh Khôi"), "NK");
  assert.equal(getDoctorInitials("BS"), "BS");
  assert.equal(getDoctorInitials(""), "BS");
  assert.equal(getDoctorInitials(undefined), "BS");
});
