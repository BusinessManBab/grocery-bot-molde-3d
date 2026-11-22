# Grocery Bot 3D map preview: Molde

A copy of [grocery-bot-3d-hills-preview](https://github.com/BusinessManBab/grocery-bot-3d-hills-preview)
built for **Molde** with the steps in [OTHER-CITIES.md](OTHER-CITIES.md):

- Real terrain: the 3D map is draped over an elevation grid of Molde (`data/terrain.bin`,
  817 × 576 samples, 0–443 m, relief ×1.25). Roads, buildings, trees, shops, trucks
  (pitched on slopes) and trails follow the ground; the board edge shows the hills in section.
- The real street network, water, the fjord and its islands, green areas and place names from
  OpenStreetMap (`data/game-map.json`), with 84 of 90 delivery homes matched to real building
  footprints (`data/buildings.json`). The map is padded south across Moldefjorden so the board is
  roughly square and Hjertøya, the island across the water, is on it. The west edge is trimmed to the detailed part of town, and Kale Storm sits about a kilometre
inside it, so the board does not end in a blank strip.
- Sea, lakes and the Moldeelva river; no trees on or next to water; the river streaks run
  downstream. Tree density rises gradually towards the northern hills and fades across OSM
  forest edges instead of stopping at a hard line.
- Bridges: roads cross water on raised decks with railings and piers; trucks drive over them.
- Clicking a player in **Standings** opens that player's shop window too (or reopens it after ×).
- Shop window (bottom right): the v1 grocerybot.no store animation (Erik's `arena.js`, ported
  to `src/shop-iso.js`) showing the robots and trucks inside a shop as the match plays, switched
  by clicking any shop; order card (left) when you click an order house.
  - The shop floor is laid out by department, not round-robin: dairy fridges at the back,
    cheese/eggs/juice beside them, breakfast and baking shelves, pantry shelves, produce bins
    and the bakery rack together, with a sign over every section. The recorded match really
    picks milk from the dairy fridges (`tools/simulate_match.py`).
  - The trucks in the bays are the player's own map trucks: `looks.js` `truckArt(look)`, with
    the same carriage, cab, visor, decal, colour and expression as the trucks driving that
    player's routes, plus the rear loading door, cargo and order tag.
- The replay is a simulated match with the user's rush-ai, recorded from the engine on the
  Molde map (`tools/simulate_match.py ... 7 molde`).
- The ten shops are spread east–west along the fjord line (Bjørsetsletta in the west to
  Nøisomhedvegen in the east), and the five replay seats open every other one so the shops
  fill the whole map. Road lines are clipped to the board so no street runs off the edge. This is not only a replay edit: the game town folder
  (`town/molde` in `astar-as/grocery-bot`) now stores the same `build.shops` list and a
  rebuilt `map.json` (`molde-bot-v3`), so a deployment gets the spread shops too.

## Landmarks

Molde's trademarks are modelled by hand in `src/landmarks.js` (MODELS `stadium`, `seilet`,
`domkirke`, `campanile`) on their real OpenStreetMap outlines, from `tools/landmarks.spec.json`
(`node tools/bake_landmarks.mjs` writes `data/landmarks.json` and the explore menu's
`data/places.json`):

- **Aker Stadion** (Kjell Kosberg, 1998) on the fjord shore at Reknes: the continuous two-tier
  bowl with rounded corners on the OSM stadium ring (outer facade, inner pitch edge), granite and
  glass facade, blue seats with a walkway between the tiers, the dark grey roof curving up from
  the facade and out over the stands, and the pitch with its markings. (It replaces the old
  `data/stadium.json` drawing.)
- **Scandic Seilet** (Kosberg, 2002), the sail-shaped 16-storey glass hotel on piles in the fjord:
  its outline tapers towards the prow as it rises, so the prow edge stays vertical and the mast
  in front of it reaches 82 m.
- **Molde domkirke** (Finn Bryn, 1957): white concrete long church, nave under a steep red tile
  roof (ridge 25 m) above the lower foyer and wings, rose window in the west gable, apse in the
  east; and the free-standing 50 m **campanile**: white shaft with balconies over a dark stone
  base, copper pyramid spire (25 m, OSM `roof:height`) with a clock gable on each side.
- Explore menu also flies to Romsdalsmuseet, Varden and Hjertøya.

All of it is one mesh per material: 6 draw calls and about 4k triangles.

## Loading

The Oslo fast-load engine: `tools/bake_buildings.mjs` packs the buildings into chunked
`data/buildings.bin` + `data/homes.json` (shared walls kept on one side only, footprints a landmark
replaces dropped), `tools/bake_trees.cjs` bakes `data/trees.bin` (run it where Chromium has a GPU),
and the page builds chunk meshes in module workers nearest-first (`src/city-stream.js`). Order:
landmarks, buildings, trees. Measured on a GTX 1070: 3D view with all 8,103 buildings in about
2.9 s, 60 fps; no flicker between sub-pixel camera moves.

To make this for another town, follow [OTHER-CITIES.md](OTHER-CITIES.md) (data scripts in
`tools/build_city.py`).

Switch views with the 2D / 3D buttons (or V, or `?view=3d`).

Elevation: Mapzen Terrarium tiles (AWS Open Data). Map data © OpenStreetMap contributors (ODbL).
