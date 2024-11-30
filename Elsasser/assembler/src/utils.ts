import * as path from "node:path";

export function getAsapRoot(): string {
	return path.resolve(__dirname, "../../../");
}

export function round(num: number, precision: number): number {
	const factor = Math.pow(10, precision);
	return Math.round(num * factor) / factor;
}