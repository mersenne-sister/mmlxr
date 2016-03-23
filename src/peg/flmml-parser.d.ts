declare class FlmmlParser {
    static parse(src:string): any;
}

declare module 'flmml-parser' {
    export = FlmmlParser;
}
