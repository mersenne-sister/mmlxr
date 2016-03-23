// Compiled using typings@0.6.8
// Source: https://raw.githubusercontent.com/DefinitelyTyped/DefinitelyTyped/b1ce1cc514dabd8bdbfa9a6c41fedd04af00043b/sanitize-filename/sanitize-filename.d.ts
// Type definitions for sanitize-filename v1.1.1
// Project: https://github.com/parshap/node-sanitize-filename
// Definitions by: Wim Looman <https://github.com/Nemo157>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

declare module "sanitize-filename" {
	function sanitize(filename: string, options?: sanitize.Options): string;

	module sanitize {
		interface Options {
			replacement: string;
		}
	}

	export = sanitize;
}