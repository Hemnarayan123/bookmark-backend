export interface Bookmark {
  id: number;
  title: string;
  url: string;
  description: string | null;
  favicon: string | null;
  folder: string;
  created_at: Date;
  updated_at: Date;
}

export interface BookmarkWithTags extends Bookmark {
  tags: Tag[];
}

export interface Tag {
  id: number;
  name: string;
  created_at: Date;
}

export interface CreateBookmarkDTO {
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
  folder?: string;
  tags?: string[];
}

export interface UpdateBookmarkDTO {
  title?: string;
  description?: string;
  folder?: string;
  tags?: string[];
}

export interface MetadataResult {
  title: string;
  description: string;
  favicon: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}