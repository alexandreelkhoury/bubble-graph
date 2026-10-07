# Veo round 1: what went wrong and how to fix it next time (2026-10-07)

Round 1 made 9 clips for MA_A_H1: 6 on Veo 3.1 Fast and 2 on Lite, all with Ingredients (character portrait + ROOM). About 200 credits in total, including two failed attempts that were refunded.

## What looked fake, and why

| # | Problem | Seen in | Cause | Fix next time |
|---|---|---|---|---|
| 1 | **A TV, laptop or monitor edge in the foreground**: a grey blurred bar at the bottom or a white panel at the side | BODY_shot03, 04 (first take), 06, A_H1_shot01 (start), A_H1_shot02 | Our prompts said "seen from the TV" and "a glow from the TV behind the camera", so Veo drew a screen | Never mention a TV or screen in the prompt. Write "the camera is a phone on a small tripod, nothing in front of it, clear view". Describe the light as "cool-white light from the front" without naming where it comes from. Shot 4c proves this works. |
| 2 | **A random foreground blur** (a friend's shoulder or hand crossing the frame) | BODY_shot02 (1–3.5 s), BODY_shot04 (0–0.5 s) | "Handheld, house party" makes Veo add people moving through the frame | Add "no one passes in front of the camera" and "clean foreground". Keep "handheld" only for the high-energy shots. |
| 3 | **The scene changes partway through the clip** (a jump to a wide shot, someone stands up or sits back) | BODY_shot01 (4 s), BODY_shot03 (5.5 s) | An 8 s clip with a short action, so Veo invents a second beat | Write the action for the full 8 s ("holds the pose until the end"), or ask for a 4 s clip. Plan to use only the first 3–4 s. |
| 4 | **Floaty physics**: a leap with stiff legs and a pose held mid-air, a cushion bigger than a torso | BODY_shot06, A_H1_shot03 | Big jumps, throws and objects in flight are Veo's weak point | Avoid jumps, throws and flying objects. Use reactions that read from the face and hands instead: a hand over the mouth, both hands on the head, falling back into the sofa. Keep any big move under 1 s and cut on it. |
| 5 | **Wrong set and light**: a flat pink studio wall, everyone standing, cool light | A_H1_shot03 (Lite, 3 portraits, no ROOM image) | No ROOM reference (the 3-image limit was used up by 3 people), plus the Lite model | A shot with 3 people needs Fast and the ROOM image: use 2 people + ROOM, or a frame from a good shot as the start frame (Frames mode). Use Lite only for tests, never for keepers. |
| 6 | **The same "AI face" expressions** (wide-eyed surprise, a frozen grin) and identical smiles | BODY_shot04, A_H1_shot02 | Veo exaggerates "nervous half-smile" and "guilty grin" | Use subtler words ("a small awkward smile", "avoids eye contact") and describe one micro-action at a time. |
| 7 | **The camera angle shifts between cuts**: the room and lamp move around from shot to shot | all shots | Each clip invents its own layout | Keep the eyelines in the room geography (§2). Better: create a "Scene" in Flow, or use Frames mode with a start frame taken from the best shot, so the set matches. |
| 8 | **Audio**: the dialogue is Veo's, and the voices may not say the scripted words; laughter and room tone are generic | all clips | Veo generates speech from the AUDIO line. It's not controllable and it varies from take to take | Check every line before using it (transcribe it). If a line is wrong, mute the clip and either dub the line ourselves (a real voice recorded on a phone, or TTS) or put it in a caption. Keep Veo's room tone and laughter quiet under the music. |
| 9 | **The policy filter and the "unusual activity" block** | A_H1_shot01 (×2), BODY_shot05/06 (first tries) | A word like "betrayal", "screams", a named real-looking person, or too many references | Avoid violent or emotional trigger words. The 3-image limit for Fast also applies to *character* references (each character counts as 2 images, portrait + body). Use portraits only. |
| 10 | **Credits**: the plan is AI Plus (200 a month plus 50 a day), not Pro | | | Plan about 10 Fast clips a week. Use the Flow agent only with exact prompts. Upscaling to 1080p is free on Plus. |

## Workflow that worked
- Characters in Flow (portrait + body, Nano Banana Pro), a ROOM image, then video with Ingredients using the portrait plus ROOM.
- Download one clip at a time: allow multiple downloads for flow.google.com in Chrome, and choose "1080p Upscaled", which takes about 1 min per clip.
- Every clip comes out at 1080×1920, 24 fps, 8 s, **with audio**.

## Checklist before keeping a take
1. Nothing in the foreground: no screens, bars, shoulders or hands.
2. Same face, clothes and room as the reference.
3. Hands have 5 fingers, nothing morphs, and no floating objects.
4. The spoken line matches the script (check the transcript).
5. The usable part is at least 1.5 s with no camera jump.
