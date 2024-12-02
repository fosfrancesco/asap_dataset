import {
	MidiIoTrackAbs,
	NoteInterval
} from "./types";

/**
 * Calculate the density of the note at `index`. It uses the notes during and  after him to
 * determine the result. I may be making the calculation up. I think it has merit.
 * @param notes should be all notes in a track
 * @param index index of note for which you want to calculate the density
 * @param window how many MIDI ticks in the calculation?
 * @returns under normal conditions a number (0, 1), but it is possible under extreme values
 *          to return a number greater than 1. It would have to be some fairly dense craziness.
 */
export function calculateNoteDensity(notes: MidiIoTrackAbs, index: number, window: number): number {
	const note = notes[index];
	// include all notes that are at the same offset as `note`
	while (index > 0) {
		if (notes[index - 1].tickOffset === note.tickOffset) {
			index--;
		} else {
			break;
		}
	}
	let indexTo = index + 1;
	for (indexTo; indexTo < notes.length; indexTo++) {
		if (notes[indexTo].tickOffset > note.tickOffset + window) {
			break;
		}
	}
	// sqrt(window)? The window is VERY fine-grained. T
	return (indexTo - index) / Math.sqrt(window);
}

/**
 * Calculates the interval from the note at `index` to the note following it.
 * @param notes should also be all notes in a track
 * @param index index of note for which you want to calculate the interval
 */
export function calculateNoteInterval(notes: MidiIoTrackAbs, index: number): {
	unadulterated: string,
	normalized: string
} | undefined {
	function distanceToInterval(value: number): string {
		switch (value) {
			case 0:
				return NoteInterval.PerfectUnison;
			case 1:
				return NoteInterval.MinorSecond;
			case 2:
				return NoteInterval.MajorSecond;
			case 3:
				return NoteInterval.MinorThird;
			case 4:
				return NoteInterval.MajorThird;
			case 5:
				return NoteInterval.PerfectFourth;
			case 6:
				return NoteInterval.DiminishedFifth;
			case 7:
				return NoteInterval.PerfectFifth;
			case 8:
				return NoteInterval.MinorSixth;
			case 9:
				return NoteInterval.MajorSixth;
			case 10:
				return NoteInterval.MinorSeventh;
			case 11:
				return NoteInterval.MajorSeventh;
		}
		throw new Error(`Invalid value ${value}`);
	}

	if (index < notes.length - 1) {
		const note = notes[index];
		const nextNote = notes[index + 1];
		// Keep it simple and don't get into negative intervals. We are cheating a little bit but at the sametime
		// this is not a formula for recreating the sequence. It's for analytical purposes. Ha, I'm trying to
		// convince myself. I think I've done a fair job.
		const difference = Math.abs(nextNote.noteNumber - note.noteNumber);
		// 9ths, 10ths, etc. are interesting, but I think all that we want to capture here is the one of 11 known
		// intervals. Why? Because from an analysis point of view, I think we just care about the essence of what
		// is going on between neighbors. And if they want something else then they've got the MIDI data and can go
		// hog wild. On second thought, we will get them both out of the way and whoever is calling us can decide.
		const octaves = Math.floor(difference / 12);
		let interval = distanceToInterval(difference % 12);
		return {
			unadulterated: `${interval}+${octaves}*
			P8`,
			normalized: interval,
		};
	}
	return undefined;
}