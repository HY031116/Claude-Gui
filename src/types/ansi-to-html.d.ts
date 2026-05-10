declare module 'ansi-to-html' {
  interface Options {
    fg?: string;
    bg?: string;
    newline?: boolean;
    escapeXML?: boolean;
    stream?: boolean;
    colors?: Record<string, string> | string[];
  }

  class Convert {
    constructor(options?: Options);
    toHtml(ansi: string): string;
  }

  export = Convert;
}
