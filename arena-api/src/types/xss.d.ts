// declaration بۆ پاکێجی xss (هەندێک کات types نادات)
declare module 'xss' {
  interface IFilterXSSOptions {
    whiteList?: Record<string, string[]>;
    onTag?: (tag: string, html: string, options: IFilterXSSOptions) => string;
    onIgnoreTag?: (tag: string, html: string, options: IFilterXSSOptions) => string;
    onTagAttr?: (
      tag: string,
      name: string,
      value: string,
      options: IFilterXSSOptions,
    ) => string;
    onIgnoreTagAttr?: (
      tag: string,
      name: string,
      value: string,
      options: IFilterXSSOptions,
    ) => string;
    safeAttrValue?: (tag: string, name: string, value: string) => boolean;
    stripIgnoreTag?: boolean;
    stripIgnoreTagBody?: string[] | boolean;
    allowCommentTag?: boolean;
    escape?: Record<string, string>;
  }

  function xss(str: string, options?: IFilterXSSOptions | string[]): string;
  namespace xss {
    function filterHtml(str: string, options?: IFilterXSSOptions | string[]): string;
    const stripTagWhitelist: string[];
  }
  export = xss;
}
