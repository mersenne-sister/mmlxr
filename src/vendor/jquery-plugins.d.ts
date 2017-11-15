interface JQuery {
	checkbox(opts?: any): JQuery;
	form(opts?: any): JQuery;
	form(cmd: string, opts?: any): any;
	hammer(opts?: any): JQuery;
	forceIntegerInput(min: number|Function, max: number|Function): JQuery;
	splitter(opts?: any): JQuery;
	splitter(cmd: string, opts?: any): JQuery;
	tablesort(opts?: any): JQuery;
}

interface JQueryStatic {
	browser: any;
}

declare type JQueryizable = JQuery|any[]|Element|Text|string;
