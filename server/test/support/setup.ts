// Vitest setup (JAMAA-PLATFORM §5.6): the Worker installs a loader over its text modules; Node tests install one over
// the `@jamaa/content` JSON (plain Node, where wrangler's Text rule does not apply).
import { CONTENT } from "@jamaa/content";
import { installContent } from "../../src/content";

installContent((game) => CONTENT[game]);
