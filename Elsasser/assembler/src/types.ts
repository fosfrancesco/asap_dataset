import {
    MidiIoEvent,
    MidiIoEventSubtype
} from "midi-file-io";

export enum NoteInterval {
    PerfectUnison = 1,
    MinorSecond = 1.5,
    MajorSecond = 2,
    MinorThird = 2.5,
    MajorThird = 3,
    PerfectFourth = 4,
    DiminishedFifth = 4.5,
    PerfectFifth = 5,
    MinorSixth = 5.5,
    MajorSixth = 6,
    MinorSeventh = 6.5,
    MajorSeventh = 7
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
    interval?: number;
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