/**
 * public/images 폴더와 data/item-meta.json 을 읽어 public/data/gameData.json 을 만든다.
 *
 *   node scripts/generateImageData.js          # 검사 후 gameData.json 생성 (dev/build 때 자동 실행)
 *   node scripts/generateImageData.js --check  # 검사만 (파일 생성 안 함)
 *
 * 오류가 있으면 종료 코드 1로 끝나서 빌드/CI가 실패한다. 경고는 표시만 한다.
 * 이미지 추가 방법은 README.md의 "아이템 추가하기"를 참고.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public', 'images');
const META_PATH = path.join(ROOT, 'data', 'item-meta.json');
const UPDATES_PATH = path.join(ROOT, 'data', 'updates.json');
const OUTPUT_PATH = path.join(ROOT, 'public', 'data', 'gameData.json');
const THUMBS_DIR = path.join(ROOT, 'public', 'thumbs'); // 선택 창용 작은 이미지 (빌드 때 생성, 커밋 안 함)
const THUMB_SIZE = 160;

// 카테고리 → 폴더
const CATEGORY_FOLDERS = {
  cookies: 'cookies',
  pets: 'pets',
  treasures: 'treasures',
  dishes: 'dishes',
  ingredients: 'ingredients',
  magicCandies: 'magic_candies',
  blessings: 'blessings',
};
const RARITIES = ['legendary', 'epic', 'rare', 'common'];
const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
const IGNORED_FILES = new Set(['README.md', '.DS_Store', 'Thumbs.db', 'desktop.ini']);
const MAX_SIZE = 1024 * 1024;

const errors = [];
const warnings = [];
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function loadMeta() {
  const empty = { pinned: [], added: {}, aliases: {}, descriptions: {}, hidden: [], renamed: {} };
  if (!fs.existsSync(META_PATH)) return empty;
  try {
    return { ...empty, ...JSON.parse(fs.readFileSync(META_PATH, 'utf8')) };
  } catch (e) {
    errors.push(`${rel(META_PATH)}: JSON 형식이 잘못됐습니다 (쉼표·따옴표 확인) — ${e.message}`);
    return empty;
  }
}

function scanImages(dir, category, rarity) {
  const items = [];
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) continue; // 하위 폴더는 scanCategory에서 처리
    if (IGNORED_FILES.has(file)) continue;
    if (!IMAGE_RE.test(file)) {
      errors.push(`${rel(full)}: 지원하지 않는 파일 형식입니다 (png, jpg, webp만 가능)`);
      continue;
    }
    const rawName = file.replace(IMAGE_RE, '');
    const name = rawName.normalize('NFC');
    if (name !== rawName) warnings.push(`${rel(full)}: 파일명이 macOS 방식(NFD)으로 저장돼 있습니다. 동작은 하지만 이름을 다시 입력해 저장하는 것을 권장합니다`);
    if (name !== name.trim() || /\s{2,}/.test(name)) warnings.push(`${rel(full)}: 파일명 앞뒤 공백이나 연속 공백이 있습니다`);
    if (stat.size > MAX_SIZE) warnings.push(`${rel(full)}: 파일이 ${(stat.size / 1024 / 1024).toFixed(1)}MB로 큽니다 (1MB 이하 권장)`);

    const folder = CATEGORY_FOLDERS[category];
    items.push({
      id: `${category}:${rarity ? `${rarity}/` : ''}${name}`,
      name,
      image: rarity ? `/images/${folder}/${rarity}/${file}` : `/images/${folder}/${file}`,
      ...(rarity && { rarity }),
    });
  }
  return items;
}

function scanCategory(category) {
  const dir = path.join(IMAGES_DIR, CATEGORY_FOLDERS[category]);
  if (!fs.existsSync(dir)) {
    errors.push(`${rel(dir)}: 폴더가 없습니다`);
    return [];
  }
  const subdirs = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory());
  if (subdirs.length === 0) return scanImages(dir, category);

  const items = [];
  for (const sub of subdirs) {
    if (!RARITIES.includes(sub)) {
      errors.push(`${rel(path.join(dir, sub))}: 알 수 없는 등급 폴더입니다 (${RARITIES.join(', ')} 중 하나)`);
      continue;
    }
    items.push(...scanImages(path.join(dir, sub), category, sub));
  }
  const loose = fs.readdirSync(dir).filter((f) => IMAGE_RE.test(f));
  for (const f of loose) errors.push(`${rel(path.join(dir, f))}: 등급 폴더(${RARITIES.join('/')}) 안에 넣어야 합니다`);
  return items;
}

function build() {
  const meta = loadMeta();
  const data = {};
  for (const category of Object.keys(CATEGORY_FOLDERS)) data[category] = scanCategory(category);

  const allNames = new Set(Object.values(data).flat().map((i) => i.name));
  const checkNames = (names, field) => {
    for (const n of names) if (!allNames.has(n)) warnings.push(`data/item-meta.json "${field}": "${n}" 이름의 이미지가 없습니다 (오타 확인)`);
  };

  // 메타데이터 적용
  const addedAt = {};
  for (const [date, names] of Object.entries(meta.added)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`data/item-meta.json "added": "${date}" 날짜는 YYYY-MM-DD 형식이어야 합니다`);
    checkNames(names, 'added');
    for (const n of names) addedAt[n] = date;
  }
  checkNames(meta.pinned, 'pinned');
  checkNames(meta.hidden, 'hidden');
  checkNames(Object.keys(meta.aliases), 'aliases');
  checkNames(Object.keys(meta.descriptions), 'descriptions');
  for (const [from, to] of Object.entries(meta.renamed)) {
    if (!allNames.has(to)) errors.push(`data/item-meta.json "renamed": "${from}" → "${to}" 에서 바뀐 이름의 이미지가 없습니다`);
  }

  for (const category of Object.keys(data)) {
    data[category] = data[category]
      .filter((item) => !meta.hidden.includes(item.name))
      .map((item) => {
        return {
          ...item,
          ...(meta.pinned.includes(item.name) && { pinned: true }),
          ...(addedAt[item.name] && { addedAt: addedAt[item.name] }),
          ...(meta.descriptions[item.name] && { description: meta.descriptions[item.name] }),
          ...(meta.aliases[item.name] && { aliases: meta.aliases[item.name] }),
        };
      })
      .sort(
        (a, b) =>
          (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
          RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) ||
          a.name.localeCompare(b.name, 'ko')
      );
  }

  // 쿠키를 추가하면 보통 마법사탕·펫도 같은 이름으로 함께 추가한다
  const names = (c) => new Set(data[c].map((i) => i.name));
  const candies = names('magicCandies');
  const pets = names('pets');
  for (const cookie of data.cookies) {
    if (cookie.pinned) continue;
    const missing = [!candies.has(cookie.name) && '마법사탕', !pets.has(cookie.name) && '펫'].filter(Boolean);
    if (missing.length) warnings.push(`쿠키 "${cookie.name}": 같은 이름의 ${missing.join('·')} 이미지가 없습니다 (없는 게 맞다면 무시)`);
  }

  data.renamed = meta.renamed;
  return data;
}

/** data/updates.json: [{ date: 'YYYY-MM-DD', title, items: [...] }] 최신순 */
function checkUpdates() {
  let notes;
  try {
    notes = JSON.parse(fs.readFileSync(UPDATES_PATH, 'utf8'));
  } catch (e) {
    return errors.push(`data/updates.json: JSON 형식이 잘못됐습니다 — ${e.message}`);
  }
  if (!Array.isArray(notes)) return errors.push('data/updates.json: 배열([ ... ])이어야 합니다');
  notes.forEach((n, i) => {
    const where = `data/updates.json ${i + 1}번째 항목`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n?.date)) errors.push(`${where}: date는 YYYY-MM-DD 형식이어야 합니다`);
    if (typeof n?.title !== 'string' || !n.title) errors.push(`${where}: title이 없습니다`);
    if (!Array.isArray(n?.items) || n.items.some((t) => typeof t !== 'string')) errors.push(`${where}: items는 글자 목록이어야 합니다`);
    if (i > 0 && n?.date > notes[i - 1]?.date) errors.push(`${where}: 최신 항목이 맨 위에 오도록 날짜순으로 정렬해 주세요`);
  });
}

