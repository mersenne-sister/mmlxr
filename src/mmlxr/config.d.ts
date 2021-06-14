declare type Config = {
	version: string;
	urlRoot: string;
	browserSupported?: boolean;
	browserRecommended?: boolean;
	importantNotice?: boolean;
};

declare var config: Config;
