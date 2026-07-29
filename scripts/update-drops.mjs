// update-drops.mjs
// Pulls each Creek Bay artist's Spotify catalog and writes:
//   drops.json     -> latest release
//   releases.json  -> full release list

import { writeFileSync } from "node:fs";

const ARTISTS = {
  turboslidechamp: "3ibyBu0i4F2c0JFEFZO46V",
  pkcentral: "5LqLBo6r9xFDxrHGUXdgCV",
  "e-the-experience": "5jb3jSXysAqFNoOUwTT2gk",
  "00hunnid": "3sl4ePbAvaIyVfny4hE4bj",
  ura: "5liw4Ntztxx81MLLsiklZm",
  creekbay: "0R4xb9TxlzWfdSzUTeraMg",
};

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error("❌ Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET.");
  process.exit(1);
}

async function getToken() {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
        ).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });

  const body = await res.text();

  if (!res.ok) {
    console.error("❌ TOKEN REQUEST FAILED");
    console.error("Status:", res.status);
    console.error(body);
    process.exit(1);
  }

  const json = JSON.parse(body);

  console.log("✅ Spotify token received.");

  return json.access_token;
}

async function allReleases(token, artistId) {
  let url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=20`;

  const items = [];

  while (url) {
    console.log("Fetching:", url);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const body = await res.text();

      console.error("\n❌ SPOTIFY REQUEST FAILED");
      console.error("Artist ID:", artistId);
      console.error("Status:", res.status);
      console.error("URL:", url);
      console.error("Response:");
      console.error(body);

      throw new Error(`Spotify returned ${res.status}`);
    }

    const data = await res.json();

    items.push(...(data.items || []));

    url = data.next;
  }

  const seen = new Set();

  return items
    .map((r) => ({
      id: r.id,
      title: r.name,
      releaseDate: r.release_date,
      type: r.album_type,
      url: r.external_urls?.spotify ?? "",
      cover: r.images?.[0]?.url ?? "",
    }))
    .filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.releaseDate).getTime() -
        new Date(a.releaseDate).getTime()
    );
}

const token = await getToken();

const drops = {
  updated: new Date().toISOString(),
  drops: {},
};

const releases = {
  updated: new Date().toISOString(),
  releases: {},
};

for (const [slug, artistId] of Object.entries(ARTISTS)) {
  console.log(`\n=== ${slug} ===`);

  try {
    const list = await allReleases(token, artistId);

    releases.releases[slug] = list;
    drops.drops[slug] = list[0] || null;

    console.log(
      `✅ ${slug}: ${list.length} releases`
    );
  } catch (err) {
    console.error(`❌ ${slug} failed`);
    console.error(err);
  }
}

writeFileSync("drops.json", JSON.stringify(drops, null, 2));
writeFileSync("releases.json", JSON.stringify(releases, null, 2));

console.log("\n✅ Finished writing drops.json and releases.json");
