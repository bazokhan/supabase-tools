import type { CategoryMap } from "../lib/model";

export interface PageProps {
  categories: CategoryMap;
  onOpenDetail: (section: string, key: string) => void;
}
