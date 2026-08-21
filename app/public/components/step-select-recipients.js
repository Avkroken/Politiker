// Steg 1: de 6 övergripande mottagarkorten (EU/Regering/Riksdag/Media/Region/
// Kommun). Den detaljerade per-område-listan, befattningsfiltret,
// parti-/individuell exkludering ligger kvar i app.js (oförändrad,
// befintlig logik) inne i en "Avancerat"-sektion — bara dessa kort är nya.
//
// Rent presentationslager: tar emot redan summerad data + en toggle-
// callback, äger ingen egen state.

const POLITICAL_TYPE_ORDER = ["eu", "regering", "riksdag", "media", "region", "kommun"];
const TYPE_ORDER = [...POLITICAL_TYPE_ORDER, "kyrka"];
const TYPE_LABEL_FALLBACK = { media: "Nyhetsredaktioner" };

export function renderAreaTypeCards(container, { areasByType, selectedAreas, onToggleType, t }) {
  container.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "area-type-grid";

  const types = [...areasByType.keys()].sort(
    (a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b),
  );

  const allAreas = POLITICAL_TYPE_ORDER.flatMap((areaType) => areasByType.get(areaType) ?? []);
  const allSelected = allAreas.length > 0 && allAreas.every((a) => selectedAreas.has(a.area_name));
  const someSelected = !allSelected && allAreas.some((a) => selectedAreas.has(a.area_name));
  const allCard = document.createElement("button");
  allCard.type = "button";
  allCard.className = "area-type-card" + (allSelected ? " selected" : "") + (someSelected ? " partial" : "");

  const allLabel = document.createElement("div");
  allLabel.className = "area-type-card-label";
  allLabel.textContent = "Alla politiker";
  allCard.appendChild(allLabel);

  const allCount = document.createElement("div");
  allCount.className = "area-type-card-count";
  allCount.textContent = t("area_type_card_count", { count: allAreas.reduce((sum, a) => sum + a.count, 0) });
  allCard.appendChild(allCount);

  allCard.addEventListener("click", () => onToggleType("all", allAreas, !allSelected));
  grid.appendChild(allCard);

  for (const areaType of types) {
    const areas = areasByType.get(areaType);
    const totalCount = areas.reduce((sum, a) => sum + a.count, 0);
    const typeAllSelected = areas.every((a) => selectedAreas.has(a.area_name));
    const typeSomeSelected = !typeAllSelected && areas.some((a) => selectedAreas.has(a.area_name));

    const card = document.createElement("button");
    card.type = "button";
    card.className = "area-type-card" + (typeAllSelected ? " selected" : "") + (typeSomeSelected ? " partial" : "");

    const label = document.createElement("div");
    label.className = "area-type-card-label";
    const labelKey = `area_type_${areaType}`;
    const translatedLabel = t(labelKey);
    label.textContent = translatedLabel === labelKey ? (TYPE_LABEL_FALLBACK[areaType] ?? areaType) : translatedLabel;
    card.appendChild(label);

    const count = document.createElement("div");
    count.className = "area-type-card-count";
    count.textContent = t("area_type_card_count", { count: totalCount });
    card.appendChild(count);

    card.addEventListener("click", () => onToggleType(areaType, areas, !typeAllSelected));
    grid.appendChild(card);
  }

  container.appendChild(grid);
}
