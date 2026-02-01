export type TrainStop = {
  stationName: string;
  arrivalTime: string | null;
  departureTime: string | null;
  isPassed: boolean;
};

export type TrainDetail = {
  trainNumber: string;
  calendar: "weekday" | "holiday";
  direction: "for_yoyogiuehara" | "for_kitaayase";
  trainType: string;
  originStation: string;
  destinationStation: string;
  stops: TrainStop[];
};
