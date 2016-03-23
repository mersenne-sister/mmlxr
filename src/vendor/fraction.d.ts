declare class Fraction {
	constructor(numerator: number, denominator: number);
	n: number;
	d: number;
	s: number;
	toFraction(excludeWhole?: boolean): string;
}

declare module 'fraction.js' {
	export = Fraction;
}
