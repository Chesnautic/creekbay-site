import { writeFileSync } from "node:fs";

const ARTISTS = {
  turboslidechamp: "3ibyBu0i4F2c0JFEFZO46V",
  pkcentral: "5LqLBo6r9xFDxrHGUXdgCV",
  "e-the-experience": "5jb3jSXysAqFNoOUwTT2gk",
  "00hunnid": "3sl4ePbAvaIyVfny4hE4bj",
  ura: "5liw4Ntztxx81MLLsiklZm",
  creekbay: "0R4xb9TxlzWfdSzUTeraMg",
};

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET
} = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  throw new Error("Missing Spotify credentials.");
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function spotifyFetch(url, token) {
  while (true) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.status === 429) {
      const retry = Number(res.headers.get("Retry-After") || 1);
      console.log(`Rate limited. Waiting ${retry}s...`);
      await sleep(retry * 1000);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Spotify ${res.status}\n${url}\n${body}`
      );
    }

    return res.json();
  }
}

async function getToken() {
  const res = await fetch(
    "https://accounts.spotify.com/api/token",
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
          ).toString("base64"),
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const json = await res.json();

  console.log("✓ Spotify token acquired");

  return json.access_token;
}

async function getArtistReleases(token, artistId) {

  let url =
    `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single`;

  const albums = [];

  while (url) {

    console.log("Fetching", url);

    const page = await spotifyFetch(url, token);

    albums.push(...page.items);

    url = page.next;
  }

  const seen = new Set();

  return albums
    .filter(album => {

      if (seen.has(album.id))
        return false;

      seen.add(album.id);

      return true;

    })
    .map(album => ({

      id: album.id,

      title: album.name,

      releaseDate: album.release_date,

      type: album.album_type,

      url: album.external_urls?.spotify ?? "",

      cover: album.images?.[0]?.url ?? ""

    }))
    .sort((a, b) =>
      new Date(b.releaseDate) -
      new Date(a.releaseDate)
    );

}

const token = await getToken();

const drops = {
  updated: new Date().toISOString(),
  drops: {}
};

const releases = {
  updated: new Date().toISOString(),
  releases: {}
};

for (const [slug, artistId] of Object.entries(ARTISTS)) {

  console.log(`\n=== ${slug} ===`);

  try {

    const list = await getArtistReleases(
      token,
      artistId
    );

    releases.releases[slug] = list;

    drops.drops[slug] = list[0] ?? null;

    console.log(
      `✓ ${list.length} releases`
    );

  } catch (err) {

    console.error(err.message);

    releases.releases[slug] = [];

    drops.drops[slug] = null;

  }

}

writeFileSync(
  "drops.json",
  JSON.stringify(drops, null, 2)
);

writeFileSync(
  "releases.json",
  JSON.stringify(releases, null, 2)
);

console.log("\nDone.");
