import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

/** Open Graph / Discord link preview (1.91:1). */
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const assetSpecs = [
  {
    id: "og-share-hero",
    output: "og-hero.png",
    size: "1536x1024",
    width: OG_WIDTH,
    height: OG_HEIGHT,
    prompt: [
      "Use case: Open Graph and Discord link preview hero image for a browser game",
      "Creative brief: inspired by dock crews who move colossal shipping containers through leviathan-scale docking lattices in deep space—dangerously tight mechanical corridors, high-stakes precision, industrial decay, whispers of contraband moving through port",
      "Primary request: wide cinematic illustration of a grimy retro-futurist cargo lattice, massive container blocks threading through narrow gantries and guide rails, sense of claustrophobic industrial scale, no characters in focus",
      "Style/medium: gritty painted game key art, cassette retro-futurism, industrial sci-fi, not photoreal, not a clean UI mockup",
      "Composition/framing: strong horizontal read for a 1200x630 crop, dramatic depth, leading lines through the lattice, hero weight slightly off-center",
      "Lighting/mood: dim work lights, hazard amber and dull red indicators, soot haze, tension and fatigue, dangerous workplace atmosphere",
      "Color palette: black oil, oxidized steel, hazard red, aged amber, pale teal status glints, rust and soot",
      "Materials/textures: riveted gantries, scratched container hulls with no markings, grease, dust, worn rubber bumpers, chain and cable silhouettes",
      "Constraints: no readable text, no letters, no numbers, no logos, no watermark, no modern app UI, no glossy Apple-like surfaces",
      "Avoid: sleek spaceship bridge, purple neon gradients, pristine corridors, stock photo humans, close-up faces, cartoon simplicity",
    ].join("\n"),
  },
];

const defaults = {
  model: "gpt-image-1.5",
  quality: "low",
  outputDir: "public/assets/share",
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
      console.log(path.join(options.outputDir, asset.output));
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
