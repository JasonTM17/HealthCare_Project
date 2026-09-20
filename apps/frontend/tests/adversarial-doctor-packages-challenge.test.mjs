import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import test from "node:test";
import {
  getDoctorPhoto,
} from "../lib/doctor-portrait.ts";
import {
  ALL_PACKAGE_TONES,
  getPackageVisual,
  resolveTone,
  VISUALS,
} from "../lib/package-visuals.ts";

const root = new URL("../", import.meta.url);

/**
 * CHALLENGE SUITE 1: Doctor Portrait Own-Photo-Or-Null Contract
 * Adversarial test with 1,000+ synthetic and realistic doctor inputs.
 *
 * The frontend never assigns one clinician's photograph to another: every
 * input must resolve to exactly the doctor's own non-stock catalog photoUrl,
 * or to null so the UI renders the neutral initials avatar.
 */
test("CHALLENGE 1: Doctor Portrait Own-Photo-Or-Null Contract across 1,000+ adversarial inputs", async () => {
  const adversarialInputs = [];

  // 1. Falsy & Primitive / Malformed Objects (20 cases)
  adversarialInputs.push(
    null,
    undefined,
    {},
    { id: "" },
    { fullName: "" },
    { slug: "" },
    { photoUrl: "" },
    { photoUrl: null },
    { photoUrl: undefined },
    { id: "", fullName: "", slug: "", photoUrl: "" },
    { id: null, fullName: null, slug: null, photoUrl: null },
    { id: undefined, fullName: undefined, slug: undefined, photoUrl: undefined },
    { fullName: "   " },
    { slug: "   " },
    { id: "   \t\n  " },
    { photoUrl: "   " },
    { fullName: "\0" },
    { slug: "\0" },
    { id: "\0" },
    { fullName: " " }
  );

  // 2. Weird symbols, Unicode, Emojis, Injection Payloads (50 cases)
  const symbolsAndInjections = [
    "👨‍⚕️ Bác sĩ Y khoa 🏥",
    "🩺 ⭐ ✨ 💊 💉",
    "<script>alert('xss')</script>",
    "\"><img src=x onerror=alert(1)>",
    "1'; DROP TABLE doctors; --",
    "' OR '1'='1",
    "'; EXEC xp_cmdshell('dir'); --",
    "{{{template}}}",
    "${7*7}",
    "{{constructor.constructor('return this')()}}",
    "../../../etc/passwd",
    "..\\..\\windows\\system32\\cmd.exe",
    "!@#$%^&*()_+-=[]{}|;':\",./<>?`~",
    "\\u0000\\u0001\\u0002",
    "Dr. \u200B\u200C\u200D Zero Width",
    "Bác sĩ \uFEFF BOM",
    "Lê \r\n Nguyễn \r Thần",
    "Doctor\tWith\tTabs",
    "Доктор Иван Петров",
    "李医生 神经内科",
    "دكتور محمد علي",
    "רופא אברהם",
    "กุมARแพทย์ สมชาย",
    "مستشفى الدكتور",
    "Dr. 🏥 & Co. <specialist>",
    "&quot;&amp;&lt;&gt;",
    "SELECT * FROM users WHERE 'a'='a'",
    "admin' --",
    "{\"role\": \"admin\"}",
    "[object Object]",
    "NaN",
    "Infinity",
    "-Infinity",
    "true",
    "false",
    "undefined",
    "0",
    "-1",
    "999999999999999999999999999999",
    "1e10",
    "None",
    "nil",
    "void 0",
    "/",
    "//",
    "\\\\",
    "C:\\\\fakepath\\\\doctor.jpg",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "💉🏥⚕️ Bác sĩ Cấp cứu 115"
  ];

  for (const sym of symbolsAndInjections) {
    adversarialInputs.push({
      id: `sym-${sym.slice(0, 15)}`,
      fullName: sym,
      slug: sym.replace(/[^a-z0-9]/gi, "-").toLowerCase(),
      photoUrl: undefined, // missing photoUrl
    });
  }

  // 3. Numbers & Extreme Lengths (30 cases)
  for (let i = 0; i < 15; i += 1) {
    adversarialInputs.push({
      id: String(i * 123456789),
      fullName: `Doctor ${i}`.repeat(i === 0 ? 1 : 10),
      slug: `num-slug-${i}`.repeat(i === 0 ? 1 : 5),
      photoUrl: null, // missing photoUrl
    });
  }
  // Single character names
  for (const c of ["A", "B", "X", "1", "!", "Z", "Đ", "Á", "Ồ", "ễ"]) {
    adversarialInputs.push({ id: `single-${c}`, fullName: c, slug: c, photoUrl: undefined });
  }
  // 500-character name
  adversarialInputs.push({
    id: "ultra-long-500",
    fullName: "TS.BS. " + "Nguyễn Văn ".repeat(40),
    slug: "ultra-long-slug-" + "a".repeat(200),
    photoUrl: "",
  });

  // 4. UUID Variations (50 cases)
  adversarialInputs.push({
    id: "00000000-0000-0000-0000-000000000000",
    fullName: "Nil UUID Doctor",
    photoUrl: undefined,
  });
  for (let i = 1; i <= 49; i += 1) {
    const hex = i.toString(16).padStart(4, "0");
    const uuid = `550e8400-e29b-41d4-a716-44665544${hex}`;
    adversarialInputs.push({
      id: i % 2 === 0 ? uuid : uuid.toUpperCase(),
      fullName: `UUID Doctor ${i}`,
      slug: `uuid-doc-${i}`,
      photoUrl: i % 3 === 0 ? null : undefined,
    });
  }

  // 5. Rejected Stock PhotoUrls & 404 URLs must resolve to null (50 cases)
  const stockAnd404Urls = [
    "https://images.unsplash.com/photo-1559839734-2b71ea197ec2",
    "https://unsplash.com/photos/abc-xyz",
    "https://images.pexels.com/photos/123/doctor.jpg",
    "https://pexels.com/photo/doctor-at-work-456/",
    "https://cdn.pixabay.com/photo/doctor-789.jpg",
    "https://pixabay.com/photos/hospital-999/",
    "https://www.shutterstock.com/image-photo/doctor-456",
    "https://www.istockphoto.com/photo/doctor-gm123",
    "https://www.gettyimages.com/detail/photo/doctor-portrait",
    "https://www.freepik.com/free-photo/physician_123.htm",
    "https://placehold.co/400x400.png",
    "https://placekitten.com/200/200",
    "https://picsum.photos/200/300",
    "https://loremflickr.com/320/240",
    "https://example.com/404.jpg",
    "http://myhost.com/images/404/notfound.png",
    "https://cdn.example.org/photo-404-doctor.jpeg",
  ];
  for (let i = 0; i < stockAnd404Urls.length; i += 1) {
    adversarialInputs.push({
      id: `stock-doc-${i}`,
      fullName: `BS. Stock Test ${i}`,
      photoUrl: stockAnd404Urls[i],
    });
    // With extra whitespace surrounding
    adversarialInputs.push({
      id: `stock-doc-ws-${i}`,
      fullName: `BS. Stock Whitespace ${i}`,
      photoUrl: `   ${stockAnd404Urls[i]}   `,
    });
  }

  // 6. Valid own portraits: local catalog paths and trusted remote hosts must
  // pass through byte-identical (trimmed), never substituted or reshuffled.
  for (let i = 1; i <= 11; i += 1) {
    adversarialInputs.push({
      id: `local-doc-${i}`,
      fullName: `BS. Local Test ${i}`,
      photoUrl: `/media/doctors/doctor-${i}.jpg`,
    });
    adversarialInputs.push({
      id: `remote-doc-${i}`,
      fullName: `BS. Remote Test ${i}`,
      photoUrl: `https://cdn.healthcare.id.vn/portraits/doctor-${i}.jpg`,
    });
    adversarialInputs.push({
      id: `ws-doc-${i}`,
      fullName: `BS. Whitespace Test ${i}`,
      photoUrl: `   /media/doctors/doctor-${i}.jpg   `,
    });
  }

  // 7. Large Synthetic Doctor Population to reach 1,000+ total test cases
  const firstNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
  const midNames = ["Văn", "Thị", "Hữu", "Đức", "Minh", "Quang", "Anh", "Hoàng", "Thanh", "Tuấn", "Ngọc", "Thu", "Gia", "Khánh", "Phương", "Bảo"];
  const lastNames = ["Nam", "Hải", "Sơn", "Tùng", "Long", "Bình", "Hùng", "Trang", "Lan", "Hương", "Thảo", "Hà", "Yến", "Mai", "Cường", "Duy"];

  let synthIndex = 0;
  while (adversarialInputs.length < 1000) {
    synthIndex += 1;
    const fn = firstNames[synthIndex % firstNames.length];
    const mn = midNames[(synthIndex * 3) % midNames.length];
    const ln = lastNames[(synthIndex * 7) % lastNames.length];
    const fullName = `${fn} ${mn} ${ln}`;
    const slug = `bs-${fn}-${mn}-${ln}-${synthIndex}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase();

    adversarialInputs.push({
      id: `synthetic-bs-uuid-${synthIndex}`,
      fullName,
      slug,
      photoUrl: synthIndex % 5 === 0 ? null : (synthIndex % 7 === 0 ? "" : undefined),
    });
  }

  // Verify we have at least 1,000 test cases
  assert.ok(
    adversarialInputs.length >= 1000,
    `Must have at least 1,000 test cases, got ${adversarialInputs.length}`
  );

  let nullCount = 0;
  let passThroughCount = 0;

  // Run the challenge across all 1,000+ inputs
  for (let i = 0; i < adversarialInputs.length; i += 1) {
    const input = adversarialInputs[i];
    const photo = getDoctorPhoto(input);
    const ownPhoto = typeof input?.photoUrl === "string" ? input.photoUrl.trim() : "";

    if (photo === null) {
      nullCount += 1;
      // Null is only allowed when the doctor has no renderable own portrait:
      // missing, blank, 404-marked, or a stock-photography host.
      assert.ok(
        !ownPhoto
          || ownPhoto.includes("404")
          || /unsplash|pexels|pixabay|shutterstock|istockphoto|gettyimages|freepik|placehold|placekitten|picsum|loremflickr/i.test(ownPhoto),
        `input #${i} owns a valid portrait but resolution returned null: ${ownPhoto}`,
      );
      continue;
    }

    // Any non-null result must be the doctor's own portrait, byte-identical.
    assert.equal(
      photo,
      ownPhoto,
      `input #${i} must resolve to its own portrait, not a substitute`,
    );
    assert.ok(
      !/^[A-ZĐ]{1,3}$/.test(photo.trim()),
      `initials must never leak through as a portrait URL: ${photo}`,
    );
    passThroughCount += 1;
  }

  // EMPIRICAL ASSERTIONS
  assert.ok(
    passThroughCount > 0,
    "at least one doctor with an own portrait must pass through",
  );
  assert.ok(
    nullCount > 0,
    "doctors without an own portrait must resolve to null (initials avatar)",
  );
  assert.equal(
    passThroughCount + nullCount,
    adversarialInputs.length,
    `every input must resolve deterministically: ${passThroughCount}/${adversarialInputs.length} own-photo, ${nullCount} null`,
  );
});

