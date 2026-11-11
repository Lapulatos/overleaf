declare module 'marked' {
  export const marked: { parse(input: string, options?: {gfm?: boolean; mangle?: boolean; headerIds?: boolean}): string }
}
