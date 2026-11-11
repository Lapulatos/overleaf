// Paraphrased from the exact official edition homepage, verified 2026-11-04.
// Only a matching official URL may use this fallback when live retrieval fails.
const overviews = new Map([
 ['https://conf.researchr.org/home/fse-2027', {
  text:'FSE connects software engineering researchers, industry practitioners and educators to discuss new methods, emerging challenges and lessons from practice. Its program spans research results, industrial applications, tools, education and new research directions, with an emphasis on exchanging ideas between academia and industry.',
  source:'https://conf.researchr.org/home/fse-2027', checked:'2026-11-04',
 }],
])
export function verifiedVenueOverview(venue){return overviews.get(venue.website?.replace(/\/$/,''))||null}
