declare class Octokat {
	constructor(opts: any);
	gists: {
		fetch(): Promise<any[]>;
		(id: string): {
			fetch(): Promise<any>;
		};
	};
}

declare module 'octokat' {
	export = Octokat;
}
