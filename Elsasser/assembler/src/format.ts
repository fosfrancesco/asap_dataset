import {MidiIoEventAbs} from "./types";

const C0: number = 12;

export function formatKeySignatureValueRaw(event: MidiIoEventAbs): string {
	return `${event.key}:${event.scale}`
}

export function formatKeySignatureValuePretty(event: MidiIoEventAbs): string {
	const scale = (event.scale === 0) ? "Major" : "Minor";
	switch (event.key) {
		case -7:
			return `Cb ${scale}`;
		case -6:
			return `Gb ${scale}`;
		case -5:
			return `Db ${scale}`;
		case -4:
			return `Ab ${scale}`;
		case -3:
			return `Eb ${scale}`;
		case -2:
			return `Bb ${scale}`;
		case -1:
			return `F ${scale}`;
		case 0:
			return `C ${scale}`;
		case 1:
			return `G ${scale}`;
		case 2:
			return `D ${scale}`;
		case 3:
			return `A ${scale}`;
		case 4:
			return `E ${scale}`;
		case 5:
			return `B ${scale}`;
		case 6:
			return `F# ${scale}`;
		case 7:
			return `C# ${scale}`;
	}
	return `Unknown ${scale}`;
}

export function formatNoteValueRaw(event: MidiIoEventAbs): string {
	return `${event.noteNumber}:${event.velocity}`
}

/**
 * I don't know what to call this guy! Normalized, Un-enharmonic, canonical. It's so that
 * statistically we can identify two different notes as being the same by friendly name.
 * I am preferential to flats. They are easier to play on a piano :)
 * @param note
 */
export function formatNoteValueCanonical(note: MidiIoEventAbs): string {
	const octave: number = Math.floor((note.noteNumber - C0) / 12);
	const noteNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
	const noteName = noteNames[note.noteNumber % 12];
	return `${noteName}${octave}`;
}

export function formatNoteValuePretty(note: MidiIoEventAbs, keysig: MidiIoEventAbs): string {
	const octave: number = Math.floor((note.noteNumber - C0) / 12);
	const noteNames = (keysig.key < 0)
		? ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
		: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
	const noteName = noteNames[note.noteNumber % 12];
	return `${noteName}${octave}`;
}

export function formatTempoValueRaw(event: MidiIoEventAbs): string {
	return event.microsecondsPerBeat.toString();
}

export function formatTempoValuePretty(event: MidiIoEventAbs): string {
	return `${60 * 1000000 / event.microsecondsPerBeat}`
}

export function formatTimeSignatureValueRaw(event: MidiIoEventAbs): string {
	return `${event.numerator}:${event.denominator}`
}

export function formatTimeSignatureValuePretty(event: MidiIoEventAbs): string {
	return `${event.numerator}/${event.denominator}`
}

