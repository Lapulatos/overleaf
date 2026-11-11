export const PROJECT_TEXT_EXTENSION =
  /\.(tex|tikz|pgf|bib|sty|cls|txt|md|bst|bbx|cbx|def|cfg|fd|ldf|clo|ist|csv|dat|json|svg|enc|map)$/i;
const ASSET_EXTENSION =
  /\.(tex|tikz|pgf|bib|sty|cls|txt|md|bst|bbx|cbx|def|cfg|fd|ldf|clo|ist|png|jpe?g|pdf|eps|svg|csv|dat|json|otf|ttf|enc|map)$/i;
export const MAX_PROJECT_ASSET_BYTES = 10 * 1024 * 1024;
export const MAX_PROJECT_ASSETS_BYTES = 20 * 1024 * 1024;
export function validateProjectPath(path, asset = false) {
  if (
    typeof path !== "string" ||
    path.length > 240 ||
    !(asset ? ASSET_EXTENSION : PROJECT_TEXT_EXTENSION).test(path) ||
    path.includes("\\") ||
    [...path].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    throw new Error("Unsupported project path");
  const parts = path.split("/");
  if (
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        part.startsWith(".") ||
        /^(AGENTS|CLAUDE)\.md$/i.test(part),
    )
  )
    throw new Error("Unsafe project path");
  return parts;
}
export function validateProjectAssets(assets = []) {
  if (!Array.isArray(assets) || assets.length > 100)
    throw new Error("Project supports at most 100 attachments");
  const seen = new Set();
  let total = 0;
  return assets.map((asset) => {
    validateProjectPath(asset?.path, true);
    const key = asset.path.toLowerCase();
    if (seen.has(key)) throw new Error("Duplicate project attachment path");
    seen.add(key);
    if (
      typeof asset.data !== "string" ||
      asset.data.length > Math.ceil(MAX_PROJECT_ASSET_BYTES / 3) * 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.data)
    )
      throw new Error("Invalid project attachment encoding");
    const bytes = Buffer.from(asset.data, "base64");
    total += bytes.length;
    if (
      bytes.toString("base64") !== asset.data ||
      bytes.length > MAX_PROJECT_ASSET_BYTES ||
      total > MAX_PROJECT_ASSETS_BYTES
    )
      throw new Error("Project attachments exceed size limit");
    return { path: asset.path, bytes };
  });
}
