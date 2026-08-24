import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const FONT_DIR = join(process.cwd(), "lib", "wallpaper", "fonts");
const FONT_FILES = [join(FONT_DIR, "DejaVuSans.ttf"), join(FONT_DIR, "DejaVuSans-Bold.ttf")];

/**
 * Rasterize an SVG string to a PNG buffer using explicitly-bundled fonts.
 * Uses resvg (not sharp/librsvg) so text renders identically on macOS and Vercel,
 * where system fonts are absent and would otherwise render as tofu boxes.
 */
export async function svgToPng(svg: string, width: number): Promise<Buffer> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: {
      fontFiles: FONT_FILES,
      defaultFontFamily: "DejaVu Sans",
      loadSystemFonts: false,
    },
  });
  return Buffer.from(resvg.render().asPng());
}
