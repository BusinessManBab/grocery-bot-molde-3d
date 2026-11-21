# Grocery Bot 3D map preview: Molde

A copy of [grocery-bot-3d-hills-preview](https://github.com/BusinessManBab/grocery-bot-3d-hills-preview)
built for **Molde** with the steps in [OTHER-CITIES.md](OTHER-CITIES.md):

- Real terrain: the 3D map is draped over an elevation grid of Molde (`data/terrain.bin`,
  880 × 576 samples, 0–443 m, relief ×1.25). Roads, buildings, trees, shops, trucks
  (pitched on slopes) and trails follow the ground; the board edge shows the hills in section.
- The real street network, water, the fjord and its islands, green areas and place names from
  OpenStreetMap (`data/game-map.json`), with 84 of 90 delivery homes matched to real building
  footprints (`data/buildings.json`). The map is padded south across Moldefjorden so the board is
  roughly square and Hjertøya, the island across the water, is on it. The west edge is trimmed to
the OpenStreetMap detail boundary, so the board does not end in a blank strip.
- Sea, lakes and the Moldeelva river; no trees on or next to water; the river streaks run
  downstream.
- Bridges: roads cross water on raised decks with railings and piers; trucks drive over them.
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
- The ten shops are spread east–west along the fjord line (Anevegen in the west to
  Nøisomhedvegen in the east), and the five replay seats open every other one so the shops
  fill the whole map. This is not only a replay edit: the game town folder
  (`town/molde` in `astar-as/grocery-bot`) now stores the same `build.shops` list and a
  rebuilt `map.json` (`molde-bot-v3`), so a deployment gets the spread shops too.

To make this for another town, follow [OTHER-CITIES.md](OTHER-CITIES.md) (data scripts in
`tools/build_city.py`).

Switch views with the 2D / 3D buttons (or V, or `?view=3d`).

Elevation: Mapzen Terrarium tiles (AWS Open Data). Map data © OpenStreetMap contributors (ODbL).
