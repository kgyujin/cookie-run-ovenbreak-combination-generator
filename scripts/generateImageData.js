const fs = require('fs');
const path = require('path');

// 카테고리별 폴더 매핑
const CATEGORY_FOLDERS = {
  cookies: 'cookies',
  pets: 'pets',
  treasures: 'treasures',
  dishes: 'dishes',
  ingredients: 'ingredients',
  magicCandies: 'magic_candies',
  blessings: 'blessings'
};

// 등급 우선순위 (정렬용)
const RARITY_ORDER = {
  legendary: 0,
  epic: 1,
  rare: 2,
  common: 3
};

/**
 * 파일명에서 이름 추출 (확장자 제거)
 */
function extractNameFromFilename(filename) {
  return filename.replace(/\.(png|jpg|jpeg|webp)$/i, '');
}

/**
 * 특정 디렉토리의 이미지 파일 스캔
 */
function scanDirectory(dirPath, category, rarity) {
  const images = [];
  
  try {
    if (!fs.existsSync(dirPath)) {
      return images;
    }

    const files = fs.readdirSync(dirPath);
    let idCounter = 1;

    files.forEach((file) => {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      // 파일만 처리 (하위 디렉토리 제외)
      if (stat.isFile() && /\.(png|jpg|jpeg|webp)$/i.test(file)) {
        const name = extractNameFromFilename(file);
        const relativePath = rarity 
          ? `/images/${CATEGORY_FOLDERS[category]}/${rarity}/${file}`
          : `/images/${CATEGORY_FOLDERS[category]}/${file}`;

        const item = {
          id: `${category}_${rarity || 'default'}_${idCounter++}`,
          name,
          image: relativePath
        };
        
        if (rarity) {
          item.rarity = rarity;
        }
        
        images.push(item);
      }
    });
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }

  return images;
}

/**
 * 등급별 폴더 구조를 가진 카테고리 스캔
 */
function scanCategoryWithRarity(category, baseDir) {
  const categoryPath = path.join(baseDir, CATEGORY_FOLDERS[category]);
  const images = [];

  try {
    if (!fs.existsSync(categoryPath)) {
      console.warn(`Category folder not found: ${categoryPath}`);
      return images;
    }

    const items = fs.readdirSync(categoryPath);
    
    // 등급 폴더 확인
    const rarityFolders = items.filter((item) => {
      const itemPath = path.join(categoryPath, item);
      return fs.statSync(itemPath).isDirectory();
    });

    if (rarityFolders.length > 0) {
      // 등급별 폴더가 있는 경우
      rarityFolders.forEach((rarity) => {
        const rarityPath = path.join(categoryPath, rarity);
        const rarityImages = scanDirectory(rarityPath, category, rarity);
        images.push(...rarityImages);
      });

      // 등급순으로 정렬
      images.sort((a, b) => {
        const rarityA = RARITY_ORDER[a.rarity || ''] ?? 999;
        const rarityB = RARITY_ORDER[b.rarity || ''] ?? 999;
        if (rarityA !== rarityB) {
          return rarityA - rarityB;
        }
        return a.name.localeCompare(b.name);
      });
    } else {
      // 등급 폴더가 없는 경우 (루트에 바로 이미지)
      images.push(...scanDirectory(categoryPath, category));
    }
  } catch (error) {
    console.error(`Error scanning category ${category}:`, error);
  }

  return images;
}

/**
 * 모든 카테고리의 이미지 스캔
 */
function scanAllImages() {
  const publicDir = path.join(__dirname, '..', 'public');
  const imagesDir = path.join(publicDir, 'images');
  const result = {};

  console.log('Scanning images from:', imagesDir);

  Object.keys(CATEGORY_FOLDERS).forEach((category) => {
    console.log(`Scanning category: ${category}...`);
    result[category] = scanCategoryWithRarity(category, imagesDir);
    console.log(`  Found ${result[category].length} images`);
  });

  return result;
}

// 메인 실행
function main() {
  console.log('Starting image data generation...\n');
  try {
    const allImages = scanAllImages();
    const outputPath = path.join(process.cwd(), 'public', 'data', 'gameData.json');
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(allImages, null, 2));
    console.log(`\n✓ Image data generated successfully!`);
    console.log(`  Output: ${outputPath}`);
    console.log(`\nSummary:`);
    Object.entries(allImages).forEach(([category, items]) => {
      console.log(`  ${category}: ${items.length} items`);
    });
  } catch (err) {
    console.error('이미지 데이터 생성 중 오류 발생:', err);
    process.exit(1);
  }
}

main();
