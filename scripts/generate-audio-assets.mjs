import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const apiUrl = "https://api.elevenlabs.io/v1/sound-generation";

const soundSpecs = [
  {
    id: "conveyor-creak-loop",
    filenamePrefix: "conveyor-creak-loop",
    variants: 3,
    durationSeconds: 6,
    loop: true,
    promptInfluence: 0.45,
    prompt:
      "Loopable old industrial conveyor belt running in a cargo dock. Low electric motor hum, metal rollers clicking rhythmically, intermittent rusty creaks, subtle chain movement. Clean close game sound effect, seamless loop, no music, no voices.",
  },
  {
    id: "container-grab",
    filenamePrefix: "container-grab",
    variants: 4,
    durationSeconds: 0.7,
    loop: false,
    promptInfluence: 0.55,
    prompt:
      "Short heavy metal cargo container being grabbed by a crane latch. Sharp steel clank, small scrape, hollow container resonance, tight dry foley for a game pickup sound. No music, no voices.",
  },
  {
    id: "container-drop",
    filenamePrefix: "container-drop",
    variants: 4,
    durationSeconds: 0.7,
    loop: false,
    promptInfluence: 0.55,
    prompt:
      "Short heavy cargo container released from a grabber. Dull metal thunk, brief scraping slide, small rattling chain tail, compact game sound effect. No music, no voices.",
  },
  {
    id: "container-whoosh",
    filenamePrefix: "container-whoosh",
    variants: 4,
    durationSeconds: 0.9,
    loop: false,
    promptInfluence: 0.5,
    prompt:
      "Large hollow steel cargo container falling quickly through open air in a warehouse cargo bay. Deep airy whoosh with slight metal vibration, no impact at the end, clean game sound effect. No music, no voices.",
  },
  {
    id: "container-land",
    filenamePrefix: "container-land",
    variants: 5,
    durationSeconds: 1.2,
    loop: false,
    promptInfluence: 0.55,
    prompt:
      "Heavy steel cargo container crashing onto other metal containers in a cargo bay. Powerful low thud, hard steel clang, hollow resonance, rattling metal tail, short warehouse reverb, satisfying game impact. No explosion, no music, no voices.",
  },
  {
    id: "container-drag-scrape",
    filenamePrefix: "container-drag-scrape",
    variants: 3,
    durationSeconds: 0.5,
    loop: false,
    promptInfluence: 0.55,
    prompt:
      "Very short subtle metal-on-metal scrape and grit as a heavy hollow shipping container shifts slightly while being dragged along a steel conveyor. Quiet dry warehouse foley, no impact, no footsteps, no music, no voices.",
  },
  {
    id: "ui-score-chime",
    filenamePrefix: "ui-score-chime",
    variants: 3,
    durationSeconds: 0.5,
    loop: false,
    promptInfluence: 0.5,
    prompt:
      "Bright retro arcade puzzle game score: two quick ascending pleasant tones in a row, clean digital chime character, tight and dry, satisfying small reward. No melody beyond two notes, no music bed, no voices.",
  },
  {
    id: "ui-bonus-chime",
    filenamePrefix: "ui-bonus-chime",
    variants: 3,
    durationSeconds: 0.5,
    loop: false,
    promptInfluence: 0.5,
    prompt:
      "Retro arcade bonus reward: three short ascending cheerful sine-like bleeps in quick succession, light and sparkly, dry game UI sound. No full tune, no music, no voices.",
  },
  {
    id: "ui-socket-bonus",
    filenamePrefix: "ui-socket-bonus",
    variants: 3,
    durationSeconds: 0.5,
    loop: false,
    promptInfluence: 0.52,
    prompt:
      "Special power-up reward sting: two clear ascending magical chime tones with a subtle sparkly tail, premium puzzle-game feel, dry and close. No choir, no music, no voices.",
  },
  {
    id: "ui-game-over",
    filenamePrefix: "ui-game-over",
    variants: 3,
    durationSeconds: 1.0,
    loop: false,
    promptInfluence: 0.55,
    prompt:
      "Game over defeat sting: brief low filtered noise burst then a sad descending saw-like tone that drops in pitch and fades, industrial warehouse mood, heavy and final. No explosion, no music, no voices.",
  },
  {
    id: "clock-tick-normal",
    filenamePrefix: "clock-tick-normal",
    variants: 3,
    durationSeconds: 0.5,
    loop: false,
    promptInfluence: 0.48,
    prompt:
      "Single very short light mechanical UI timer tick, soft square-ish digital blip, neutral and unobtrusive, dry close game HUD sound. The hit is in the first instant; keep the rest of the half-second clip nearly silent. No alarm, no music, no voices.",
  },
  {
    id: "clock-tick-amber",
    filenamePrefix: "clock-tick-amber",
    variants: 3,
    durationSeconds: 0.5,
    loop: false,
    promptInfluence: 0.5,
    prompt:
      "Single short urgent timer warning tick, slightly brighter and sharper digital blip than a normal tick, tension but not panic, dry HUD game sound. The hit is in the first instant; keep the rest of the half-second clip nearly silent. No music, no voices.",
  },
  {
    id: "clock-tick-red",
    filenamePrefix: "clock-tick-red",
    variants: 3,
    durationSeconds: 0.5,
    loop: false,
    promptInfluence: 0.52,
    prompt:
      "Single harsh low critical timer alarm tick, short gritty saw-like digital beep, urgent danger feel, dry game sound. The hit is in the first instant; keep the rest of the half-second clip nearly silent. No sustained alarm loop, no music, no voices.",
  },
];

