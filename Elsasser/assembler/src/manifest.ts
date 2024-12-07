import {writeToPath} from "fast-csv";
import * as path from "node:path";
import {getComposer} from "./composers";
import {readCsvFile} from "./csv";
import * as file from "./file";
import {CsvFile} from "./types";
import {getAsapRoot} from "./utils";

// ********************************************************************
// Exported API
// ********************************************************************
export async function execute(pathCSV: string): Promise<void> {
	const list = await getMidiFileList(pathCSV);
	await processMidiFileList(list);
	await updateMidiFileList(pathCSV);
}

// ********************************************************************
// Internal API
// ********************************************************************
async function getMidiFileList(pathCSV: string): Promise<string[]> {
	const csvData: CsvFile = await readCsvFile(pathCSV);
	return csvData.data.reduce((list, line): string[] => {
		list.push(line["midi_performance"])
		if (list.indexOf(line["midi_score"]) < 0) {
			list.push(line["midi_score"])
		}
		return list;
	}, []);
}

export function toNameCase(name: string): string {
	return name.match(/^[A-Z]+$/)
		? name[0] + name.slice(1)
		.toLowerCase()
		: name;
}

async function updateMidiFileList(pathCSV: string): Promise<void> {
	const csvData: CsvFile = await readCsvFile(pathCSV);
	csvData.data.forEach((line) => {
		const composer = getComposer(line.composer);
		line.performer = toNameCase(line.midi_performance.match(/\/([a-zA-Z]+)[^\/]+$/)[1]);
		line.csv_score = line.midi_score.replace(/\.mid$/, ".csv");
		line.csv_performance = line.midi_performance.replace(/\.mid$/, ".csv");
		line.yearBorn = composer.yearBorn;
		line.yearDied = composer.yearDied;
	});
	if (csvData.header.indexOf("csv_score") < 0) {
		csvData.header.push("csv_score");
	}
	if (csvData.header.indexOf("performer") < 0) {
		csvData.header.splice(csvData.header.indexOf("midi_score") + 1, 0, "performer");
	}
	if (csvData.header.indexOf("csv_performance") < 0) {
		csvData.header.push("csv_performance");
	}
	if (csvData.header.indexOf("year_born") < 0) {
		csvData.header.splice(csvData.header.indexOf("composer") + 1, 0, "year_born");
	}
	if (csvData.header.indexOf("year_died") < 0) {
		csvData.header.splice(csvData.header.indexOf("year_born") + 1, 0, "year_died");
	}
	return new Promise((resolve, reject) => {
		writeToPath(pathCSV, csvData.data, {headers: csvData.header})
			.on("finish", resolve)
			.on("error", (error) => {
				reject(new Error(`Error writing ${path}: ${error}`));
			});
	})
}

async function processMidiFileList(list: string[]): Promise<void> {
	const asapRoot = getAsapRoot();
	for (const pathMidiRelative of list) {
		const pathMidiFull = path.join(asapRoot, pathMidiRelative);
		const pathCsvFull = pathMidiFull.replace(/\.mid$/, ".csv");
		console.log(`processing: ${pathMidiFull} -> ${pathCsvFull}`);
		await file.execute(pathMidiFull, pathCsvFull);
	}
}

