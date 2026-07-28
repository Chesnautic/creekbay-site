// update-drops.mjs
// Pulls each Creek Bay artist's latest Spotify release and writes drops.json.
// Runs on a schedule via GitHub Actions (see weekly-drops.yml). No server needed.
//
// Requires env vars (set as GitHub repo secrets):
//   SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
// Get them free at https://developer.spotify.com/dashboard (create an app).

import { writeFileSync } from "node:fs";

// slug -> Spotify artist id (only artists that are on Spotify)
const ARTISTS = {
  turboslidechamp:   "3ibyBu0i4F2c0JFEFZO46V",
  pkcentral:         "5LqLBo6r9xFDxrHGUXdgCV",
  "e-the-experience":"5jb3jSXysAqFNoOUwTT2gk",
  "00hunnid":        "3sl4ePbAvaIyVfny4hE4bj",
  ura:               "5liw4Ntztxx81MLLsiklZm",
  creekbay:          "0R4xb9TxlzWfdSzUTeraMg", // label
};

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET env vars.");
  process.exit(1);
}

async function getToken() {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("Token request failed: " + res.status);
  return (await res.json()).access_token;
}

async function latestRelease(token, artistId) {
  const url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=single,album&market=US&limit=10`;
  const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  if (!res.ok) throw new Error("Albums request failed: " + res.status);
  const items = (await res.json()).items || [];
  if (!items.length) return null;
  items.sort((a, b) => (b.release_date || "").localeCompare(a.release_date || ""));
  const r = items[0];
  return {
    title: r.name,
    releaseDate: r.release_date,
    type: r.album_type,
    url: r.external_urls?.spotify || "",
    cover: r.images?.[0]?.url || "",
  };
}

const token = await getToken();
const out = { updated: new Date().toISOString(), drops: {} };
for (const [slug, id] of Object.entries(ARTISTS)) {
  try {
    out.drops[slug] = await latestRelease(token, id);
    console.log(slug, "->", out.drops[slug]?.title ?? "(none)");
  } catch (e) {
    console.error(slug, "failed:", e.message);
  }
}
writeFileSync("drops.json", JSON.stringify(out, null, 2));
console.log("Wrote drops.json");
