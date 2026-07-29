// update-drops.mjs
// Pulls each Creek Bay artist's Spotify catalog. Writes:
//   drops.json     -> each artist's single latest release (for "Latest drop")
//   releases.json  -> each artist's full release list (for the page gallery)
// Runs on a schedule via GitHub Actions (see weekly-drops.yml). No server needed.
//
// Requires env vars (set as GitHub repo secrets):
//   SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
// Get them free at https://developer.spotify.com/dashboard (create an app).

import { writeFileSync } from "node:fs";

const ARTISTS = {
  turboslidechamp:   "3ibyBu0i4F2c0JFEFZO46V",
  pkcentral:         "5LqLBo6r9xFDxrHGUXdgCV",
  "e-the-experience":"5jb3jSXysAqFNoOUwTT2gk",
  "00hunnid":        "3sl4ePbAvaIyVfny4hE4bj",
  ura:               "5liw4Ntztxx81MLLsiklZm",
  creekbay:          "0R4xb9TxlzWfdSzUTeraMg",
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

async function allReleases(token, artistId) {
  let url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=single,album&market=US&limit=50`;
  const items = [];
  while (url) {
    const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) throw new Error("Albums request failed: " + res.status);
    const data = await res.json();
    items.push(...(data.items || []));
    url = data.next;
  }
  const seen = new Set();
  return items
    .map((r) => ({
      title: r.name,
      releaseDate: r.release_date,
      type: r.album_type,
      url: r.external_urls?.spotify || "",
      cover: r.images?.[0]?.url || "",
    }))
    .filter((r) => (seen.has(r.title) ? false : seen.add(r.title)))
    .sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
}

const token = await getToken();
const drops = { updated: new Date().toISOString(), drops: {} };
const releases = { updated: new Date().toISOString(), releases: {} };

for (const [slug, id] of Object.entries(ARTISTS)) {
  try {
    const list = await allReleases(token, id);
    releases.releases[slug] = list;
    drops.drops[slug] = list[0] || null;
    console.log(slug, "->", list.length, "releases; latest:", list[0]?.title ?? "(none)");
  } catch (e) {
    console.error(slug, "failed:", e.message);
  }
}

writeFileSync("drops.json", JSON.stringify(drops, null, 2));
writeFileSync("releases.json", JSON.stringify(releases, null, 2));
console.log("Wrote drops.json and releases.json");
