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
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public', 'images');
const META_PATH = path.join(ROOT, 'data', 'item-meta.json');
const UPDATES_PATH = path.join(ROOT, 'data', 'updates.json');
const OUTPUT_PATH = path.join(ROOT, 'public', 'data', 'gameData.json');
const THUMBS_DIR = path.join(ROOT, 'public', 'thumbs'); // 선택 창용 작은 이미지 (빌드 때 생성, 커밋 안 함)
const THUMB_SIZE = 160;
// 한 날짜에 이보다 많이 추가된 건 첫 데이터 등록 같은 일괄 작업으로 보고 업데이트 소식에서 뺀다
const BULK_LIMIT = 40;
const CATEGORY_NAMES = { cookies: '쿠키', pets: '펫', treasures: '보물', dishes: '요리', ingredients: '재료', magicCandies: '마법사탕', blessings: '축복' };

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

/**
 * Git 기록에서 이미지가 처음 추가된 날짜를 찾는다. ('public/images/...' → 'YYYY-MM-DD')
 * 얕은 클론이면 잘린 지점 커밋은 '전부 새로 추가'로 보이므로 제외한다.
 * 아직 커밋하지 않은 새 이미지는 오늘 날짜로 본다.
 */
function gitAddedDates() {
  const dates = new Map();
  const git = (cmd) => execSync(`git -c core.quotepath=off ${cmd}`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    const shallowFile = path.resolve(ROOT, git('rev-parse --git-path shallow').trim());
    const boundary = new Set(fs.existsSync(shallowFile) ? fs.readFileSync(shallowFile, 'utf8').split('\n').filter(Boolean) : []);
    if (boundary.size) warnings.push('Git 기록 일부만 받아 와서(얕은 클론) 오래된 업데이트 소식이 빠질 수 있습니다. Vercel은 환경변수 VERCEL_DEEP_CLONE=true 로 해결');
    let date = null;
    for (const line of git('log -M --diff-filter=A --format=@%H%x20%cs --name-only -- public/images').split('\n')) {
      if (line.startsWith('@')) {
        const [hash, d] = line.slice(1).split(' ');
        date = boundary.has(hash) ? null : d;
      } else if (line && date && !dates.has(line)) dates.set(line, date);
    }
    const today = new Date().toISOString().slice(0, 10);
    for (const line of git('ls-files --others --exclude-standard -- public/images').split('\n')) if (line) dates.set(line, today);
  } catch {
    warnings.push('Git 기록을 읽지 못해 새 아이템 날짜와 업데이트 소식을 자동으로 만들지 못했습니다 (item-meta.json의 added만 사용)');
  }
  return dates;
}

/** 새로 추가된 아이템을 날짜별 업데이트 소식으로 만든다 (쿠키와 같은 이름의 펫·마법사탕은 쿠키에 포함) */
function autoUpdates(data) {
  const byDate = new Map();
  for (const category of Object.keys(CATEGORY_NAMES)) {
    for (const item of data[category]) {
      const date = item.addedAt;
      if (!date || item.pinned) continue;
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push({ category, item });
    }
  }
  const notes = [];
  for (const [date, list] of byDate) {
    const cookieNames = new Set(list.filter((x) => x.category === 'cookies').map((x) => x.item.name));
    const groups = new Map();
    for (const { category, item } of list) {
      if ((category === 'pets' || category === 'magicCandies') && cookieNames.has(item.name)) continue;
      if (!groups.has(category)) groups.set(category, new Set());
      groups.get(category).add(item.name);
    }
    const items = Object.keys(CATEGORY_NAMES)
      .filter((c) => groups.has(c))
      .map((c) => `${CATEGORY_NAMES[c]} 추가: ${[...groups.get(c)].join(', ')}`);
    notes.push({ date, title: '새 아이템', items });
  }
  return notes;
}

function build() {
  const meta = loadMeta();
  const data = {};
  for (const category of Object.keys(CATEGORY_FOLDERS)) data[category] = scanCategory(category);

  const allNames = new Set(Object.values(data).flat().map((i) => i.name));
  const checkNames = (names, field) => {
    for (const n of names) if (!allNames.has(n)) warnings.push(`data/item-meta.json "${field}": "${n}" 이름의 이미지가 없습니다 (오타 확인)`);
  };

  // 추가 날짜: Git 기록에서 자동으로, item-meta.json의 added가 있으면 그쪽 우선
  const gitDates = gitAddedDates();
  const added = new Map(); // 이미지 경로 → 추가 날짜
  for (const item of Object.values(data).flat()) {
    const d = gitDates.get(`public${item.image}`);
    if (d) added.set(item.image, d);
  }
  // 일괄 등록 날짜는 '신규'로 보지 않는다
  const countByDate = {};
  for (const d of added.values()) countByDate[d] = (countByDate[d] ?? 0) + 1;
  for (const [image, d] of added) if (countByDate[d] > BULK_LIMIT) added.delete(image);

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
          ...((addedAt[item.name] || added.get(item.image)) && { addedAt: addedAt[item.name] || added.get(item.image) }),
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
  data.updates = [...loadManualUpdates(), ...autoUpdates(data)].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return data;
}

/** data/updates.json: 직접 쓰는 업데이트 소식 [{ date: 'YYYY-MM-DD', title, items: [...] }]. 새 아이템 소식은 자동으로 만들어진다 */
function loadManualUpdates() {
  let notes;
  try {
    notes = JSON.parse(fs.readFileSync(UPDATES_PATH, 'utf8'));
  } catch (e) {
    errors.push(`data/updates.json: JSON 형식이 잘못됐습니다 (${e.message})`);
    return [];
  }
  if (!Array.isArray(notes)) {
    errors.push('data/updates.json: 배열([ ... ])이어야 합니다');
    return [];
  }
  return notes.filter((n, i) => {
    const where = `data/updates.json ${i + 1}번째 항목`;
    const ok =
      /^\d{4}-\d{2}-\d{2}$/.test(n?.date) && typeof n?.title === 'string' && n.title && Array.isArray(n?.items) && n.items.every((t) => typeof t === 'string');
    if (!ok) errors.push(`${where}: { "date": "YYYY-MM-DD", "title": "제목", "items": ["내용"] } 형식이어야 합니다`);
    else if ([n.title, ...n.items].some((t) => /[·•ㅡ—–]/.test(t))) warnings.push(`${where}: '·', 'ㅡ' 같은 기호 대신 쉼표나 문장으로 써 주세요`);
    return ok;
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
  const items = Object.keys(CATEGORY_NAMES).flatMap((c) => data[c]);
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

  const counts = Object.entries(data)
    .filter(([k]) => !['renamed', 'updates'].includes(k))
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
