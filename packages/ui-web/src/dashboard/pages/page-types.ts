import type { DashboardSectionDef } from "@sbtools/sdk";
import type { CategoryMap } from "../lib/model";

export interface PageProps {
  categories: CategoryMap;
  sections?: DashboardSectionDef[];
  onOpenDetail: (section: string, key: string) => void;
}
