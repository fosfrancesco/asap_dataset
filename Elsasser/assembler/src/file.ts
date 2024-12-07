import {
	format,
	FormatterRow
} from "fast-csv"
import {
	MidiIoEvent,
	MidiIoEventSubtype,
	MidiIoEventType,
	MidiIoHeader,
	MidiIoSong,
	MidiIoTrack,
	parseMidiFile
} from "midi-file-io"
import {createWriteStream} from "node:fs";
import {
	formatKeySignatureValuePretty,
	formatKeySignatureValueRaw,
	formatNoteValueCanonical,
	formatNoteValuePretty,
	formatNoteValueRaw,
	formatTempoValuePretty,
	formatTempoValueRaw,
	formatTimeSignatureValuePretty,
	formatTimeSignatureValueRaw
} from "./format";
import {
	calculateNoteDensity,
	calculateNoteInterval
} from "./metrics";
import {
	MidiIoEventAbs,
	MidiIoEventSubtypeExt,
	MidiIoTrackAbs
} from "./types";
import {round} from "./utils";

/**
 * Whether we write narrow or wide rectangular dataframe:
 * - narrow - space efficient, but more difficult to analyze (in R)
 * - wide - a lot of data redundancy, but easier to work with
 */
enum EncodeWidth {
	Wide = "wide",
	Narrow = "narrow"
}

const encodeWidth = EncodeWidth.Wide;
const sortMap = new Map<MidiIoEventSubtype, number>();
sortMap.set(MidiIoEventSubtypeExt.TicksPerQuarter as MidiIoEventSubtype, 0);
sortMap.set(MidiIoEventSubtype.KeySignature, 1);
sortMap.set(MidiIoEventSubtype.TimeSignature, 2);
sortMap.set(MidiIoEventSubtype.SetTempo, 3);
sortMap.set(MidiIoEventSubtype.NoteOn, 4);


// ********************************************************************
// Exported API
// ********************************************************************
export async function execute(pathMIDI: string, pathCSV: string): Promise<void> {
	return new Promise((resolve, reject) => {
		try {
			const song = parseMidiFile(pathMIDI);
			const rect = rectanglify(song);
			writeCSV(pathCSV, rect)
				.then(resolve)
				.catch(reject);
		} catch (e) {
			reject(e);
		}
	})
}

// ********************************************************************
// Internal API
// ********************************************************************
function mergeTracks(tracks: MidiIoTrackAbs[]): MidiIoTrackAbs {
	const track = tracks.reduce<MidiIoTrackAbs>((record, track): MidiIoTrackAbs => {
		track.forEach((event): void => {
			record.push(event);
		});
		return record;
	}, []);
	return track.sort((a: MidiIoEventAbs, b: MidiIoEventAbs): number => {
		if (a.tickOffset !== b.tickOffset) {
			return a.tickOffset - b.tickOffset
		} else {
			return sortMap.get(a.subtype) - sortMap.get(b.subtype);
		}
	});
}

/**
 * I want to make sure there always is a time-signature, key-signature and tempo
 * Nothing fancy, if they aren't at tickOffset = 0, we will add them.
 * Note: the order does not matter here. We have not sorted them yet.
 * @param track
 * @param header
 */
function normalizeTrack(track: MidiIoTrackAbs, header: MidiIoHeader): MidiIoTrackAbs {
	const timeSignatures = track.filter((e) => {
		return e.subtype === MidiIoEventSubtype.TimeSignature && e.tickOffset === 0;
	});
	const keySignatures = track.filter((e) => {
		return e.subtype === MidiIoEventSubtype.KeySignature && e.tickOffset === 0;
	});
	const tempos = track.filter((e) => {
		return e.subtype === MidiIoEventSubtype.SetTempo && e.tickOffset === 0;
	});
	// we know that there aren't any ticksPerQuarter because they don't exist as events.
	// But we want to include them in our mix so that folks know.
	track.push({
		deltaTime: 0,
		subtype: MidiIoEventSubtypeExt.TicksPerQuarter as MidiIoEventSubtype,
		tickLength: 0,
		tickOffset: 0,
		type: MidiIoEventType.Meta,
		value: header.ticksPerQuarter
	});
	if (timeSignatures.length === 0) {
		track.push({
			deltaTime: 0,
			denominator: 4,
			numerator: 4,
			subtype: MidiIoEventSubtype.TimeSignature,
			tickLength: 0,
			tickOffset: 0,
			type: MidiIoEventType.Meta
		});
	} else if (timeSignatures.length > 1) {
		console.warn(`multiple time-signatures found: ${JSON.stringify(timeSignatures)})`);
		for (let i = 0; i < timeSignatures.length - 1; i++) {
			track.splice(track.indexOf(timeSignatures[i]), 1);
		}
	}
	if (keySignatures.length === 0) {
		track.push({
			deltaTime: 0,
			key: 0,
			scale: 0,
			subtype: MidiIoEventSubtype.KeySignature,
			tickLength: 0,
			tickOffset: 0,
			type: MidiIoEventType.Meta
		});
	} else if (keySignatures.length > 1) {
		console.warn(`multiple key-signatures found: ${JSON.stringify(keySignatures)}`);
		for (let i = 0; i < keySignatures.length - 1; i++) {
			track.splice(track.indexOf(keySignatures[i]), 1);
		}
	}
	if (tempos.length === 0) {
		track.push({
			deltaTime: 0,
			microsecondsPerBeat: 500000,
			subtype: MidiIoEventSubtype.SetTempo,
			tickLength: 0,
			tickOffset: 0,
			type: MidiIoEventType.Meta
		});
	} else if (tempos.length > 1) {
		console.warn(`multiple tempos found: ${JSON.stringify(tempos)}`);
		for (let i = 0; i < tempos.length - 1; i++) {
			track.splice(track.indexOf(tempos[i]), 1);
		}
	}
	return track;
}

