import fs from 'fs';

const content = fs.readFileSync('apps/backend/src/main/resources/db/migration/V82__reconcile_doctor_specialties_and_clean_data.sql', 'utf8');

// 1. Search for any occurrence of 'Phần' or 'Phan ' (case-insensitive)
const phanXRegex = /[\(\s]ph[ầa]n[\s\d_]/i;
const matches = [];
const lines = content.split('\n');
lines.forEach((line, idx) => {
  // exclude line 3 comment which says "eliminate 'Phan X' clones"
  if (idx > 4 && phanXRegex.test(line)) {
    matches.push({ lineNum: idx + 1, line: line.trim() });
  }
});
console.log('=== CHECK PHẦN X OCCURRENCES (EXCLUDING HEADER COMMENT) ===');
console.log('Matches count:', matches.length);
if (matches.length > 0) {
  console.log('Matches:', matches.slice(0, 10));
}

// 2. Exact match for "(Phần " or "Phần "
const strictMatches = [];
lines.forEach((line, idx) => {
  if (idx > 4 && (line.includes('Phần ') || line.includes('(Phần '))) {
    strictMatches.push({ lineNum: idx + 1, line: line.trim() });
  }
});
console.log('Strict "Phần " or "(Phần " count:', strictMatches.length);

// 3. Count UPDATE articles
const updateMatches = content.match(/UPDATE\s+articles/gi) || [];
console.log('\n=== COUNT UPDATE ARTICLES ===');
console.log('UPDATE articles count:', updateMatches.length);

// 4. Parse each UPDATE statement
const updateBlocks = content.split(/UPDATE\s+articles/i).slice(1);
console.log('Total split blocks:', updateBlocks.length);

const categories = {};
const ids = new Set();
const duplicateIds = [];
let hasMissingFields = 0;
const titles = [];

updateBlocks.forEach((block, idx) => {
  const titleMatch = block.match(/title\s*=\s*'([^']+)'/i);
  const slugMatch = block.match(/slug\s*=\s*'([^']+)'/i);
  const summaryMatch = block.match(/summary\s*=\s*'([^']+)'/i);
  const coverMatch = block.match(/cover_image_url\s*=\s*'([^']+)'/i);
  const catMatch = block.match(/category\s*=\s*'([^']+)'/i);
  const idMatch = block.match(/WHERE\s+id\s*=\s*'([^']+)'/i);

  if (!titleMatch || !slugMatch || !summaryMatch || !coverMatch || !catMatch || !idMatch) {
    hasMissingFields++;
    console.log('Block with missing field at index', idx, block.slice(0, 100));
    return;
  }

  const cat = catMatch[1];
  categories[cat] = (categories[cat] || 0) + 1;

  const id = idMatch[1];
  if (ids.has(id)) {
    duplicateIds.push(id);
  }
  ids.add(id);

  titles.push(titleMatch[1]);
});

console.log('\n=== SPECIALTY CATEGORY DISTRIBUTION ===');
console.log('Number of unique categories:', Object.keys(categories).length);
console.log('Categories breakdown:');
for (const [cat, count] of Object.entries(categories).sort((a,b) => b[1] - a[1])) {
  console.log('  - ' + cat + ': ' + count);
}

console.log('\n=== ID & FIELD INTEGRITY ===');
console.log('Unique IDs:', ids.size);
console.log('Duplicate IDs count:', duplicateIds.length);
console.log('Missing fields count:', hasMissingFields);
console.log('Total titles parsed:', titles.length);

// 5. Check doctors statements in V82
console.log('\n=== DOCTORS STATEMENTS IN V82 ===');
const hasDeleteDS = content.includes('DELETE FROM doctor_specialties;');
const hasInsertCanonical = content.includes('nguyen-minh-khoi') && content.includes('vo-thi-mai');
const hasBioJoin = content.includes("JOIN specialties s ON d.bio ILIKE '%trong lĩnh vực ' || s.name || '.%'");
const hasUnsplashPurge = content.includes("UPDATE doctors SET photo_url = NULL WHERE photo_url LIKE '%unsplash%';");

console.log('DELETE FROM doctor_specialties:', hasDeleteDS);
console.log('Canonical doctors inserted:', hasInsertCanonical);
console.log('Bio join dynamic reconciliation:', hasBioJoin);
console.log('Unsplash photo purge statement:', hasUnsplashPurge);
