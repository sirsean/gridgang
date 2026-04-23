import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const sharedStyle = [
  "Use case: stylized-concept",
  "Style/medium: gritty cassette futurism, hand-painted game environment texture, readable when downsampled",
  "Color palette: soot black, oxidized steel, rust brown, dark grease, dull amber hazard grime, faded institutional teal",
  "Materials: pitted metal, stamped plates, rivets, cable runs, grime streaks, VHS-era industrial wear",
  "Lighting/mood: low dock light, harsh micro-contrast, claustrophobic freight atmosphere",
  "Constraints: no text, no letters, no logos, no numbers, no watermark, no outer frame, no UI, no characters",
  "Avoid: clean sci-fi corridors, glossy surfaces, bright neon, stock photo lighting, isometric room diorama",
].join("\n");

const assetSpecs = [
  {
    id: "dead-space",
    output: "dead-space.png",
    size: "1024x1536",
    width: 720,
    height: 960,
    prompt: [
      sharedStyle,
      "Asset type: full-screen vertical environment backdrop for a 2D cargo puzzle game (portrait 720×960 playfield).",
      "Composition/framing: flat orthographic wall and bulkhead collage filling the entire frame edge-to-edge.",
      "Primary subject: grimy freight dock dead space — layered steel bulkheads, conduit trays, inspection hatches,",
      "stencil-faded hazard bands (no readable words), cable bundles, weld seams, water stains, dust.",
      "Spatial layout: dense industrial wall treatment suitable as a static background; no single vanishing tunnel.",
      "Variation note: heavier vertical conduit rhythm on one side, asymmetric rust blooms, subtle horizontal deck seams.",
    ].join("\n"),
  },
  {
    id: "cargo-bay-backdrop",
    output: "cargo-bay-backdrop.png",
    size: "1024x1024",
    width: 480,
    height: 600,
    prompt: [
      sharedStyle,
      "Asset type: rectangular floor/deck panel for a personal cargo stowage grid (480×600 game units, 12×15 cells).",
      "Composition/framing: strict top-down orthographic view of ONE contiguous deck surface filling the entire frame.",
      "Primary subject: worn alloy loading deck — recessed tie-down rings, scratched skid marks, oil splatter,",
      "faint grid wear from years of pallets, chipped yellow-black hazard tape at the outer margin (abstract, no text),",
      "subtle panel seams aligned to a coarse grid so a 40px cell grid can be drawn on top in-game.",
      "Variation note: slightly darker center, brighter oxidized edges; include micro-debris and paint chips for grit.",
    ].join("\n"),
  },
];

const defaults = {
  model: "gpt-image-1.5",
  quality: "low",
  outputDir: "public/assets/dock",
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
    await writeFile(filepath, await optimizeImage(imageBuffer, asset));
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

async function optimizeImage(imageBuffer, asset) {
  return sharp(imageBuffer)
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