function performCalculations(track: MidiIoTrackAbs, header: MidiIoHeader): MidiIoTrackAbs {
	const notes = track.filter((e) => {
		return e.subtype === MidiIoEventSubtype.NoteOn;
	});
	notes.forEach((note, index): void => {
		note.density = calculateNoteDensity(notes, index, header.ticksPerQuarter);
		note.interval = calculateNoteInterval(notes, index)?.normalized;
	});
	return track;
}

/**
 * It converts deltas to absolute offsets. And it calculates an event length that only
 * really applies to notes. This also allows us to dump the note-offs.
 * @param tracks
 */
function preprocessTracks(tracks: MidiIoTrack[]): MidiIoTrackAbs[] {
	return tracks.map<MidiIoTrackAbs>((track): MidiIoTrackAbs => {
		let tickOffset: number = 0;
		const queue: MidiIoTrackAbs = [];
		const record: MidiIoTrackAbs = [];
		track.forEach(function (event: MidiIoEvent): void {
			tickOffset += event.deltaTime;
			// filter on the ones we care about
			if (event.subtype === MidiIoEventSubtype.NoteOn
				|| event.subtype === MidiIoEventSubtype.SetTempo
				|| event.subtype === MidiIoEventSubtype.KeySignature
				|| event.subtype === MidiIoEventSubtype.TimeSignature
			) {
				const eventAbs = {
					tickLength: 0,
					tickOffset,
					...event
				};
				record.push(eventAbs);
				if (event.subtype === MidiIoEventSubtype.NoteOn) {
					queue.push(eventAbs);
				}
			} else if (event.subtype === MidiIoEventSubtype.NoteOff) {
				// look for the oldest (first) match in our queue and update
				const noteOnEvent = queue.find((e) =>
					e.noteNumber === event.noteNumber
				);
				if (noteOnEvent) {
					noteOnEvent.tickLength = tickOffset - noteOnEvent.tickOffset;
					queue.splice(queue.indexOf(noteOnEvent), 1);
				} else {
					console.warn(`note off missing partner: ${JSON.stringify(event)}`);
				}
			} else if (event.subtype === MidiIoEventSubtype.EndOfTrack) {
				queue.forEach((e) => {
					e.tickLength = tickOffset - e.tickOffset;
				})
			}
		});
		return record;
	});
}

function rectanglify(midi: MidiIoSong): any[] {
	const preprocessed = preprocessTracks(midi.tracks);
	const merged = mergeTracks(preprocessed);
	const normalized = normalizeTrack(merged, midi.header);
	const sorted = sortTrack(normalized);
	const calculated = performCalculations(sorted, midi.header);
	return (encodeWidth === EncodeWidth.Wide)
		? rectanglifyWide(calculated)
		: rectanglifyNarrow(calculated);
}

/**
 * A lean encoding. Metadata is not redundantly repeated for every note. It's
 * lean, but it's not tidy. And I'm not so hot with R such that it's easy to tidyify.
 * @param track
 */
function rectanglifyNarrow(track: MidiIoTrackAbs): any[] {
	let eventKS: MidiIoEventAbs;
	return track.map(event => {
		if (event.subtype === MidiIoEventSubtype.NoteOn) {
			return [
				"note",
				event.tickOffset,
				event.tickLength,
				formatNoteValueRaw(event),
				formatNoteValuePretty(event, eventKS),
				formatNoteValueCanonical(event),
				round(event.density, 4),
				event.interval
			];
		} else if (event.subtype === MidiIoEventSubtype.SetTempo) {
			return [
				"tempo",
				event.tickOffset,
				event.tickLength,
				formatTempoValueRaw(event),
				formatTempoValuePretty(event)
			];
		} else if (event.subtype === MidiIoEventSubtype.KeySignature) {
			eventKS = event;
			return [
				"key_signature",
				event.tickOffset,
				event.tickLength,
				formatKeySignatureValueRaw(event),
				formatKeySignatureValuePretty(event)
			];
		} else if (event.subtype === MidiIoEventSubtype.TimeSignature) {
			return [
				"time_signature",
				event.tickOffset,
				event.tickLength,
				formatTimeSignatureValueRaw(event),
				formatTimeSignatureValuePretty(event)
			]
		} else if (event.subtype === MidiIoEventSubtypeExt.TicksPerQuarter) {
			return [
				"ticks_per_quarter",
				event.tickOffset,
				event.tickLength,
				event.value,
				event.value
			]
		} else {
			throw new Error(`Unknown event subtype: ${event.subtype}`);
		}
	});
}

