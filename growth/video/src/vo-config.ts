// Voiceover switch (review-v2/DECISIONS.md #11). Off until the owner's TTS engine is set up and the files exist in
// public/vo/. Ads declare their VO lines (timing + file) regardless; when this is false they render without VO and
// without ducking, so captions still carry every line.
export const VO_ENABLED = false;
