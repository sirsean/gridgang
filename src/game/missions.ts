export type MissionScoringRule =
  | "standard"
  | "red-only"
  | "yellow-penalty"
  | "yellow-only"
  | "teal-only"
  | "grey-only"
  | "red-penalty"
  | "non-red-only"
  | "small-double"
  | "large-double"
  | "small-penalty"
  | "half-manifest";

export type DockMission = {
  dock: string;
  name: string;
  summary: string;
  scoringRule: MissionScoringRule;
  pinned?: boolean;
};

export const dockMissions: DockMission[] = [
  {
    dock: "50",
    name: "Full Manifest",
    summary: "Every container scores.",
    scoringRule: "standard",
    pinned: true,
  },
  {
    dock: "31",
    name: "Redline",
    summary: "Red containers score.",
    scoringRule: "red-only",
  },
  {
    dock: "18",
    name: "Yellow Debt",
    summary: "Yellow containers deduct.",
    scoringRule: "yellow-penalty",
  },
  {
    dock: "07",
    name: "Small Haul",
    summary: "Small containers pay double.",
    scoringRule: "small-double",
  },
  {
    dock: "12",
    name: "Heavy Ticket",
    summary: "Large containers pay double.",
    scoringRule: "large-double",
  },
  {
    dock: "22",
    name: "Grey Market",
    summary: "Grey containers score.",
    scoringRule: "grey-only",
  },
  {
    dock: "27",
    name: "Teal Channel",
    summary: "Teal containers score.",
    scoringRule: "teal-only",
  },
  {
    dock: "39",
    name: "Yellow Slot",
    summary: "Yellow containers score.",
    scoringRule: "yellow-only",
  },
  {
    dock: "41",
    name: "Red Penalty",
    summary: "Red containers deduct.",
    scoringRule: "red-penalty",
  },
  {
    dock: "46",
    name: "Cold Route",
    summary: "Non-red containers score.",
    scoringRule: "non-red-only",
  },
  {
    dock: "63",
    name: "Loose Ends",
    summary: "Small containers deduct.",
    scoringRule: "small-penalty",
  },
  {
    dock: "71",
    name: "Half Run",
    summary: "Every container pays half.",
    scoringRule: "half-manifest",
  },
];

export const defaultMission = dockMissions[0];

export function getMissionByDock(dock: string | null) {
  return dockMissions.find((mission) => mission.dock === dock) ?? defaultMission;
}

export function selectHomeMissions(count = 4) {
  const pinnedMissions = dockMissions.filter((mission) => mission.pinned);
  const rotatingMissions = shuffle(
    dockMissions.filter((mission) => !mission.pinned),
  );

  return [...pinnedMissions, ...rotatingMissions].slice(0, count);
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
