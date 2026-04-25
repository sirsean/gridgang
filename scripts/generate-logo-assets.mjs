import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const defaults = {
  model: "gpt-image-1.5",
  quality: "low",
  size: "1024x1024",
  sourceImage: "public/assets/grid-gang-icon.png",
  outputDir: "public/assets/branding",
  outputName: "grid-gang-logo-master.png",
  dryRun: false,
  force: false,
  promptExtra: "",
  applyLive: false,
};

const derivativeSpecs = [
  {
    id: "logo-icon",
    output: "grid-gang-icon.png",
    width: 512,
    height: 512,
  },
  {
    id: "favicon",
    output: "favicon.png",
    width: 256,
    height: 256,
  },
  {
    id: "favicon-64",
    output: "favicon-64.png",
    width: 64,
    height: 64,
  },
  {
    id: "favicon-32",
    output: "favicon-32.png",
    width: 32,
    height: 32,
  },
];

async function main() {
  await loadDotenv();

  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY;
  const prompt = buildPrompt(options.promptExtra);

  if (!apiKey && !options.dryRun) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env or the shell.");
  }

  if (options.dryRun) {
    console.log(`Source image: ${options.sourceImage}`);
    console.log(`Master output: ${path.join(options.outputDir, options.outputName)}`);
    console.log(prompt);
    return;
  }

  await mkdir(options.outputDir, { recursive: true });
  const masterPath = path.join(options.outputDir, options.outputName);

  if (!options.force && (await exists(masterPath))) {
    throw new Error(
      `Refusing to overwrite existing master image: ${masterPath}. Pass --force to replace.`,
    );
  }

  const sourceImageBuffer = await readFile(options.sourceImage);

  console.log(`Editing ${options.sourceImage} into ${masterPath}...`);
  const editedImage = await editImage({
    apiKey,
    model: options.model,
    prompt,
    quality: options.quality,
    size: options.size,
    sourceImageBuffer,
    sourceFilename: path.basename(options.sourceImage),
  });

  const masterBuffer = await optimizePng(Buffer.from(editedImage.b64_json, "base64"), {
    width: 1024,
    height: 1024,
  });

  await writeFile(masterPath, masterBuffer);
  console.log(`Wrote ${masterPath}`);

  const generatedFiles = [
    {
      id: "master",
      file: masterPath,
      width: 1024,
      height: 1024,
    },
  ];

  for (const derivative of derivativeSpecs) {
    const targetPath = path.join(options.outputDir, derivative.output);

    if (!options.force && (await exists(targetPath))) {
      console.log(`Skipping existing ${targetPath}`);
      generatedFiles.push({
        id: derivative.id,
        file: targetPath,
        width: derivative.width,
        height: derivative.height,
        status: "skipped",
      });
      continue;
    }

    await writeFile(
      targetPath,
      await optimizePng(masterBuffer, {
        width: derivative.width,
        height: derivative.height,
      }),
    );
    console.log(`Wrote ${targetPath}`);
    generatedFiles.push({
      id: derivative.id,
      file: targetPath,
      width: derivative.width,
      height: derivative.height,
      status: "generated",
    });
  }

  const manifestPath = path.join(options.outputDir, "manifest.json");
  const manifest = {
    generatedAt: new Date().toISOString(),
    model: options.model,
    quality: options.quality,
    size: options.size,
    sourceImage: options.sourceImage,
    source: "OpenAI images edits API",
    prompt,
    files: generatedFiles,
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${manifestPath}`);

  if (options.applyLive) {
    await applyLiveAssets(options.outputDir);
  } else {
    console.log(
      "To apply this pass in-app, rerun with --apply-live or copy branding outputs to public/assets/grid-gang-icon.png and public/favicon.png.",
    );
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
      case "--size":
        options.size = requireValue(arg, value);
        index += 1;
        break;
      case "--source-image":
        options.sourceImage = requireValue(arg, value);
        index += 1;
        break;
      case "--output-dir":
        options.outputDir = requireValue(arg, value);
        index += 1;
        break;
      case "--output-name":
        options.outputName = requireValue(arg, value);
        index += 1;
        break;
      case "--prompt-extra":
        options.promptExtra = requireValue(arg, value);
        index += 1;
        break;
      case "--apply-live":
        options.applyLive = true;
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

function buildPrompt(extra) {
  const lines = [
    "Use case: logo and favicon redesign for the Gridgang game while preserving brand recognition.",
    "Primary request: transform the provided Gridgang icon into an in-world dockside mark that still reads as the same symbol.",
    "Style/medium: cassette-futurism mixed with rough spray-painted stencil and cheap rough-printed cargo-yard signage.",
    "Composition/framing: centered iconic mark on transparent-free dark neutral backdrop, strong silhouette, high legibility at 32x32 favicon size.",
    "Visual texture: paint overspray, uneven ink coverage, chipped pigment, weathered rust dust, grime, but edges still recognizable.",
    "Mood: dangerous leviathan cargo docks, contraband-adjacent graffiti tag, used by workers and smugglers.",
    "Color direction: oxidized steel greys, hazard red-orange, soot black, muted amber accents; avoid bright clean neon.",
    "Constraints: keep the core geometry recognizable from the original icon, no readable text, no letters, no numbers, no watermark, no decorative frame.",
    "Avoid: glossy modern logo polish, corporate vector smoothness, cyberpunk purple gradients, photoreal people, scene backgrounds.",
  ];

  if (extra) {
    lines.push(`Additional direction: ${extra}`);
  }

  return lines.join("\n");
}

async function editImage({
  apiKey,
  model,
  prompt,
  quality,
  size,
  sourceImageBuffer,
  sourceFilename,
}) {
  const formData = new FormData();
  formData.set("model", model);
  formData.set("prompt", prompt);
  formData.set("quality", quality);
  formData.set("size", size);
  formData.set("output_format", "png");
  formData.set(
    "image",
    new Blob([sourceImageBuffer], { type: "image/png" }),
    sourceFilename,
  );

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      `OpenAI image edit failed: ${response.status} ${JSON.stringify(payload)}`,
    );
  }

  if (!Array.isArray(payload.data) || payload.data.length === 0) {
    throw new Error("OpenAI image edit returned no images.");
  }

  return payload.data[0];
}

async function optimizePng(imageBuffer, { width, height }) {
  return sharp(imageBuffer)
    .resize(width, height, {
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

async function applyLiveAssets(outputDir) {
  const iconSourcePath = path.join(outputDir, "grid-gang-icon.png");
  const faviconSourcePath = path.join(outputDir, "favicon.png");
  const iconTargetPath = "public/assets/grid-gang-icon.png";
  const faviconTargetPath = "public/favicon.png";

  await writeFile(iconTargetPath, await readFile(iconSourcePath));
  await writeFile(faviconTargetPath, await readFile(faviconSourcePath));
  console.log(`Updated ${iconTargetPath}`);
  console.log(`Updated ${faviconTargetPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
