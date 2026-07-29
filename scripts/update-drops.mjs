// update-drops.mjs
// Creek Bay Spotify catalog updater
//
// Outputs:
//   drops.json     -> latest official release per artist
//   releases.json  -> official catalog + featured appearances

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
  SPOTIFY_CLIENT_SECRET,
} = process.env;


if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  throw new Error(
    "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET"
  );
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
          "application/x-www-form-urlencoded",
      },
      body:
        "grant_type=client_credentials",
    }
  );


  const data = await res.json();


  if (!res.ok) {
    throw new Error(
      JSON.stringify(data)
    );
  }


  return data.access_token;
}



async function spotifyFetch(url, token) {

  const res = await fetch(url, {
    headers: {
      Authorization:
        `Bearer ${token}`,
    },
  });


  if (res.status === 429) {
    const wait =
      Number(res.headers.get("Retry-After") || 2);

    console.log(
      `Rate limited. Waiting ${wait}s`
    );

    await new Promise(
      r => setTimeout(r, wait * 1000)
    );

    return spotifyFetch(url, token);
  }


  const data = await res.json();


  if (!res.ok) {
    throw new Error(
      JSON.stringify(data)
    );
  }


  return data;
}



// Get Spotify artist profile
async function getArtist(token, id) {

  return spotifyFetch(
    `https://api.spotify.com/v1/artists/${id}`,
    token
  );

}



// Get official albums/singles
async function getOfficialReleases(token, id) {

  let url =
    `https://api.spotify.com/v1/artists/${id}/albums?include_groups=album,single`;


  const results = [];


  while (url) {

    const page =
      await spotifyFetch(url, token);


    results.push(
      ...page.items
    );


    url = page.next;

  }


  return results;

}



// Search releases where artist appears
async function getFeaturedReleases(token, artistName) {

  const query =
    encodeURIComponent(
      `"${artistName}"`
    );


  const data =
    await spotifyFetch(
      `https://api.spotify.com/v1/search?q=${query}&type=track&limit=10`,
      token
    );


  const albums = [];


  for (const track of data.tracks.items) {

    const appears =
      track.artists.some(
        artist =>
          artist.name.toLowerCase() ===
          artistName.toLowerCase()
      );


    if (appears) {
      albums.push(track.album);
    }

  }


  return albums;

}



function cleanReleaseList(items) {

  const seen =
    new Set();


  return items
    .filter(item => {

      if (!item?.id)
        return false;


      if (seen.has(item.id))
        return false;


      seen.add(item.id);

      return true;

    })


    .map(item => ({

      id: item.id,

      title: item.name,

      releaseDate:
        item.release_date,

      type:
        item.album_type,

      cover:
        item.images?.[0]?.url || "",

      url:
        item.external_urls?.spotify || "",

    }))


    .sort((a,b) =>
      new Date(b.releaseDate || 0) -
      new Date(a.releaseDate || 0)
    );

}



const token =
  await getToken();


const drops = {
  updated:
    new Date().toISOString(),

  drops: {},
};


const releases = {
  updated:
    new Date().toISOString(),

  releases: {},
};



for (const [slug, id] of Object.entries(ARTISTS)) {

  console.log(`\n=== ${slug} ===`);


  try {

    const artist =
      await getArtist(
        token,
        id
      );


    console.log(
      "Spotify name:",
      artist.name
    );


    const officialRaw =
      await getOfficialReleases(
        token,
        id
      );


    const official =
      cleanReleaseList(
        officialRaw
      );


    let featured = [];


    if (official.length === 0) {

      console.log(
        "No official releases. Searching features..."
      );


      featured =
        cleanReleaseList(
          await getFeaturedReleases(
            token,
            artist.name
          )
        );

    }


    releases.releases[slug] = {

      spotifyName:
        artist.name,

      official,

      featured,

    };


    drops.drops[slug] =
      official[0] || null;


    console.log(
      `Official: ${official.length}`
    );

    console.log(
      `Featured: ${featured.length}`
    );


  } catch (error) {

    console.error(
      `Failed ${slug}:`,
      error.message
    );


    releases.releases[slug] = {

      official: [],

      featured: [],

    };


    drops.drops[slug] = null;

  }

}



writeFileSync(
  "drops.json",
  JSON.stringify(
    drops,
    null,
    2
  )
);


writeFileSync(
  "releases.json",
  JSON.stringify(
    releases,
    null,
    2
  )
);


console.log(
  "\n✅ Spotify catalog update complete"
);
