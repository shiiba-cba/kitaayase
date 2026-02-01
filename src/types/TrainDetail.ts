export type TrainStop = {
  station: string;
  arrivalTime: string | null;
  departureTime: string | null;
};

export type TrainDetail = {
  trainNumber: string;
  calendar: "weekday" | "holiday";
  direction: "for_yoyogiuehara" | "for_kitaayase";
  trainType: string;
  originStation: string;
  destinationStation: string;
  timetable: TrainStop[];
};
