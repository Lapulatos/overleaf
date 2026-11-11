# Globe land geometry

`land-110m.json` is the Natural Earth 1:110m land dataset, retrieved 2026-11-04 from:
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson

Natural Earth data is public domain: https://www.naturalearthdata.com/about/terms-of-use/

The GeoJSON is bundled locally so opening the globe does not download a world map or send user coordinates to a map provider. Street tiles are requested only for the destination's local map from OpenStreetMap, with visible attribution and ordinary browser caching. No tile prefetch or offline bulk download is performed.
