/**
 * Emits JS for section rendering, stats, kind/schema filters, and the applyFilters/expandAll logic.
 */
export function emitSectionRenderers(pluginInitJs: string): string {
  return `    function renderStats(meta) {
      const statsEl = document.getElementById("stats");
      const counts = meta.object_counts || {};
      const cards = [
        { label: "Functions", value: counts.functions || 0 },
        { label: "Views", value: counts.views || 0 },
        { label: "Materialized Views", value: counts.materialized_views || 0 },
        { label: "Triggers", value: counts.triggers || 0 },
        { label: "Policies", value: counts.policies || 0 },
        { label: "Types", value: counts.types || 0 },
        { label: "Enums", value: counts.enums || 0 },
      ];

      // Add any extra counts from plugins (keys not in the core set)
      const coreKeys = new Set(["functions","views","materialized_views","triggers","policies","types","enums"]);
      for (const [key, val] of Object.entries(counts)) {
        if (!coreKeys.has(key) && typeof val === "number") {
          cards.push({ label: key.replace(/_/g, " ").replace(/\\b\\w/g, c => c.toUpperCase()), value: val });
        }
      }

      statsEl.innerHTML = cards
        .map(
          (card) =>
            \`<div class="stat-card"><span>\${escapeHtml(card.label)}</span><strong>\${card.value}</strong></div>\`
        )
        .join("");
    }

    function renderKindFilters() {
      const container = document.getElementById("kind-filters");
      container.innerHTML = Object.keys(kindLabels)
        .map(
          (kind) =>
            \`<button class="kind-chip active" data-kind="\${kind}">\${escapeHtml(kindLabels[kind])}</button>\`
        )
        .join("");

      container.querySelectorAll(".kind-chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          const kind = btn.dataset.kind;
          if (state.activeKinds.has(kind)) {
            state.activeKinds.delete(kind);
            btn.classList.remove("active");
          } else {
            state.activeKinds.add(kind);
            btn.classList.add("active");
          }
          applyFilters();
        });
      });
    }

    function renderSchemaFilter(schemas) {
      const select = document.getElementById("schema-filter");
      const options = ["all", ...(schemas || [])];
      select.innerHTML = options
        .map((schema) => \`<option value="\${schema}">\${schema === "all" ? "All schemas" : escapeHtml(schema)}</option>\`)
        .join("");

      select.addEventListener("change", (event) => {
        state.schema = event.target.value;
        applyFilters();
      });
    }

    function renderSection(containerId, items, renderer, emptyLabel) {
      const container = document.getElementById(containerId);
      if (!container) return;
      if (!items || !items.length) {
        container.innerHTML = \`<div class="empty">No \${escapeHtml(emptyLabel)} found.</div>\`;
        return;
      }
      container.innerHTML = items.map(renderer).join("");
    }

    function applyFilters() {
      const cards = document.querySelectorAll(".db-card");
      const query = state.search.toLowerCase();

      cards.forEach((card) => {
        const schema = card.dataset.schema || "";
        const kind = card.dataset.kind || "";
        const search = card.dataset.search || "";

        const matchSchema = state.schema === "all" || schema === state.schema;
        const matchKind = state.activeKinds.has(kind);
        const matchSearch = !query || search.includes(query);

        card.style.display = matchSchema && matchKind && matchSearch ? "" : "none";
      });
    }

    function expandAll(open) {
      document.querySelectorAll("details.card").forEach((card) => {
        card.open = open;
      });
    }

    function init(data) {
      document.getElementById("loading").style.display = "none";

      document.getElementById("meta-timestamp").textContent = formatDate(data.meta.timestamp);
      document.getElementById("meta-db").textContent = data.meta.database_url || "--";
      document.getElementById("meta-postgres").textContent = data.meta.postgres_version || "--";

      renderStats(data.meta);
      renderKindFilters();
      renderSchemaFilter(data.schemas);

      renderSection("functions-list", data.categories.functions, renderFunctionCard, "functions");
      renderSection("policies-list", data.categories.policies, renderPolicyCard, "policies");
      renderSection("triggers-list", data.categories.triggers, renderTriggerCard, "triggers");
      renderSection("views-list", data.categories.views, renderViewCard, "views");
      renderSection("materialized-views-list", data.categories.materialized_views, renderViewCard, "materialized views");
      renderSection("types-list", data.categories.types, renderTypeCard, "types");
      renderSection("enums-list", data.categories.enums, renderEnumCard, "enums");

      // --- Plugin init ---
${pluginInitJs ? "      " + pluginInitJs : ""}

      document.getElementById("search").addEventListener("input", (event) => {
        state.search = event.target.value || "";
        applyFilters();
      });

      document.getElementById("expand-all").addEventListener("click", () => expandAll(true));
      document.getElementById("collapse-all").addEventListener("click", () => expandAll(false));

      applyFilters();
    }`;
}
