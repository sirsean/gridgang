import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const assetSpecs = [
  {
    id: "dock-control-wall",
    output: "dock-control-wall.png",
    size: "1536x1024",
    width: 1536,
    height: 1024,
    prompt: [
      "Use case: stylized-concept",
      "Asset type: homepage full-bleed background for a 2D browser game",
      "Primary request: cassette retro-futurist Grid Gang cargo dock control wall, old industrial docking lattice, massive cargo handling hardware, no people",
      "Scene/backdrop: grimy spaceport dock interior where massive containers move through tight mechanical lanes, inspired by dock workers handling leviathan cargo lattices",
      "Style/medium: gritty painted game background, retro cassette futurism, industrial sci-fi, not a clean modern website render",
      "Composition/framing: wide landscape wall with dark usable center area for UI, heavy machinery around edges, believable depth but not photoreal",
      "Lighting/mood: dim work lights, flickering amber and red LEDs, dirty shadows, old CRT glow, high mortality cargo yard mood",
      "Color palette: black oil, oxidized grey metal, hazard red, aged amber, pale teal status lights, soot and rust",
      "Materials/textures: rusted steel, worn rubber, scratched plastic labels with no readable text, grease, dust, rivets, bolts, taped repairs, chipped paint",
      "Constraints: no readable text, no letters, no numbers, no logos, no watermark, no rounded UI cards, no clean neon gradients",
      "Avoid: sleek modern sci-fi, purple gradients, glossy Apple-like surfaces, pristine spaceship bridge, luxury UI, humans, characters",
    ].join("\n"),
  },
  {
    id: "mission-terminal-panel",
    output: "mission-terminal-panel.png",
    size: "1024x1024",
    width: 768,
    height: 768,
    prompt: [
      "Use case: stylized-concept",
      "Asset type: repeatable square metal panel texture for mission cards",
      "Primary request: old heavy-duty cargo terminal panel surface, cassette retro-futurist, rusted and grimy",
      "Style/medium: gritty hand-painted game UI texture, readable as a background under text",
      "Composition/framing: square flat-on panel, edge-to-edge texture, subtle recessed seams, bolts near corners, no central illustration",
      "Lighting/mood: dim industrial lighting, worn metal highlights, dirty amber LED spill",
      "Color palette: dark steel, oxidized grey, black grease, rust red scratches, muted amber status light stains",
      "Materials/textures: dented sheet metal, rivets, scraped paint, old rubber gasket edges, dust, grime, oil streaks",
      "Constraints: low contrast in the center so white text remains readable, no readable text, no letters, no numbers, no logo, no watermark, no rounded corners",
      "Avoid: clean sci-fi panels, glowing neon frame, modern card UI, beige palette, purple palette",
    ].join("\n"),
  },
  {
    id: "mechanical-button",
    output: "mechanical-button.png",
    size: "1536x1024",
    width: 768,
    height: 256,
    prompt: [
      "Use case: stylized-concept",
      "Asset type: wide mechanical button texture for a browser game start button",
      "Primary request: big old industrial cargo dock button, rectangular and heavy, cassette retro-futurist, no text",
      "Style/medium: gritty painted UI asset, old mechanical hardware, not photoreal",
      "Composition/framing: wide horizontal rectangular button plate, centered, edge-to-edge, square corners, heavy metal rim, recessed dark face",
      "Lighting/mood: amber indicator glow, worn highlights on edges, dark oily shadows",
      "Color palette: blackened steel, dark rubber, rust, hazard red wear marks, aged amber glow",
      "Materials/textures: scratched metal, grime, chipped paint, screw heads, grease, pressed rubber center",
      "Constraints: no text, no letters, no numbers, no logos, no watermark, no rounded corners, button face must have room for overlaid text",
      "Avoid: glossy plastic web button, pill shape, soft rounded UI, clean neon gradient, beige palette, purple palette",
    ].join("\n"),
  },
  {
    id: "led-status-strip",
    output: "led-status-strip.png",
    size: "1536x1024",
    width: 1024,
    height: 160,
    prompt: [
      "Use case: stylized-concept",
      "Asset type: narrow decorative LED strip for a retro-futurist game homepage",
      "Primary request: row of old flickering status LEDs mounted into a grimy metal strip, no text",
      "Style/medium: gritty painted UI texture, cassette retro-futurist industrial hardware",
      "Composition/framing: long horizontal strip, edge-to-edge, small square and round LEDs embedded in old metal, mostly dark background",
      "Lighting/mood: uneven flickering red, amber, and pale teal LEDs, dirty glow, worn black metal",
      "Color palette: dark steel, black rubber, amber, red, pale teal, rust, soot",
      "Materials/textures: corroded metal, dust, scratches, screw heads, old plastic LED lenses",
      "Constraints: no readable text, no letters, no numbers, no logos, no watermark, no rounded web UI",
      "Avoid: modern RGB gamer lighting, purple glow, clean electronics product render, smooth glass",
    ].join("\n"),
  },
];

const defaults = {
  model: "gpt-image-1.5",
  quality: "low",
  outputDir: "public/assets/home",
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
