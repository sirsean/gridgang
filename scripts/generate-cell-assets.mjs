import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const colorSpecs = [
  {
    id: "hazard",
    name: "hazard red",
    hex: "#e35335",
    notes: "oxidized red paint, scorched industrial salvage, dark fasteners",
  },
  {
    id: "cargo-a",
    name: "light grey",
    hex: "#9b9b9b",
    notes: "dull galvanized metal, scratched pale plastic, oil-dark seams",
  },
  {
    id: "cargo-b",
    name: "teal",
    hex: "#4fb3a5",
    notes: "aged teal plastic panels, corroded metal braces, grease stains",
  },
  {
    id: "cargo-c",
    name: "yellow amber",
    hex: "#c4a15a",
    notes: "old amber safety plastic, chipped yellow paint, rusted fasteners",
  },
  {
    id: "cargo-d",
    name: "dark grey",
    hex: "#7f8c8d",
    notes: "weathered dark grey metal, worn rubberized plastic, oily grime",
  },
];

const defaults = {
  model: "gpt-image-1.5",
  variants: 10,
  size: "1024x1024",
  quality: "low",
  assetSize: 128,
  derivedSizes: {
    conveyor: 32,
    bay: 38,
  },
  outputDir: "public/assets/cells",
};

async function main() {
  await loadDotenv();

  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env or the shell.");
  }

  await mkdir(options.outputDir, { recursive: true });

  const selectedColors =
    options.colors.length > 0
      ? colorSpecs.filter((color) => options.colors.includes(color.id))
      : colorSpecs;

  if (selectedColors.length === 0) {
    throw new Error(
      `No matching colors. Valid colors: ${colorSpecs
        .map((color) => color.id)
        .join(", ")}`,
    );
  }

  if (options.resizeExisting) {
    await resizeExistingAssets(selectedColors, options);
    return;
  }

  if (options.deriveExisting) {
    await deriveExistingAssets(selectedColors, options);
    return;
  }

  for (const color of selectedColors) {
    const prompt = buildPrompt(color);

    console.log(
      `Generating ${options.variants} ${color.id} cell asset(s) with ${options.model}...`,
    );

    const images = await generateImages({
      apiKey,
      model: options.model,
      prompt,
      variants: options.variants,
      size: options.size,
      quality: options.quality,
    });

    for (const [index, image] of images.entries()) {
      const filename = `${color.id}-${String(index + 1).padStart(2, "0")}.png`;
      const filepath = path.join(options.outputDir, filename);
      const imageBuffer = Buffer.from(image.b64_json, "base64");
      await writeFile(filepath, await optimizeImage(imageBuffer, options.assetSize));
      console.log(`Wrote ${filepath}`);
    }
  }
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
  const options = {
    ...defaults,
    colors: [],
    resizeExisting: false,
    deriveExisting: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];

    switch (arg) {
      case "--model":
        options.model = requireValue(arg, value);
        index += 1;
        break;
      case "--variants":
        options.variants = Number.parseInt(requireValue(arg, value), 10);
        index += 1;
        break;
      case "--size":
        options.size = requireValue(arg, value);
        index += 1;
        break;
      case "--quality":
        options.quality = requireValue(arg, value);
        index += 1;
        break;
      case "--asset-size":
        options.assetSize = Number.parseInt(requireValue(arg, value), 10);
        index += 1;
        break;
      case "--output-dir":
        options.outputDir = requireValue(arg, value);
        index += 1;
        break;
      case "--colors":
        options.colors = requireValue(arg, value)
          .split(",")
          .map((color) => color.trim())
          .filter(Boolean);
        index += 1;
        break;
      case "--resize-existing":
        options.resizeExisting = true;
        break;
      case "--derive-existing":
        options.deriveExisting = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(options.variants) || options.variants < 1) {
    throw new Error("--variants must be a positive integer.");
  }

  if (!Number.isInteger(options.assetSize) || options.assetSize < 16) {
    throw new Error("--asset-size must be an integer of at least 16.");
  }

  return options;
}

function requireValue(arg, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${arg} requires a value.`);
  }

  return value;
}

async function generateImages({ apiKey, model, prompt, variants, size, quality }) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      n: variants,
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

  return payload.data;
}

async function resizeExistingAssets(colors, options) {
  for (const color of colors) {
    for (let index = 1; index <= options.variants; index += 1) {
      const filename = `${color.id}-${String(index).padStart(2, "0")}.png`;
      const filepath = path.join(options.outputDir, filename);
      const imageBuffer = await readFile(filepath);
      await writeFile(filepath, await optimizeImage(imageBuffer, options.assetSize));
      console.log(`Resized ${filepath}`);
    }
  }
}

async function deriveExistingAssets(colors, options) {
  for (const color of colors) {
    for (let index = 1; index <= options.variants; index += 1) {
      const filename = `${color.id}-${String(index).padStart(2, "0")}.png`;
      const sourcePath = path.join(options.outputDir, filename);
      const imageBuffer = await readFile(sourcePath);

      for (const [usage, size] of Object.entries(options.derivedSizes)) {
        const outputDir = path.join(options.outputDir, usage);
        const outputPath = path.join(outputDir, filename);
        await mkdir(outputDir, { recursive: true });
        await writeFile(outputPath, await optimizeImage(imageBuffer, size));
        console.log(`Derived ${outputPath}`);
      }
    }
  }
}

async function optimizeImage(imageBuffer, assetSize) {
  return sharp(imageBuffer)
    .resize(assetSize, assetSize, {
      fit: "cover",
      position: "center",
    })
    .png({
      compressionLevel: 9,
      palette: true,
      quality: 92,
    })
    .toBuffer();
}

function buildPrompt(color) {
  return [
    "Use case: stylized-concept",
    "Asset type: square sprite tile for a 2D retro-futurist cargo puzzle game",
    `Primary request: draw one square container cell, color-coded ${color.name} (${color.hex}), made from old metal and plastic panels`,
    "Style/medium: gritty cassette retro-futurism, hand-painted game sprite texture, readable when downsampled to 38x38 pixels",
    "Composition/framing: flat orthographic square tile face, cropped edge-to-edge, fills the entire frame with material texture",
    `Color palette: dominant ${color.hex}; ${color.notes}; dark oily shadows and worn metal highlights`,
    "Materials/textures: dented sheet metal, scratched plastic, rust, grease stains, grime, worn edges, rivets, panel seams, tape residue",
    "Lighting/mood: low industrial light, high contrast, dirty warehouse feel",
    "Constraints: seamless-feeling square tile, no text, no letters, no logos, no icons, no numbers, no watermark, no transparent border, no black margin, no outer frame",
    "Avoid: warning stripes, safety stripes, clean sci-fi panels, glowing neon, photorealistic product photography, full cargo container scene, perspective box, UI frame, inset panel, rounded corners",
  ].join("\n");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
