import React from "react";
import {
  IconFile,
  IconFunction,
  IconPolicy,
  IconTable,
  IconTrigger,
  IconView,
  IconEnum,
  IconType,
  type IconProps,
} from "../components/Icons";

const SECTION_ICONS: Record<string, React.ComponentType<IconProps>> = {
  tables: IconTable,
  functions: IconFunction,
  policies: IconPolicy,
  triggers: IconTrigger,
  views: IconView,
  materialized_views: IconView,
  types: IconType,
  enums: IconEnum,
  edge_functions: IconFunction,
  migration_audit: IconFile,
  dependency_graph: IconTable,
  frontend_usage: IconFile,
};

export function getSectionIcon(section: string): React.ComponentType<IconProps> {
  return SECTION_ICONS[section] ?? IconFile;
}

const NODE_TYPE_ICONS: Record<string, React.ComponentType<IconProps>> = {
  table: IconTable,
  tables: IconTable,
  function: IconFunction,
  functions: IconFunction,
  view: IconView,
  views: IconView,
  materialized_view: IconView,
  materialized_views: IconView,
  trigger: IconTrigger,
  triggers: IconTrigger,
  policy: IconPolicy,
  policies: IconPolicy,
  type: IconType,
  types: IconType,
  enum: IconEnum,
  enums: IconEnum,
};

export function getNodeTypeIcon(type: string): React.ComponentType<IconProps> {
  return NODE_TYPE_ICONS[type.toLowerCase()] ?? IconFile;
}
