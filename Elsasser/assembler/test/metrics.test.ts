import {calculateNoteInterval} from '../src/metrics';
import {
	MidiIoEventAbs,
	MidiIoTrackAbs,
	NoteInterval
} from "../src/types";

describe('calculateNoteInterval', () => {
	const testCases: any[] = [
		{
			name: '-major second',
			interval: -2,
			expected: NoteInterval.MajorSecond
		},
		{
			name: '-minor second',
			interval: -1,
			expected: NoteInterval.MinorSecond
		},
		{
			name: 'perfect unison',
			interval: 0,
			expected: NoteInterval.PerfectUnison
		},
		{
			name: 'minor second',
			interval: 1,
			expected: NoteInterval.MinorSecond
		},
		{
			name: 'major second',
			interval: 2,
			expected: NoteInterval.MajorSecond
		},
		{
			name: 'minor third',
			interval: 3,
			expected: NoteInterval.MinorThird
		},
		{
			name: 'major third',
			interval: 4,
			expected: NoteInterval.MajorThird
		},
		{
			name: 'perfect fourth',
			interval: 5,
			expected: NoteInterval.PerfectFourth
		},
		{
			name: 'diminished fifth',
			interval: 6,
			expected: NoteInterval.DiminishedFifth
		},
		{
			name: 'perfect fifth',
			interval: 7,
			expected: NoteInterval.PerfectFifth
		},
		{
			name: 'minor sixth',
			interval: 8,
			expected: NoteInterval.MinorSixth
		},
		{
			name: 'major sixth',
			interval: 9,
			expected: NoteInterval.MajorSixth
		},
		{
			name: 'minor seventh',
			interval: 10,
			expected: NoteInterval.MinorSeventh
		},
		{
			name: 'major seventh',
			interval: 11,
			expected: NoteInterval.MajorSeventh
		},
		{
			name: 'octave',
			interval: 12,
			expected: NoteInterval.PerfectUnison
		}
	]

	function createInterval(interval: number): MidiIoTrackAbs {
		return [
			{
				noteNumber: 36
			} as MidiIoEventAbs,
			{
				noteNumber: 36 + interval
			} as MidiIoEventAbs
		]
	}

	test('last note', () => {
		const track = createInterval(0);
		const interval = calculateNoteInterval(track, 1);
		expect(interval)
			.toEqual(undefined)
	})

	testCases.forEach((item: any) => {
		test(item.name, () => {
			const track = createInterval(item.interval);
			const interval = calculateNoteInterval(track, 0);
			expect(interval.normalized)
				.toEqual(item.expected)
		})
	})
})