/**
 * A chubby encoding. Metadata is redundantly repeated for every note. It's
 * tidy and easy to work with.
 * PS: I left the tempo, time-signature and key-signature rows in the data as they have
 * 	information that's missing at the row level and they are easily filtered out. Additionally,
 * 	I want to have the TPQ (ticks-per-quarter) available and just could not bring myself
 * 	to include that at the note level.
 * @param track
 */
function rectanglifyWide(track: MidiIoTrackAbs): any[] {
	let lastTempo: MidiIoEventAbs;
	let lastTS: MidiIoEventAbs;
	let lastKS: MidiIoEventAbs;
	return track.map(event => {
		if (event.subtype === MidiIoEventSubtype.NoteOn) {
			return [
				"note",
				event.tickOffset,
				event.tickLength,
				formatNoteValueRaw(event),
				formatNoteValuePretty(event, lastKS),
				formatNoteValueCanonical(event),
				round(event.density, 4),
				event.interval,
				formatTempoValuePretty(lastTempo),
				formatTimeSignatureValuePretty(lastTS),
				formatKeySignatureValuePretty(lastKS),
			];
		} else if (event.subtype === MidiIoEventSubtype.SetTempo) {
			lastTempo = event;
			return [
				"tempo",
				event.tickOffset,
				event.tickLength,
				formatTempoValueRaw(event),
				formatTempoValuePretty(event)
			];
		} else if (event.subtype === MidiIoEventSubtype.KeySignature) {
			lastKS = event;
			return [
				"key_signature",
				event.tickOffset,
				event.tickLength,
				formatKeySignatureValueRaw(event),
				formatKeySignatureValuePretty(event)
			];
		} else if (event.subtype === MidiIoEventSubtype.TimeSignature) {
			lastTS = event;
			return [
				"time_signature",
				event.tickOffset,
				event.tickLength,
				formatTimeSignatureValueRaw(event),
				formatTimeSignatureValuePretty(event)
			]
		} else if (event.subtype === MidiIoEventSubtypeExt.TicksPerQuarter) {
			return [
				"ticks_per_quarter",
				event.tickOffset,
				event.tickLength,
				event.value,
				event.value
			]
		} else {
			throw new Error(`Unknown event subtype: ${event.subtype}`);
		}
	});
}

function sortTrack(track: MidiIoTrackAbs): MidiIoTrackAbs {
	return track.sort((a: MidiIoEventAbs, b: MidiIoEventAbs): number => {
		if (a.tickOffset !== b.tickOffset) {
			return a.tickOffset - b.tickOffset
		} else {
			const subtypeComparison = sortMap.get(a.subtype) - sortMap.get(b.subtype);
			if (subtypeComparison !== 0) {
				return subtypeComparison;
			} else if (a.subtype !== MidiIoEventSubtype.NoteOn) {
				// How can this happen? We trimmed duplicate meta events from the beginning
				// of our track, but not the middle. We have some content with duplicates in the middle.
				// We'll see if it causes a problem and if so then do something about it. Hopefully they
				// are identical? Let's see..., okay, we saw and found that it is a little challenging
				// to compare them because of deltaTicks. And what are we going to do if they are not equal!?!
				return subtypeComparison;
			} else {
				// let's always have our notes in ascending order. We like order, but we also
				// want to calculate intervals between adjacent notes
				return a.noteNumber - b.noteNumber;
			}
		}
	});
}

async function writeCSV(path: string, rect: FormatterRow): Promise<void> {
	return new Promise((resolve, reject) => {
		const streamFile = createWriteStream(path)
			.on("finish", resolve)
			.on("error", (error) => {
				reject(new Error(`Error writing ${path}: ${error}`));
			});
		let streamCsv = format({
			// @ts-ignore
			headers: (encodeWidth === EncodeWidth.Narrow)
				? ["type", "tick_offset", "tick_duration", "value_raw", "value_pretty", "canonical", "density", "interval"]
				: [
					"type",
					"tick_offset",
					"tick_duration",
					"value_raw",
					"value_pretty",
					"canonical",
					"density",
					"interval",
					"tempo",
					"time_signature",
					"key_signature"
				],
			quoteColumns: false
		});
		streamCsv.pipe(streamFile);
		rect.forEach((row: FormatterRow) => streamCsv.write(row));
		streamCsv.end();
	})
}
