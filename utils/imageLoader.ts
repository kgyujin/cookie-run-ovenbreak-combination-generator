import { GameData, GameItem } from '@/types';

/**
 * API에서 모든 이미지 데이터를 가져오기
 */
export async function loadAllImages(): Promise<GameData> {
  try {
    const response = await fetch('/api/images', {
      cache: 'no-store' // 항상 최신 데이터 가져오기
    });
    
    if (!response.ok) {
      throw new Error('Failed to load images');
    }
    
    const data = await response.json();
    
    return {
      cookies: data.cookies || [],
      pets: data.pets || [],
      treasures: data.treasures || [],
      dishes: data.dishes || [],
      ingredients: data.ingredients || [],
      magicCandies: data.magicCandies || [],
      blessings: data.blessings || []
    };
  } catch (error) {
    console.error('Error loading images:', error);
    // 빈 데이터 반환
    return {
      cookies: [],
      pets: [],
      treasures: [],
      dishes: [],
      ingredients: [],
      magicCandies: [],
      blessings: []
    };
  }
}

/**
 * 특정 카테고리의 이미지만 가져오기
 */
export async function loadCategoryImages(category: string): Promise<GameItem[]> {
  try {
    const response = await fetch(`/api/images?category=${category}`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load ${category} images`);
    }
    
    const data = await response.json();
    return data[category] || [];
  } catch (error) {
    console.error(`Error loading ${category} images:`, error);
    return [];
  }
}

/**
 * 등급별로 이미지 그룹화
 */
export function groupByRarity(items: GameItem[]): Record<string, GameItem[]> {
  const grouped: Record<string, GameItem[]> = {
    legendary: [],
    epic: [],
    rare: [],
    common: [],
    none: [] // 등급 정보 없는 아이템
  };
  
  items.forEach((item) => {
    const rarity = item.rarity || 'none';
    if (!grouped[rarity]) {
      grouped[rarity] = [];
    }
    grouped[rarity].push(item);
  });
  
  return grouped;
}
