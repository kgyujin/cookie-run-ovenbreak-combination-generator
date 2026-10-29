import { createContext, useContext } from 'react';

/** 보기 전용 화면(공유 보기 링크)인지. 칸을 누르거나 옮길 수 없고, 비어 있는 칸은 그리지 않는다 */
export const ViewOnlyContext = createContext(false);

export const useViewOnly = () => useContext(ViewOnlyContext);
