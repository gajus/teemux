declare module 'ansi-to-html' {
  interface Options {
    bg?: string;
    colors?: Record<number, string> | string[];
    escapeXML?: boolean;
    fg?: string;
    newline?: boolean;
    stream?: boolean;
  }

  class Convert {
    constructor(options?: Options);
    toHtml(input: string): string;
  }

  export default Convert;
}
