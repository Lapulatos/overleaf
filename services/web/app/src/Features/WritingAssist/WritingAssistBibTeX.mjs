import { AgentError } from "./WritingAssistAgentService.mjs";

// Small lossless scanner for review/import: balanced values, quoted values,
// concatenation and macros are retained. Never silently claim macros resolved.
export function parseBibliography(input) {
  if (typeof input !== "string" || input.length > 500000)
    throw new AgentError(422, "Bibliography exceeds the supported size limit");
  let pos = 0;
  const entries = [];
  const special = [];
  const markup = [];
  const skip = () => {
    while (pos < input.length) {
      if (/\s/.test(input[pos])) pos++;
      else if (input[pos] === "%") {
        while (pos < input.length && input[pos] !== "\n") pos++;
      } else break;
    }
  };
  const fail = () => {
    throw new AgentError(
      422,
      `Cannot parse BibTeX near character ${pos + 1}; check balanced braces and field syntax`,
    );
  };
  const balanced = (open, close) => {
    const start = ++pos;
    let depth = 1;
    while (pos < input.length) {
      if (input[pos] === "\\") {
        pos += 2;
        continue;
      }
      if (input[pos] === open) depth++;
      if (input[pos] === close && --depth === 0)
        return input.slice(start, pos++);
      pos++;
    }
    fail();
  };
  // Separate brace reader avoids interpreting quotes inside protected titles.
  const braces = () => {
    const start = ++pos;
    let depth = 1;
    while (pos < input.length) {
      const char = input[pos++];
      if (char === "\\") {
        pos++;
        continue;
      }
      if (char === "{") depth++;
      if (char === "}" && --depth === 0) return input.slice(start, pos - 1);
    }
    fail();
  };
  const quoted = () => {
    const start = ++pos;
    let depth = 0;
    while (pos < input.length) {
      const char = input[pos++];
      if (char === "\\") {
        pos++;
        continue;
      }
      if (char === "{") depth++;
      if (char === "}") depth--;
      if (char === '"' && depth === 0) return input.slice(start, pos - 1);
    }
    fail();
  };
  while (pos < input.length) {
    skip();
    // Only remove complete clipboard HTML elements BETWEEN entries. Never
    // interpret or execute markup and never strip comparison operators in fields.
    const html = input.slice(pos).match(/^<(a|svg|script|style|img|image)\b[^>]*>/i);
    if (html) {
      const closeTag = new RegExp(`</${html[1]}\\s*>`, 'i');
      const rest = input.slice(pos + html[0].length);
      const endTag = rest.match(closeTag);
      const length = /\/\s*>$/.test(html[0]) || html[1].toLowerCase() === 'img'
        ? html[0].length : endTag ? html[0].length + endTag.index + endTag[0].length : 0;
      if (!length) fail();
      markup.push({ start: pos, end: pos + length });
      pos += length;
      continue;
    }
    if (input[pos] !== "@") {
      pos++;
      continue;
    }
    const start = pos++;
    const match = input.slice(pos).match(/^[a-zA-Z]+/);
    if (!match) fail();
    const type = match[0].toLowerCase();
    pos += match[0].length;
    skip();
    const open = input[pos];
    const close = open === "{" ? "}" : ")";
    if (!["{", "("].includes(open)) fail();
    if (["comment", "preamble", "string"].includes(type)) {
      if (open === "{") braces();
      else balanced("(", ")");
      special.push(type);
      continue;
    }
    pos++;
    skip();
    const keyStart = pos;
    while (pos < input.length && ![",", close].includes(input[pos])) pos++;
    const key = input.slice(keyStart, pos).trim();
    if (!key || /[\s{}()]/.test(key) || input[pos] !== ",") fail();
    pos++;
    const fields = {};
    const unresolved = [];
    const spans = {};
    while (pos < input.length) {
      skip();
      if (input[pos] === close) {
        pos++;
        break;
      }
      if (input[pos] === ",") {
        pos++;
        continue;
      }
      const fieldMatch = input.slice(pos).match(/^[a-zA-Z][a-zA-Z0-9_-]*/);
      if (!fieldMatch) fail();
      const name = fieldMatch[0].toLowerCase();
      pos += fieldMatch[0].length;
      skip();
      if (input[pos++] !== "=") fail();
      skip();
      const valueStart = pos;
      let value = "";
      let unknown = false;
      do {
        skip();
        if (input[pos] === "{") value += braces();
        else if (input[pos] === '"') value += quoted();
        else {
          const token = input.slice(pos).match(/^[^\s,#{}()]+/);
          if (!token) fail();
          value += token[0];
          pos += token[0].length;
          if (!/^\d+$/.test(token[0]) && !(name === 'month' && /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i.test(token[0]))) unknown = true;
        }
        skip();
        if (input[pos] !== "#") break;
        pos++;
      } while (pos < input.length);
      if (Object.hasOwn(fields, name)) fail();
      spans[name] = { start: valueStart - start, end: pos - start };
      fields[name] = value;
      if (unknown) unresolved.push(name);
      if (![",", close].includes(input[pos])) fail();
    }
    if (input[pos - 1] !== close) fail();
    entries.push({
      key,
      type,
      fields,
      unresolved,
      spans,
      raw: input.slice(start, pos),
      start,
      end: pos,
    });
    if (entries.length > 2000)
      throw new AgentError(422, "Bibliography contains too many entries");
  }
  return { entries, special, markup };
}
export function readableBibText(value = "") {
  return value
    .replace(/\\([%&#_$])/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
export function citationContexts(documents, keys) {
  const selected = new Set(keys);
  const result = [];
  for (const doc of documents.filter((doc) => /\.tex$/i.test(doc.path))) {
    // Keep line locations stable while excluding TeX comments.
    const text = doc.content.replace(/(?<!\\)%[^\n]*/g, (match) =>
      " ".repeat(match.length),
    );
    const pattern =
      /\\(?:[a-zA-Z]*cite[a-zA-Z]*|nocite)\*?\s*(?:\[[^\]]*\]\s*){0,2}\{([^{}]+)\}/g;
    for (const match of text.matchAll(pattern)) {
      if (match[0].startsWith("\\nocite")) continue;
      const cited = match[1]
        .split(",")
        .map((key) => key.trim())
        .filter((key) => selected.has(key));
      if (!cited.length) continue;
      let start = Math.max(
        text.lastIndexOf("\n\n", match.index) < 0 ? 0 : text.lastIndexOf("\n\n", match.index) + 2,
        match.index - 1200,
        0,
      );
      const next = text.indexOf("\n\n", match.index + match[0].length);
      let end = Math.min(
        next < 0 ? text.length : next,
        match.index + match[0].length + 1200,
      );
      // Focus on the cited sentence. Ignore punctuation inside TeX braces.
      let depth=0;
      for(let i=start;i<match.index;i++) {
        if(text[i]==='{' && text[i-1]!=='\\')depth++;
        if(text[i]==='}' && text[i-1]!=='\\')depth=Math.max(0,depth-1);
        if(depth===0 && /[.!?]/.test(text[i]) && /\s/.test(text[i+1]||''))start=i+1;
      }
      depth=0;
      for(let i=match.index+match[0].length;i<end;i++) {
        if(text[i]==='{' && text[i-1]!=='\\')depth++;
        if(text[i]==='}' && text[i-1]!=='\\')depth=Math.max(0,depth-1);
        if(depth===0 && /[.!?]/.test(text[i]) && (!text[i+1] || /\s/.test(text[i+1]))) {end=i+1;break;}
      }
      result.push({
        path: doc.path,
        line: text.slice(0, match.index).split("\n").length,
        keys: cited,
        text: doc.content.slice(start, end).trim(),
      });
      if (result.length >= 200) return { contexts: result, truncated: true };
    }
  }
  return { contexts: result, truncated: false };
}
