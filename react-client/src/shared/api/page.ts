export type DataPage<T> = { items: T[]; totalElements: number; totalPages: number; page: number; size: number };
export type AccountPage<T> = DataPage<T> & { counts: Record<string, number> };
