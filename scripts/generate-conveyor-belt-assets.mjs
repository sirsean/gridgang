import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const sharedStyle = [
  "Use case: stylized-concept",
  "Asset type: horizontal seamless conveyor belt strip tile for a 2D retro-futurist cargo puzzle game",
  "Style/medium: gritty cassette retro-futurism, hand-painted game sprite texture, readable when downsampled",
  "Composition/framing: flat orthographic top-down or slight tilt-down view of ONE belt module only, fills the entire frame edge-to-edge as a wide horizontal panorama strip",
  "Primary subject: grimy rusted industrial roller conveyor bed, old steel side rails, worn rubber or metal rollers, chain gaps, oil drips",
  "Color palette: soot black, rust orange-brown, oxidized steel, dark grease, dull amber safety grime",
  "Materials/textures: pitted rust, flaking paint, welded seams, scratched rollers, dust, caked oil, bent guard lips",
  "Lighting/mood: low warehouse light, harsh micro-contrast, dirty dock atmosphere",
  "Constraints: horizontally seamless — the left edge must visually continue the right edge when tiled side-by-side; no text, no letters, no logos, no numbers, no watermark, no outer frame, no UI",
  "Avoid: clean factory belts, glossy sci-fi tread, isometric full room, cargo boxes on the belt, people, perspective vanishing tunnel, warning chevrons as a dominant motif",
].join("\n");

const assetSpecs = [
  {
    id: "belt-strip-01",
    output: "belt-strip-01.png",
    size: "1536x1024",
    width: 200,
    height: 48,
    prompt: [
      sharedStyle,
      "Variation note 1: emphasize closely spaced steel rollers and a center grease line; subtle staggered roller wear pattern that still tiles horizontally.",
    ].join("\n"),
  },
  {
    id: "belt-strip-02",
    output: "belt-strip-02.png",
    size: "1536x1024",
    width: 200,
    height: 48,
    prompt: [
      sharedStyle,
      "Variation note 2: more pronounced rust patches and chipped side rails; include faint roller shadow rhythm that repeats at the frame edges for tiling.",
    ].join("\n"),
  },
  {
    id: "belt-strip-03",
    output: "belt-strip-03.png",
    size: "1536x1024",
    width: 200,
    height: 48,
    prompt: [
      sharedStyle,
      "Variation note 3: darker overall, heavier oil staining between rollers; keep the repeating mechanical pitch consistent for horizontal seamless wrap.",
    ].join("\n"),
  },
  {
    id: "belt-strip-04",
    output: "belt-strip-04.png",
    size: "1536x1024",
    width: 200,
    height: 48,
    prompt: [
      sharedStyle,
      "Variation note 4: slightly more battered roller ends and small dents in the deck plate; seams and rivet lines must align for seamless horizontal repeat.",
    ].join("\n"),
  },
];

const defaults = {
  model: "gpt-image-1.5",
  quality: "low",
  outputDir: "public/assets/conveyor",
  only: [],
  force: false,
  dryRun: false,
};

async function main() {
  await loadDotenv();

  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey && !options.dryRun) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env or the shell.");
  }

  const selectedAssets = selectAssets(options.only);

  if (options.dryRun) {
    for (const asset of selectedAssets) {
      console.log(`${path.join(options.outputDir, asset.output)}`);
      console.log(asset.prompt);
    }

    return;
  }

  await mkdir(options.outputDir, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    model: options.model,
    quality: options.quality,
    source: "OpenAI images API",
    files: [],
  };

  for (const asset of selectedAssets) {
    const filepath = path.join(options.outputDir, asset.output);

    if (!options.force && (await exists(filepath))) {
      console.log(`Skipping existing ${filepath}`);
      manifest.files.push({
        file: filepath,
        id: asset.id,
        prompt: asset.prompt,
        status: "skipped",
      });
      continue;
    }

    console.log(`Generating ${filepath}...`);
    const image = await generateImage({
      apiKey,
      model: options.model,
      prompt: asset.prompt,
      size: asset.size,
      quality: options.quality,
    });
    const imageBuffer = Buffer.from(image.b64_json, "base64");
    await writeFile(filepath, await optimizeStrip(imageBuffer, asset));
    manifest.files.push({
      file: filepath,
      id: asset.id,
      prompt: asset.prompt,
      status: "generated",
    });
    console.log(`Wrote ${filepath}`);
  }

  const manifestPath = path.join(options.outputDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${manifestPath}`);
}

async function loadDotenv() {
  let contents;

  try {
    contents = await readFile(".env", "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(args) {
  const options = { ...defaults };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];

    switch (arg) {
      case "--model":
        options.model = requireValue(arg, value);
        index += 1;
        break;
      case "--quality":
        options.quality = requireValue(arg, value);
        index += 1;
        break;
      case "--output-dir":
        options.outputDir = requireValue(arg, value);
        index += 1;
        break;
      case "--only":
        options.only = requireValue(arg, value)
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
        index += 1;
        break;
      case "--force":
        options.force = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function requireValue(arg, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${arg} requires a value.`);
  }

  return value;
}

function selectAssets(only) {
  if (only.length === 0) {
    return assetSpecs;
  }

  const selected = assetSpecs.filter((asset) => only.includes(asset.id));

  if (selected.length !== only.length) {
    const validIds = assetSpecs.map((asset) => asset.id).join(", ");
    throw new Error(`Unknown asset id in --only. Valid ids: ${validIds}`);
  }

  return selected;
}

async function generateImage({ apiKey, model, prompt, size, quality }) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size,
      quality,
      output_format: "png",
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      `OpenAI image generation failed: ${response.status} ${JSON.stringify(payload)}`,
    );
  }

  if (!Array.isArray(payload.data) || payload.data.length === 0) {
    throw new Error("OpenAI image generation returned no images.");
  }

  return payload.data[0];
}

/** Crop to a shallow horizontal band, then scale to a narrow tile strip for Phaser TileSprite. */
async function optimizeStrip(imageBuffer, asset) {
  const meta = await sharp(imageBuffer).metadata();
  const imgW = meta.width ?? 1536;
  const imgH = meta.height ?? 1024;
  const bandH = Math.max(64, Math.floor(imgH * 0.28));
  const top = Math.max(0, Math.floor((imgH - bandH) / 2));

  return sharp(imageBuffer)
    .extract({
      left: 0,
      top,
      width: imgW,
      height: Math.min(bandH, imgH - top),
    })
    .resize(asset.width, asset.height, {
      fit: "cover",
      position: "center",
    })
    .png({
      compressionLevel: 9,
      palette: true,
      quality: 90,
    })
    .toBuffer();
}

async function exists(filepath) {
  try {
    await readFile(filepath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
