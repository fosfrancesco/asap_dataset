import {MidiIoEvent, MidiIoEventSubtype} from "midi-file-io";

/**
 * I adhered to the names documented here:
 * https://en.wikipedia.org/wiki/Interval_(music)
 */
export enum NoteInterval {
	PerfectUnison = "P1",
	MinorSecond = "m2",
	MajorSecond = "M2",
	MinorThird = "m3",
	MajorThird = "M3",
	PerfectFourth = "P4",
	DiminishedFifth = "d5",
	PerfectFifth = "P5",
	MinorSixth = "m6",
	MajorSixth = "M6",
	MinorSeventh = "m7",
	MajorSeventh = "M7"
}

export interface Composer {
	name: string;
	yearBorn: number;
	yearDied?: number;
}

export interface CsvFile {
	data: {
		composer: string,
		yearBorn: number,
		yearDied: number,
		title: string,
		folder: string,
		xml_score: string,
		midi_score: string,
		performer: string,
		midi_performance: string,
		performance_annotations: string,
		midi_score_annotations: string,
		maestro_midi_performance: string,
		maestro_audio_performance: string,
		start: number,
		end: number,
		audio_performance: string,
		csv_score: string,
		csv_performance: string
	}[];
	header: string[];
	path: string;
}

export interface MidiIoEventAbs extends MidiIoEvent {
	/**
	 * See metrics::calculateNoteDensity for more information
	 */
	density?: number;
	/**
	 * See metrics::calculateNoteInterval for more information
	 */
	interval?: string;
	tickOffset: number;
	tickLength: number;
}

/**
 * There is no means of extending an enum that I like. The following is
 * the best of the worst. It would be really nice if one could extend enums.
 */
export const MidiIoEventSubtypeExt = {
	...MidiIoEventSubtype,
	TicksPerQuarter: "ticksPerQuarter"
}

export type MidiIoTrackAbs = MidiIoEventAbs[];