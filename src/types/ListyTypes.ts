export interface ListyAttribute {
  key: string;
  value: string;
}

export interface ListyItem {
  title: string;
  type: string;
  url?: string;
  dateAdded: string;
  marked: boolean;
  attributes?: ListyAttribute[];
}

export interface ListyList {
  icon: string;
  title: string;
  type: string;
  create: string;
  update: string;
  items: ListyItem[];
  customOrderIndex: number;
  needFetchAfterImport: boolean;
}

export interface ListyData {
  lists: ListyList[];
} 
