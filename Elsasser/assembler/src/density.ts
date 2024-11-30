import {MidiIoTrackAbs} from "./types";

/**
 * Calculate the density of the note at `index`. It uses the notes during and  after him to
 * determine the result. I may be making the calculation up. I think it has merit.
 * @param notes all notes in the track
 * @param index index of note for which you want to calculate the density
 * @param window how many MIDI ticks in the calculation?
 * @returns under normal conditions a number (0, 1), but it is possible under extreme values
 *          to return a number greater than 1. It would have to be some fairly dense craziness.
 */
export function calculateDensity(notes: MidiIoTrackAbs, index: number, window: number): number {
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