import {parseFile} from "fast-csv";
import {CsvFile} from "./types";

export async function readCsvFile(path: string): Promise<CsvFile> {
	return new Promise((resolve, reject) => {
		const result: CsvFile = {
			data: [],
			header: [],
			path,
		}
		parseFile(path, {
			headers: true,
			trim: true
		})
			.on("data", (row) => {
				result.data.push(row);
			})
			.on("end", () => {
				result.header = Object.keys(result.data[0]);
				resolve(result);
			})
			.on("error", reject);
	});
}