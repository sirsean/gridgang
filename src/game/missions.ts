export type DockMission = {
  dock: string;
  name: string;
  summary: string;
};

/** Single shipped mode: Dock 50, standard scoring (every container pays). */
export const defaultMission: DockMission = {
  dock: "50",
  name: "Full Manifest",
  summary: "Every container scores.",
};