/** 선택 창에 쓸 작은 webp 이미지를 만든다. 원본보다 새로우면 건너뛴다. */
async function makeThumbnails(data) {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    warnings.push('sharp가 없어 선택 창용 작은 이미지를 만들지 못했습니다 (원본 이미지로 표시)');
    return;
  }
  const items = Object.entries(data)
    .filter(([k]) => k !== 'renamed')
    .flatMap(([, list]) => list);
  let made = 0;
  for (let i = 0; i < items.length; i += 16) {
    await Promise.all(
      items.slice(i, i + 16).map(async (item) => {
        const src = path.join(ROOT, 'public', item.image);
        const thumb = `/thumbs${item.image.replace(/^\/images/, '').replace(IMAGE_RE, '.webp')}`;
        const dest = path.join(ROOT, 'public', thumb);
        try {
          if (!fs.existsSync(dest) || fs.statSync(dest).mtimeMs < fs.statSync(src).mtimeMs) {
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            await sharp(src).resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(dest);
            made++;
          }
          item.thumb = thumb;
        } catch (e) {
          warnings.push(`${item.image}: 작은 이미지 생성 실패 (${e.message})`);
        }
      })
    );
  }
  if (made) console.log(`[작은 이미지] ${made}개 생성`);
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const data = build();
  if (!checkOnly && errors.length === 0) await makeThumbnails(data);
  checkUpdates();

  const counts = Object.entries(data)
    .filter(([k]) => k !== 'renamed')
    .map(([k, v]) => `${k} ${v.length}`)
    .join(', ');
  console.log(`[아이템] ${counts}`);
  if (warnings.length) {
    console.log(`\n[경고 ${warnings.length}건] 사이트는 동작하지만 확인해 주세요`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  if (errors.length) {
    console.error(`\n[오류 ${errors.length}건] 고친 뒤 다시 실행하세요`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  if (!checkOnly) {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data));
    console.log(`\n✓ ${rel(OUTPUT_PATH)} 생성 완료`);
  } else {
    console.log('\n✓ 검사 통과');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
