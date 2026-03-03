/**
 * Type declarations for @asciidoctor/core
 * These are minimal types - the actual types should come from the package
 */
declare module '@asciidoctor/core' {
  interface ConvertOptions {
    safe?: string;
    backend?: string;
    doctype?: string;
    attributes?: Record<string, any>;
    extension_registry?: any;
  }

  interface Asciidoctor {
    convert(content: string, options?: ConvertOptions): string | any;
  }

  function asciidoctor(): Asciidoctor;
  export default asciidoctor;
}
