declare type Config = {
	deploy: {
		commitHash: string;
		version: string;
		environment: string;
	};
	urlRoot: string;
	github: {
		clientId: string;
	};
	googleDrive: {
		clientId: string;
		browserKey: string;
		scope: string;
	};
	browserSupported?: boolean;
	browserRecommended?: boolean;
};

declare var config: Config;
