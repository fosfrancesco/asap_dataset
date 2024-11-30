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
import {calculateDensity} from "./density";
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
	MidiIoEventAbs,
	MidiIoEventSubtypeExt,
	MidiIoTrackAbs
} from "./types";
import {round} from "./utils";

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
		}
		catch (e) {
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
		note.density = calculateDensity(notes, index, header.ticksPerQuarter);
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
	let eventKS: MidiIoEventAbs;
	const preprocessed = preprocessTracks(midi.tracks);
	const merged = mergeTracks(preprocessed);
	const normalized = normalizeTrack(merged, midi.header);
	const sorted = sortTrack(normalized);
	const calculated = performCalculations(sorted, midi.header);
	return calculated.map(event => {
		if (event.subtype === MidiIoEventSubtype.NoteOn) {
			return [
				event.subtype,
				event.tickOffset,
				event.tickLength,
				formatNoteValueRaw(event),
				formatNoteValuePretty(event, eventKS),
				formatNoteValueCanonical(event),
				round(event.density, 4
				)

			];
		} else if (event.subtype === MidiIoEventSubtype.SetTempo) {
			return [
				event.subtype,
				event.tickOffset,
				event.tickLength,
				formatTempoValueRaw(event),
				formatTempoValuePretty(event),
				"", ""
			];
		} else if (event.subtype === MidiIoEventSubtype.KeySignature) {
			eventKS = event;
			return [
				event.subtype,
				event.tickOffset,
				event.tickLength,
				formatKeySignatureValueRaw(event),
				formatKeySignatureValuePretty(event),
				"", ""
			];
		} else if (event.subtype === MidiIoEventSubtype.TimeSignature) {
			return [
				event.subtype,
				event.tickOffset,
				event.tickLength,
				formatTimeSignatureValueRaw(event),
				formatTimeSignatureValuePretty(event),
				"", ""
			]
		} else if (event.subtype === MidiIoEventSubtypeExt.TicksPerQuarter) {
			return [
				event.subtype,
				event.tickOffset,
				event.tickLength,
				event.value,
				event.value,
				"", ""
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
			return sortMap.get(a.subtype) - sortMap.get(b.subtype);
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
			headers: ["type", "tickOffset", "tickLength", "valueRaw", "valuePretty", "canonical", "density"],
			quoteColumns: [false, false, false, false, false, false, false]
		});
		streamCsv.pipe(streamFile);
		rect.forEach((row: FormatterRow) => streamCsv.write(row));
		streamCsv.end();
	})
}
