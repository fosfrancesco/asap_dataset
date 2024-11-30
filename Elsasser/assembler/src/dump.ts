import {
	dumpMidiSong,
	parseMidiFile
} from "midi-file-io"

export async function execute(pathMIDI: string): Promise<void> {
	return new Promise((resolve, reject) => {
		try {
			const song = parseMidiFile(pathMIDI);
			dumpMidiSong(song);
			resolve();
		} catch (e) {
			reject(e);
		}
	});
}