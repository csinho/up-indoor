import type {
  LayoutPresetId,
  LayoutRegionInput,
  LayoutTemplateInput,
  Orientation,
} from "./types";

function getCanvasDimensions(orientation: Orientation) {
  return orientation === "portrait"
    ? { canvas_width: 1080, canvas_height: 1920 }
    : { canvas_width: 1920, canvas_height: 1080 };
}

function createRegion(
  name: string,
  region_type: LayoutRegionInput["region_type"],
  x: number,
  y: number,
  width: number,
  height: number,
  z_index: number,
  background = "transparent",
): LayoutRegionInput {
  return {
    name,
    region_type,
    x,
    y,
    width,
    height,
    z_index,
    background,
    items: [],
  };
}

export function createLayoutRegionsFromPreset(
  preset: LayoutPresetId,
  orientation: Orientation,
): LayoutRegionInput[] {
  const { canvas_width: width, canvas_height: height } =
    getCanvasDimensions(orientation);

  switch (preset) {
    case "main_with_banner":
      return [
        createRegion("Principal", "media", 0, 0, width, Math.round(height * 0.8), 1),
        createRegion(
          "Banner Inferior",
          "banner",
          0,
          Math.round(height * 0.8),
          width,
          height - Math.round(height * 0.8),
          2,
          "#111827",
        ),
      ];
    case "split_vertical":
      return orientation === "portrait"
        ? [
            createRegion("Topo", "media", 0, 0, width, Math.round(height / 2), 1),
            createRegion(
              "Base",
              "media",
              0,
              Math.round(height / 2),
              width,
              height - Math.round(height / 2),
              1,
            ),
          ]
        : [
            createRegion(
              "Esquerda",
              "media",
              0,
              0,
              Math.round(width / 2),
              height,
              1,
            ),
            createRegion(
              "Direita",
              "media",
              Math.round(width / 2),
              0,
              width - Math.round(width / 2),
              height,
              1,
            ),
          ];
    case "split_horizontal":
      return orientation === "portrait"
        ? [
            createRegion(
              "Esquerda",
              "media",
              0,
              0,
              Math.round(width / 2),
              height,
              1,
            ),
            createRegion(
              "Direita",
              "media",
              Math.round(width / 2),
              0,
              width - Math.round(width / 2),
              height,
              1,
            ),
          ]
        : [
            createRegion("Topo", "media", 0, 0, width, Math.round(height / 2), 1),
            createRegion(
              "Base",
              "media",
              0,
              Math.round(height / 2),
              width,
              height - Math.round(height / 2),
              1,
            ),
          ];
    case "grid_2x2":
      return [
        createRegion("Bloco 1", "media", 0, 0, Math.round(width / 2), Math.round(height / 2), 1),
        createRegion(
          "Bloco 2",
          "media",
          Math.round(width / 2),
          0,
          width - Math.round(width / 2),
          Math.round(height / 2),
          1,
        ),
        createRegion(
          "Bloco 3",
          "media",
          0,
          Math.round(height / 2),
          Math.round(width / 2),
          height - Math.round(height / 2),
          1,
        ),
        createRegion(
          "Bloco 4",
          "media",
          Math.round(width / 2),
          Math.round(height / 2),
          width - Math.round(width / 2),
          height - Math.round(height / 2),
          1,
        ),
      ];
    case "fullscreen":
    default:
      return [createRegion("Tela cheia", "media", 0, 0, width, height, 1)];
  }
}

export function createLayoutTemplateDraft(
  preset: LayoutPresetId,
  orientation: Orientation,
): LayoutTemplateInput {
  const dimensions = getCanvasDimensions(orientation);

  return {
    name: "",
    description: "",
    orientation,
    active: true,
    ...dimensions,
    regions: createLayoutRegionsFromPreset(preset, orientation),
  };
}

export function getPresetLabel(preset: LayoutPresetId) {
  switch (preset) {
    case "fullscreen":
      return "Tela cheia";
    case "main_with_banner":
      return "Principal + banner";
    case "split_vertical":
      return "2 blocos";
    case "split_horizontal":
      return "2 blocos invertidos";
    case "grid_2x2":
      return "Grade 2x2";
    default:
      return preset;
  }
}
