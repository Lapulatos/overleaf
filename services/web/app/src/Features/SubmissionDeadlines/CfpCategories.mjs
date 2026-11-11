import * as cheerio from 'cheerio'
const clean = text => String(text || '').replace(/\s+/g, ' ').trim()
const key = text => clean(text).toLowerCase().replace(/[^a-z0-9]+/g, '')

// Only split an explicit submission-category list with matching sections. A list
// of research topics, an AE policy heading or a passing mention is not a Track.
export function cfpCategories(html, url) {
  const $ = cheerio.load(html)
  $('nav,header,footer,script,style').remove()
  const categories = []
  $('ol,ul').each((_, list) => {
    const introduction = clean($(list).prev('p').text())
    if (!/categor|paper types|types of papers/i.test(introduction) || !/paper|submission/i.test(introduction)) return
    $(list).children('li').each((_, item) => {
      const evidence = clean($(item).text())
      const title = evidence.replace(/\s*\([^)]*\)\s*$/, '').trim()
      if (!/papers?$/i.test(title) || title.length > 160) return
      const heading = $('h2,h3,h4').toArray().sort((a,b)=>Number(a.tagName.slice(1))-Number(b.tagName.slice(1))).find(h => key($(h).text()) === key(title) && $(h).attr('id'))
      if (!heading || categories.some(c => c.title === title)) return
      const source = new URL(url); source.hash = $(heading).attr('id')
      categories.push({title, url:source.href, evidence, headingId:$(heading).attr('id')})
    })
  })
  if (!categories.length) $('h2,h3,h4[id]').each((_, heading) => {
    const title = clean($(heading).text())
    if (!/^Artifact Evaluation Round \d+:/i.test(title) || !$(heading).attr('id')) return
    const source = new URL(url); source.hash = $(heading).attr('id')
    categories.push({title,url:source.href,evidence:title,headingId:$(heading).attr('id'),round:true})
  })
  return categories.length > 1 ? categories : []
}

export function categoryContent(html, category, categories) {
  const $ = cheerio.load(html)
  $('nav,header,footer,script,style').remove()
  if (category.round) {
    for (const sibling of categories.filter(c => c.headingId !== category.headingId)) {
      const heading = $('[id]').filter((_, el) => $(el).attr('id') === sibling.headingId).first()
      const level = Number(heading[0]?.tagName.slice(1)); let node = heading.next()
      while (node.length && !(/^h[1-6]$/.test(node[0].tagName) && Number(node[0].tagName.slice(1)) <= level)) {
        const next = node.next(); node.remove(); node = next
      }
      heading.remove()
    }
    return $.html()
  }
  // Match category names inside shared headings (e.g. regular + application).
  const family = title => title.match(/^(Regular|Tool|Application|Research|Short|Long|Industry|Industrial|Position|Experience)\b/i)?.[1].toLowerCase()
  const families = categories.map(c => family(c.title)).filter(Boolean)
  const own = family(category.title)
  const mentions = text => families.filter(f => new RegExp(`\\b${f}\\b`, 'i').test(text))
  const belongs = text => {
    const names = mentions(text)
    if (!names.length) return true
    if (/non[- ]tool/i.test(text)) return own !== 'tool'
    return names.includes(own)
  }
  // Remove sibling category sections at their own heading depth, preserving
  // shared sections (submission format, dates, review process, etc.).
  $('h2,h3,h4').toArray().forEach(heading => {
    if (!heading.parent) return
    const title = clean($(heading).text())
    if (!/papers?/i.test(title) || belongs(title)) return
    const level = Number(heading.tagName.slice(1))
    let node = $(heading).next()
    while (node.length && !(/^h[1-6]$/.test(node[0].tagName) && Number(node[0].tagName.slice(1)) <= level)) {
      const next = node.next(); node.remove(); node = next
    }
    $(heading).remove()
  })
  // Category list entries and category-specific date rows are not shared rules.
  $('li,tr').toArray().forEach(node => {
    const text = clean($(node).text())
    if ((/pages?|papers?/i.test(text)) && !belongs(text)) { $(node).remove(); return }
    const heading = $(node).closest('ul,ol').prevAll('h2,h3,h4').first().text()
    if (/camera.ready/i.test(heading) && /pages?/i.test(text)) $(node).prepend('Camera-ready: ')
  })
  return $.html()
}