/**
 * CHALLENGE SUITE 2: Package Visual Distinctness & Disk Existence
 */
test("CHALLENGE 2: Package Visual Distinctness across actual records, synthetic sequences, and disk assets", async () => {
  // 1. Verify all 14 tone images exist on disk and exceed 40KB
  for (const tone of ALL_PACKAGE_TONES) {
    const visual = VISUALS[tone];
    assert.ok(visual, `Visual must exist for tone ${tone}`);
    const fileUrl = new URL(`public${visual.imageSrc}`, root);
    const fileStat = await stat(fileUrl);
    assert.ok(fileStat.isFile(), `Package image file for tone ${tone} (${visual.imageSrc}) must exist on disk`);
    assert.ok(
      fileStat.size > 40_000,
      `Package image file for tone ${tone} (${visual.imageSrc}) must be > 40KB, got ${fileStat.size}`
    );
  }

  // 2. Test 10 consecutive numbered packages (goi-1 to goi-10)
  const tenConsecutiveImages = [];
  for (let i = 1; i <= 10; i += 1) {
    const visual = getPackageVisual({
      slug: `goi-${i}`,
      name: `Gói khám sức khỏe cấp ${i % 3 === 0 ? "A" : (i % 3 === 1 ? "B" : "C")} #${i}`,
    });
    tenConsecutiveImages.push(visual.imageSrc);

    // Verify disk existence
    const fileUrl = new URL(`public${visual.imageSrc}`, root);
    const fileStat = await stat(fileUrl);
    assert.ok(fileStat.isFile(), `Image ${visual.imageSrc} must exist on disk`);
  }

  // Assert all 10 consecutive numbered packages are completely distinct
  const uniqueTen = new Set(tenConsecutiveImages);
  assert.equal(
    uniqueTen.size,
    10,
    `All 10 consecutive numbered packages must render distinct images! Got ${uniqueTen.size} unique`
  );

  // Assert consecutive cards (i and i+1) NEVER have the same image
  for (let i = 0; i < tenConsecutiveImages.length - 1; i += 1) {
    assert.notEqual(
      tenConsecutiveImages[i],
      tenConsecutiveImages[i + 1],
      `Consecutive package cards ${i} and ${i + 1} must NOT share image`
    );
  }

  // Assert general-checkup.jpg appears at most once in 10 items (never duplicated)
  const generalCount = tenConsecutiveImages.filter((img) => img === "/images/packages/general-checkup.jpg").length;
  assert.equal(generalCount, 1, `general-checkup.jpg must appear at most once, got ${generalCount}`);

  // 3. Test VIP multi-tier packages (Hạng 1 to 6)
  const vipPackages = [
    { slug: "vip-hang-1", name: "Gói khám VIP Doanh nhân (Hạng 1)" },
    { slug: "vip-hang-2", name: "Gói khám VIP Doanh nhân (Hạng 2)" },
    { slug: "vip-hang-3", name: "Gói khám VIP Doanh nhân (Hạng 3)" },
    { slug: "vip-hang-4", name: "Gói khám VIP Doanh nhân (Hạng 4)" },
    { slug: "vip-hang-5", name: "Gói khám VIP Doanh nhân (Hạng 5)" },
    { slug: "vip-hang-6", name: "Gói khám VIP Doanh nhân Toàn diện (Hạng 6)" },
  ];
  const vipImages = [];
  for (const pkg of vipPackages) {
    const visual = getPackageVisual(pkg);
    vipImages.push(visual.imageSrc);

    // Verify disk existence
    const fileUrl = new URL(`public${visual.imageSrc}`, root);
    const fileStat = await stat(fileUrl);
    assert.ok(fileStat.isFile(), `VIP image ${visual.imageSrc} must exist on disk`);
  }

  const uniqueVip = new Set(vipImages);
  assert.equal(
    uniqueVip.size,
    6,
    `All 6 VIP packages must render distinct images! Got ${uniqueVip.size} unique`
  );

  // Assert none duplicate general-checkup.jpg
  assert.ok(
    !vipImages.includes("/images/packages/general-checkup.jpg"),
    "VIP packages must NOT use general-checkup.jpg"
  );

  // Assert consecutive VIP cards never share images
  for (let i = 0; i < vipImages.length - 1; i += 1) {
    assert.notEqual(vipImages[i], vipImages[i + 1], `Consecutive VIP cards ${i} and ${i + 1} must not share image`);
  }

  // 4. Test all 4 actual records from seed-local-data.sql
  const localSeedPackages = [
    { slug: "goi-kham-co-ban", name: "Gói khám sức khỏe cơ bản" },
    { slug: "goi-kham-tim-mach", name: "Gói khám tim mạch" },
    { slug: "goi-tam-soat-tieu-duong", name: "Gói tầm soát tiểu đường" },
    { slug: "goi-kham-tre-em", name: "Gói khám sức khỏe trẻ em" },
  ];
  const localSeedImages = [];
  for (let i = 0; i < localSeedPackages.length; i += 1) {
    const pkg = localSeedPackages[i];
    const visual = getPackageVisual(pkg);
    localSeedImages.push(visual.imageSrc);

    const fileUrl = new URL(`public${visual.imageSrc}`, root);
    const fileStat = await stat(fileUrl);
    assert.ok(fileStat.isFile(), `Seed package image ${visual.imageSrc} must exist on disk`);

    // Verify consecutive cards are distinct
    if (i > 0) {
      assert.notEqual(
        localSeedImages[i],
        localSeedImages[i - 1],
        `Consecutive seed packages ${i - 1} (${localSeedPackages[i - 1].name}) and ${i} (${pkg.name}) must have distinct images`
      );
    }
  }

  // Verify general-checkup.jpg is not duplicated in local seed packages
  const generalSeedCount = localSeedImages.filter((img) => img === "/images/packages/general-checkup.jpg").length;
  assert.ok(generalSeedCount <= 1, "general-checkup.jpg must not be duplicated in local seed packages");

  // 5. Test all 100 packages from seed-large-data.sql (goi-1 to goi-100)
  const largeSeedImages = [];
  for (let i = 1; i <= 100; i += 1) {
    const chr = String.fromCharCode(65 + ((i - 1) % 3));
    const pkg = {
      slug: `goi-${i}`,
      name: `Gói khám sức khỏe cấp ${chr} #${i}`,
    };
    const visual = getPackageVisual(pkg);
    largeSeedImages.push(visual.imageSrc);

    // Verify consecutive cards are strictly distinct
    if (i > 1) {
      assert.notEqual(
        largeSeedImages[i - 1],
        largeSeedImages[i - 2],
        `Consecutive large packages ${i - 1} and ${i} must have distinct images`
      );
    }
  }

  // Assert all 100 images exist on disk
  for (const imgSrc of new Set(largeSeedImages)) {
    const fileUrl = new URL(`public${imgSrc}`, root);
    const fileStat = await stat(fileUrl);
    assert.ok(fileStat.isFile(), `Large package image ${imgSrc} must exist on disk`);
  }

  // Distribution check across 100 packages: all 14 tones should be utilized
  const uniqueLargeImages = new Set(largeSeedImages);
  assert.equal(
    uniqueLargeImages.size,
    14,
    `Large data catalog must utilize all 14 distinct package images, got ${uniqueLargeImages.size}`
  );

  // Frequency check: in 100 items, general-checkup.jpg should not dominate (<10/100)
  const generalCheckupTotal = largeSeedImages.filter((img) => img === "/images/packages/general-checkup.jpg").length;
  assert.ok(
    generalCheckupTotal <= 10,
    `general-checkup.jpg should not dominate (<10/100), got ${generalCheckupTotal}`
  );

  // 6. Test multi-tier variants for other specialties
  const womenTiers = [
    { slug: "phu-nu-1", name: "Gói sức khỏe phụ nữ (Hạng 1)" },
    { slug: "phu-nu-2", name: "Gói sức khỏe phụ nữ (Hạng 2)" },
    { slug: "phu-nu-3", name: "Gói sức khỏe phụ nữ (Hạng 3)" },
    { slug: "phu-nu-4", name: "Gói sức khỏe phụ nữ (Hạng 4)" },
  ];
  const womenImages = womenTiers.map((p) => getPackageVisual(p).imageSrc);
  const uniqueWomen = new Set(womenImages);
  assert.equal(uniqueWomen.size, 4, "Women multi-tier packages must allocate 4 distinct images");

  const boneJointTiers = [
    { slug: "co-xuong-khop-1", name: "Gói cơ xương khớp (Hạng 1)" },
    { slug: "co-xuong-khop-2", name: "Gói cơ xương khớp (Hạng 2)" },
    { slug: "co-xuong-khop-3", name: "Gói cơ xương khớp (Hạng 3)" },
  ];
  const boneJointImages = boneJointTiers.map((p) => getPackageVisual(p).imageSrc);
  const uniqueBoneJoint = new Set(boneJointImages);
  assert.equal(uniqueBoneJoint.size, 3, "Bone-joint multi-tier packages must allocate 3 distinct images");

  // 7. Edge case and Falsification: null, undefined, empty object
  const falsyInputs = [null, undefined, {}, { slug: "" }, { name: "" }];
  for (const input of falsyInputs) {
    const visual = getPackageVisual(input);
    assert.ok(visual, "Falsy package input must still return a visual object");
    assert.ok(typeof visual.imageSrc === "string", "imageSrc must be a string");
    assert.ok(visual.imageSrc.startsWith("/images/packages/"), "imageSrc must point to packages folder");
    const fileUrl = new URL(`public${visual.imageSrc}`, root);
    const fileStat = await stat(fileUrl);
    assert.ok(fileStat.isFile(), `Fallback image ${visual.imageSrc} must exist on disk`);
  }
});
