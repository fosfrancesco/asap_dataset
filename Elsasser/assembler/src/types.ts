import {
    MidiIoEvent,
    MidiIoEventSubtype
} from "midi-file-io";

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
    density?: number;
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