const defaults = {
  outputDir: "public/assets/audio/sfx",
  extension: "mp3",
  force: false,
  dryRun: false,
  only: [],
  modelId: undefined,
  outputFormat: "mp3_44100_128",
};

async function main() {
  await loadDotenv();

  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey && !options.dryRun) {
    throw new Error(
      "ELEVENLABS_API_KEY is missing. Add it to .env or export it in your shell.",
    );
  }

  const specs = selectSpecs(options.only);
  const jobs = buildJobs(specs, options);

  if (options.dryRun) {
    printJobs(jobs);
    return;
  }

  await mkdir(options.outputDir, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    endpoint: apiUrl,
    outputDir: options.outputDir,
    modelId: options.modelId ?? null,
    outputFormat: options.outputFormat ?? null,
    files: [],
  };

  for (const job of jobs) {
    if (!options.force && (await exists(job.filepath))) {
      console.log(`Skipping existing ${job.filepath}`);
      manifest.files.push({
        file: job.filepath,
        id: job.spec.id,
        variant: job.variant,
        durationSeconds: job.spec.durationSeconds,
        loop: job.spec.loop,
        promptInfluence: job.spec.promptInfluence,
        prompt: job.prompt,
        status: "skipped",
      });
      continue;
    }

    console.log(`Generating ${job.filepath}`);
    const audio = await generateSound({
      apiKey,
      modelId: options.modelId,
      outputFormat: options.outputFormat,
      spec: job.spec,
      variant: job.variant,
    });

    await writeFile(job.filepath, audio.buffer);
    manifest.files.push({
      file: job.filepath,
      id: job.spec.id,
      variant: job.variant,
      durationSeconds: job.spec.durationSeconds,
      loop: job.spec.loop,
      promptInfluence: job.spec.promptInfluence,
      prompt: job.prompt,
      status: "generated",
      characterCost: audio.characterCost,
    });

    console.log(`Wrote ${job.filepath}`);
  }

  const manifestPath = path.join(options.outputDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${manifestPath}`);
}

async function generateSound({ apiKey, modelId, outputFormat, spec, variant }) {
  const prompt = buildPrompt(spec, variant);
  const url = new URL(apiUrl);
  const body = {
    text: prompt,
    duration_seconds: spec.durationSeconds,
    loop: spec.loop,
    prompt_influence: spec.promptInfluence,
  };

  if (modelId) {
    body.model_id = modelId;
  }

  if (outputFormat) {
    url.searchParams.set("output_format", outputFormat);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `ElevenLabs request failed (${response.status} ${response.statusText}): ${responseText}`,
    );
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    characterCost: response.headers.get("character-cost"),
  };
}

function buildJobs(specs, options) {
  return specs.flatMap((spec) =>
    Array.from({ length: spec.variants }, (_, index) => {
      const variant = index + 1;
      const filename = `${spec.filenamePrefix}-${String(variant).padStart(
        2,
        "0",
      )}.${options.extension}`;

      return {
        spec,
        variant,
        prompt: buildPrompt(spec, variant),
        filepath: path.join(options.outputDir, filename),
      };
    }),
  );
}

function buildPrompt(spec, variant) {
  return `${spec.prompt} Variation ${variant}: make this version distinct from the others, but keep the same timing, scale, and dry game-ready style.`;
}

function selectSpecs(only) {
  if (only.length === 0) {
    return soundSpecs;
  }

  const selected = soundSpecs.filter((spec) => only.includes(spec.id));

  if (selected.length !== only.length) {
    const validIds = soundSpecs.map((spec) => spec.id).join(", ");
    throw new Error(`Unknown sound id in --only. Valid ids: ${validIds}`);
  }

  return selected;
}

function printJobs(jobs) {
  for (const job of jobs) {
    console.log(`${job.filepath}`);
    console.log(`  duration: ${job.spec.durationSeconds}s`);
    console.log(`  loop: ${job.spec.loop ? "yes" : "no"}`);
    console.log(`  prompt: ${job.prompt}`);
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
      case "--output-dir":
        options.outputDir = requireValue(arg, value);
        index += 1;
        break;
      case "--extension":
        options.extension = requireValue(arg, value).replace(/^\./, "");
        index += 1;
        break;
      case "--only":
        options.only = requireValue(arg, value)
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
        index += 1;
        break;
      case "--model-id":
        options.modelId = requireValue(arg, value);
        index += 1;
        break;
      case "--output-format":
        options.outputFormat = requireValue(arg, value);
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

async function exists(filepath) {
  try {
    await stat(filepath);
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
