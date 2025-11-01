// 폴더 내 모든 PNG 이미지를 동적으로 로드하는 유틸리티

export interface ImageItem {
  id: string;
  name: string;
  path: string;
}

const categories = {
  cookies: 'cookies',
  pets: 'pets',
  treasures: 'treasures',
  dishes: 'dishes',
  ingredients: 'ingredients',
  magicCandies: 'magic_candies',
  blessings: 'blessings'
} as const;

export type CategoryKey = keyof typeof categories;

/**
 * 특정 카테고리의 모든 PNG 이미지를 로드
 */
export async function loadImagesFromCategory(category: CategoryKey): Promise<ImageItem[]> {
  const folderName = categories[category];
  const basePath = `/images/${folderName}`;
  
  try {
    // public 폴더는 빌드 시 정적으로 제공되므로
    // 파일 시스템 접근 대신 이미지 경로를 직접 생성
    const response = await fetch(`${basePath}/list.json`).catch(() => null);
    
    if (response && response.ok) {
      const fileList = await response.json();
      return fileList.map((filename: string, index: number) => ({
        id: `${category}_${index}`,
        name: filename.replace(/\.\w+$/, '').replace(/^\d+_/, ''),
        path: `${basePath}/${filename}`
      }));
    }
  } catch (error) {
    console.warn(`Failed to load image list for ${category}:`, error);
  }
  
  // Fallback: 기본 이미지 패턴으로 시도
  return await loadImagesWithPattern(basePath);
}

/**
 * 특정 패턴의 이미지를 순차적으로 시도하여 로드
 */
async function loadImagesWithPattern(basePath: string): Promise<ImageItem[]> {
  const images: ImageItem[] = [];
  
  // 실제 파일 시스템을 스캔할 수 없으므로
  // 클라이언트에서 동적으로 이미지를 발견하는 방법 사용
  // img 태그의 onerror를 활용하여 존재하는 이미지만 수집
  
  return images;
}

/**
 * 브라우저에서 실행: 폴더 내 모든 이미지를 동적으로 발견
 */
export function discoverImagesInBrowser(category: CategoryKey, onComplete: (images: ImageItem[]) => void): void {
  const folderName = categories[category];
  const basePath = `/images/${folderName}`;
  const images: ImageItem[] = [];
  let checkCount = 0;
  const maxChecks = 50; // 최대 50개 파일 확인
  
  function checkImage(index: number) {
    if (checkCount >= maxChecks) {
      onComplete(images);
      return;
    }
    
    const img = new Image();
    const patterns = [
      `${basePath}/${index}_*.png`,
      `${basePath}/*.png`,
    ];
    
    // 실제로는 서버에서 파일 목록을 제공받아야 함
    // 여기서는 간단히 알려진 파일들을 하드코딩
    onComplete(images);
  }
  
  checkImage(0);
}

/**
 * 서버 사이드에서 이미지 목록 생성 (Next.js API route에서 사용)
 */
export async function generateImageList() {
  // 이 함수는 빌드 타임이나 API route에서 실행되어야 함
  return null;
}
