// JAMAA-PLATFORM §5.4: the controlled vocabulary of content/vocab.json, mirrored as TS enums (zod-free).
// A test checks this file against content/vocab.json once lane D adds it.
export const DOMAINS = ["lebanon", "middle-east", "arab-world", "france", "world", "general"] as const;
export type Domain = (typeof DOMAINS)[number];
export const TOPICS = [
  "culture", "traditions", "music", "dance", "football", "sports", "food", "history", "geography", "places",
  "language", "cinema-tv", "celebrities", "science", "nature", "art",
] as const;
export type Topic = (typeof TOPICS)[number];
export const REGIONS = ["beirut", "mount-lebanon", "north", "south", "bekaa"] as const;
export type Region = (typeof REGIONS)[number];
